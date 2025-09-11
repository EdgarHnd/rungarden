import GardenView from '@/components/GardenView';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useConvexAuth } from "convex/react";
import React from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const { isAuthenticated } = useConvexAuth();
  const analytics = useAnalytics();

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
