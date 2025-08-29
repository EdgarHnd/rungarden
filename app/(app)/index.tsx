import GardenView from '@/components/GardenView';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useConvexAuth, useMutation } from "convex/react";
import { useFocusEffect } from 'expo-router';
import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const { isAuthenticated } = useConvexAuth();
  
  // Initialize plant types on app start
  const initializePlantTypes = useMutation(api.plantTypes.initializePlantTypes);
  
  useEffect(() => {
    if (isAuthenticated) {
      // Initialize plant types in database if needed
      initializePlantTypes().catch(console.error);
    }
  }, [isAuthenticated, initializePlantTypes]);

  // Focus effect for when user returns to this screen
  useFocusEffect(
    React.useCallback(() => {
      // Could add analytics tracking here if needed
    return () => {
        // Cleanup if needed
      };
    }, [])
  );

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

    return (
      <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <GardenView />
          </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  content: {
    flex: 1,
  },
});
