import LoadingScreen from '@/components/LoadingScreen';
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, ConvexReactClient, Unauthenticated } from "convex/react";
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { AnalyticsProviderComponent } from '../provider/AnalyticsProvider';
import { MixpanelProvider } from '../provider/MixpanelProvider';
import { RevenueCatProvider } from '../provider/RevenueCatProvider';
import OnboardingScreen from './onboarding';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const mixpanelProvider = new MixpanelProvider(process.env.EXPO_PUBLIC_MIXPANEL_TOKEN!);

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

function AuthenticatedApp() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen
        name="challenges"
        options={{
          presentation: 'card',
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="activity-detail"
        options={{
          presentation: 'card',
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="training-detail"
        options={{
          presentation: 'card',
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="training"
        options={{
          presentation: 'card',
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="run"
        options={{
          presentation: 'card',
          gestureEnabled: true,
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="add-friend"
        options={{
          presentation: 'modal',
          gestureEnabled: true,
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'SF-Pro-Rounded-Ultralight': require('@/assets/fonts/SF-Pro-Rounded-Ultralight.ttf'),
    'SF-Pro-Rounded-Thin': require('@/assets/fonts/SF-Pro-Rounded-Thin.ttf'),
    'SF-Pro-Rounded-Light': require('@/assets/fonts/SF-Pro-Rounded-Light.ttf'),
    'SF-Pro-Rounded-Regular': require('@/assets/fonts/SF-Pro-Rounded-Regular.ttf'),
    'SF-Pro-Rounded-Medium': require('@/assets/fonts/SF-Pro-Rounded-Medium.ttf'),
    'SF-Pro-Rounded-Semibold': require('@/assets/fonts/SF-Pro-Rounded-Semibold.ttf'),
    'SF-Pro-Rounded-Bold': require('@/assets/fonts/SF-Pro-Rounded-Bold.ttf'),
    'SF-Pro-Rounded-Heavy': require('@/assets/fonts/SF-Pro-Rounded-Heavy.ttf'),
    'SF-Pro-Rounded-Black': require('@/assets/fonts/SF-Pro-Rounded-Black.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
    mixpanelProvider.initialize();
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <AnalyticsProviderComponent provider={mixpanelProvider}>
      <RevenueCatProvider>
        <ConvexAuthProvider
          client={convex}
          storage={
            Platform.OS === "android" || Platform.OS === "ios"
              ? secureStorage
              : undefined
          }
        >
          <AuthLoading>
            <LoadingScreen />
          </AuthLoading>
          <Unauthenticated>
            <OnboardingScreen />
          </Unauthenticated>
          <Authenticated>
            <AuthenticatedApp />
          </Authenticated>
        </ConvexAuthProvider>
      </RevenueCatProvider>
    </AnalyticsProviderComponent>
  );
}
