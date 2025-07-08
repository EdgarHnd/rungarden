import {
    OnboardingTrainingProfileData,
    OnboardingUserProfileData,
    StoredOnboardingData
} from '@/constants/types';
import { api } from '@/convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { useEffect } from 'react';

export function useOnboardingSync() {
  // Try to get the training profile - if this succeeds, user is authenticated
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const saveTrainingProfile = useMutation(api.trainingProfile.saveOnboardingData);
  const updateUserProfile = useMutation(api.userProfile.updateProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const generateTrainingPlan = useMutation(api.trainingPlan.generateTrainingPlan);
  const setSimpleTrainingSchedule = useMutation(api.simpleTrainingSchedule.setSimpleTrainingSchedule);

  useEffect(() => {
    const syncPendingOnboardingData = async () => {
      console.log('[useOnboardingSync] Hook triggered, trainingProfile state:', trainingProfile);
      
      // Check if we can query the database (user is authenticated)
      if (trainingProfile === undefined) {
        console.log('[useOnboardingSync] Still loading training profile, waiting...');
        return; // Still loading
      }
      
      try {
        console.log('[useOnboardingSync] Checking for pending onboarding data...');
        const pendingData = await AsyncStorage.getItem('pendingOnboardingData');
        console.log('[useOnboardingSync] Pending data found:', !!pendingData);
        
        if (!pendingData) {
          console.log('[useOnboardingSync] No pending data found in AsyncStorage');
          return;
        }

        const onboardingData: StoredOnboardingData = JSON.parse(pendingData);
        console.log('Found pending onboarding data, processing...', {
          hasExistingProfile: trainingProfile !== null,
          newData: onboardingData
        });

        // Extract training and user profile data
        const trainingProfileData: OnboardingTrainingProfileData = onboardingData.trainingProfile;
        const userProfileData: OnboardingUserProfileData = onboardingData.userProfile;

        // Save the training profile (creates new or updates existing)
        await saveTrainingProfile({
          goalDistance: trainingProfileData.goalDistance,
          goalDate: trainingProfileData.goalDate,
          currentAbility: trainingProfileData.currentAbility ?? 'none',
          longestDistance: trainingProfileData.longestDistance,
          daysPerWeek: trainingProfileData.daysPerWeek,
          preferredDays: trainingProfileData.preferredDays,
          hasTreadmill: trainingProfileData.hasTreadmill,
          preferTimeOverDistance: trainingProfileData.preferTimeOverDistance ?? false,
          pushNotificationsEnabled: trainingProfileData.pushNotificationsEnabled ?? false
        });
        console.log('Training profile saved successfully', {
          action: trainingProfile !== null ? 'updated' : 'created'
        });

        // Update user profile with onboarding data
        const profileUpdates: any = {};
        
        console.log('[useOnboardingSync] Processing user profile data:', userProfileData);
        
        if (userProfileData.mascotName) {
          profileUpdates.mascotName = userProfileData.mascotName;
          console.log('[useOnboardingSync] Adding mascotName to updates:', userProfileData.mascotName);
        }
        
        if (userProfileData.path) {
          profileUpdates.path = userProfileData.path;
          console.log('[useOnboardingSync] Adding path to updates:', userProfileData.path);
        }
        
        if (userProfileData.gender) {
          profileUpdates.gender = userProfileData.gender;
          console.log('[useOnboardingSync] Adding gender to updates:', userProfileData.gender);
        }
        
        if (userProfileData.age !== null && userProfileData.age !== undefined) {
          profileUpdates.age = userProfileData.age;
          console.log('[useOnboardingSync] Adding age to updates:', userProfileData.age);
        }
        
        if (userProfileData.metricSystem) {
          profileUpdates.metricSystem = userProfileData.metricSystem;
          console.log('[useOnboardingSync] Adding metricSystem to updates:', userProfileData.metricSystem);
        }
        
        if (userProfileData.weekStartDay !== undefined) {
          profileUpdates.weekStartDay = userProfileData.weekStartDay;
          console.log('[useOnboardingSync] Adding weekStartDay to updates:', userProfileData.weekStartDay);
        }
        
        if (Object.keys(profileUpdates).length > 0) {
          console.log('[useOnboardingSync] Updating user profile with:', profileUpdates);
          await updateUserProfile(profileUpdates);
          console.log('[useOnboardingSync] User profile updated successfully');
        } else {
          console.log('[useOnboardingSync] No user profile updates needed');
        }

        // Update push notification settings
        if (trainingProfileData.pushNotificationsEnabled !== null && trainingProfileData.pushNotificationsEnabled !== undefined) {
          await updateSyncPreferences({
            pushNotificationsEnabled: trainingProfileData.pushNotificationsEnabled
          });
          console.log('Push notification settings updated');
        }
        
        // Create simple training schedule as the default system
        // This will automatically trigger notification scheduling if push notifications are enabled
        try {
          const simpleScheduleResult = await setSimpleTrainingSchedule({
            runsPerWeek: trainingProfileData.daysPerWeek,
            preferredDays: trainingProfileData.preferredDays.length > 0 
              ? trainingProfileData.preferredDays 
              : ['Mon', 'Wed', 'Fri'] // Default if no preferred days selected
          });
          console.log('Simple training schedule created successfully (with notifications scheduled):', simpleScheduleResult);
        } catch (scheduleError) {
          console.error('Failed to create simple training schedule:', scheduleError);
          // Don't fail the whole process if schedule creation fails
        }
        
        // Optional: Generate structured training plan for advanced users
        // (Currently disabled - simple schedule is the default)
        // try {
        //   const planResult = await generateTrainingPlan();
        //   console.log('Training plan generated successfully:', planResult);
        // } catch (planError) {
        //   console.error('Failed to generate training plan:', planError);
        // }
        
        // Clear the pending data after successful save
        await AsyncStorage.removeItem('pendingOnboardingData');
        console.log('Onboarding data successfully synced and cleared from storage');
        
      } catch (error) {
        console.error('Failed to sync pending onboarding data:', error);
        // Don't clear the data if saving failed, so we can retry later
      }
    };

    syncPendingOnboardingData();
  }, [trainingProfile, saveTrainingProfile, updateUserProfile, updateSyncPreferences, setSimpleTrainingSchedule]);
} 