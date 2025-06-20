import { api } from '@/convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { useEffect } from 'react';

export function useOnboardingSync() {
  // Try to get the training profile - if this succeeds, user is authenticated
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const saveTrainingProfile = useMutation(api.trainingProfile.saveOnboardingData);
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

        const onboardingData = JSON.parse(pendingData);
        console.log('Found pending onboarding data, processing...', {
          hasExistingProfile: trainingProfile !== null,
          newData: onboardingData
        });

        // Save the training profile (creates new or updates existing)
        await saveTrainingProfile(onboardingData);
        console.log('Training profile saved successfully', {
          action: trainingProfile !== null ? 'updated' : 'created'
        });
        
        // Create simple training schedule as the default system
        try {
          const simpleScheduleResult = await setSimpleTrainingSchedule({
            runsPerWeek: onboardingData.daysPerWeek,
            preferredDays: onboardingData.preferredDays.length > 0 
              ? onboardingData.preferredDays 
              : ['Mon', 'Wed', 'Fri'] // Default if no preferred days selected
          });
          console.log('Simple training schedule created successfully:', simpleScheduleResult);
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
  }, [trainingProfile, saveTrainingProfile, setSimpleTrainingSchedule]);
} 