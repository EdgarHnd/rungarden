import { api } from '@/convex/_generated/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery } from 'convex/react';
import { useEffect } from 'react';

export function useOnboardingSync() {
  // Try to get the training profile - if this succeeds, user is authenticated
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const saveTrainingProfile = useMutation(api.trainingProfile.saveOnboardingData);
  const generateTrainingPlan = useMutation(api.trainingPlan.generateTrainingPlan);

  useEffect(() => {
    const syncPendingOnboardingData = async () => {
      // Check if we can query the database (user is authenticated)
      if (trainingProfile === undefined) return; // Still loading
      
      try {
        const pendingData = await AsyncStorage.getItem('pendingOnboardingData');
        if (!pendingData) return;

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
        
        // Generate/regenerate the training plan based on new profile data
        try {
          const planResult = await generateTrainingPlan();
          console.log('Training plan generated successfully:', planResult);
        } catch (planError) {
          console.error('Failed to generate training plan:', planError);
          // Don't fail the whole process if plan generation fails
        }
        
        // Clear the pending data after successful save
        await AsyncStorage.removeItem('pendingOnboardingData');
        console.log('Onboarding data successfully synced and cleared from storage');
        
      } catch (error) {
        console.error('Failed to sync pending onboarding data:', error);
        // Don't clear the data if saving failed, so we can retry later
      }
    };

    syncPendingOnboardingData();
  }, [trainingProfile]);
} 