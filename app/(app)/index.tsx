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

  // Initialize plant types on app start (new system)
  const initializeNewPlantTypes = useMutation(api.plantTypesNew.initializeNewPlantTypes);

  useEffect(() => {
    if (isAuthenticated) {
      // Initialize plant types in database if needed (new system)
      initializeNewPlantTypes().catch(console.error);
    }
  }, [isAuthenticated, initializeNewPlantTypes]);

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
