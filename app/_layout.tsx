import { Theme } from "@/constants/theme";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Authenticated, AuthLoading, ConvexReactClient, Unauthenticated } from "convex/react";
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import OnboardingScreen from './onboarding';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

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
    </Stack>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background.primary }}>
      <ActivityIndicator size="large" color={Theme.colors.text.primary} />
    </View>
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
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
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
  );
}
