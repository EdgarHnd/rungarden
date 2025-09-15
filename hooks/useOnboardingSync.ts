import { OnboardingData } from '@/constants/types';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { useEffect } from 'react';

export function useOnboardingSync() {
  const analytics = useAnalytics();
  // Check if user profile exists - if this succeeds, user is authenticated
  const userProfile = useQuery(api.userProfile.getOrCreateProfile);
  const updateUserProfile = useMutation(api.userProfile.updateProfile);

  useEffect(() => {
    const syncPendingOnboardingData = async () => {
      console.log('[useOnboardingSync] Hook triggered, userProfile state:', userProfile);
      
      // Check if we can query the database (user is authenticated)
      if (userProfile === undefined) {
        console.log('[useOnboardingSync] Still loading user profile, waiting...');
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

        const onboardingData: OnboardingData = JSON.parse(pendingData);
        console.log('Found pending onboarding data, processing...', {
          hasExistingProfile: userProfile !== null,
          newData: onboardingData
        });

        // Save all the onboarding data to the user profile
        await updateUserProfile({
          firstName: onboardingData.firstName,
          lastName: onboardingData.lastName,
          gender: onboardingData.gender,
          age: onboardingData.age,
          metricSystem: onboardingData.metricSystem,
          weekStartDay: onboardingData.weekStartDay,
          daysPerWeek: onboardingData.daysPerWeek,
          preferredDays: onboardingData.preferredDays,
          pushNotificationsEnabled: onboardingData.pushNotificationsEnabled ?? false,
        });
        console.log('User profile updated successfully with onboarding data');
        
        analytics.track({
          name: 'onboarding_completed',
          properties: { ...onboardingData }
        });
        
        // Clear the pending data after successful save
        await AsyncStorage.removeItem('pendingOnboardingData');
        console.log('Onboarding data successfully synced and cleared from storage');
        
      } catch (error) {
        console.error('Failed to sync pending onboarding data:', error);
        // Don't clear the data if saving failed, so we can retry later
      }
    };

    syncPendingOnboardingData();
  }, [userProfile, updateUserProfile, analytics]);
}