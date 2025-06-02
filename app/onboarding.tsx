import { useAuthActions } from "@convex-dev/auth/react";
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const redirectTo = makeRedirectUri();

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();

  const handleAnonymousSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signIn("anonymous");
      router.replace('/(app)');
    } catch (error) {
      console.error("Sign in error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign in anonymously");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { redirect } = await signIn("google", { redirectTo });

      if (Platform.OS === "web") {
        return; // Web will handle the redirect automatically
      }

      // For mobile platforms, open the OAuth flow in a browser
      const result = await openAuthSessionAsync(redirect!.toString(), redirectTo);

      if (result.type === "success") {
        const { url } = result;
        const code = new URL(url).searchParams.get("code")!;
        await signIn("google", { code });
        router.replace('/(app)');
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signIn("apple");
      router.replace('/(app)');
    } catch (error) {
      console.error("Apple sign in error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign in with Apple");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Koko</Text>
          <Text style={styles.subtitle}>Your personal running companion</Text>
        </View>

        <View style={styles.authSection}>
          <Text style={styles.authTitle}>Get Started</Text>
          <Text style={styles.authDescription}>
            Sign in to sync your data across devices and unlock all features
          </Text>

          <TouchableOpacity style={[styles.authButton, styles.googleButton]} onPress={handleGoogleSignIn}>
            <Text style={styles.authButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.authButton, styles.appleButton]} onPress={handleAppleSignIn}>
            <Text style={styles.authButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.authButton, styles.anonymousButton]} onPress={handleAnonymousSignIn}>
            <Text style={styles.authButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 36,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  authSection: {
    marginBottom: 40,
  },
  authTitle: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  authDescription: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  authButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  anonymousButton: {
    backgroundColor: '#6B7280',
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 40,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
}); 