import Theme from '@/constants/theme';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useAuthActions } from "@convex-dev/auth/react";
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuth from 'expo-apple-authentication';
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Reanimated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInUp,
} from 'react-native-reanimated';

const redirectTo = makeRedirectUri();

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const analytics = useAnalytics();
  const [currentStep, setCurrentStep] = useState(0); // 0 = intro, 1 = auth

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      analytics.track({
        name: 'onboarding_google_signin_attempted',
        properties: { step: currentStep },
      });

      const { redirect } = await signIn("google", { redirectTo });
      if (Platform.OS === "web") return;

      const result = await openAuthSessionAsync(redirect!.toString(), redirectTo);
      if (result.type === "success") {
        const { url } = result;
        const code = new URL(url).searchParams.get("code")!;
        const signInResult = await signIn("google", { code });

        if (signInResult) {
          analytics.track({
            name: 'onboarding_signin_completed',
            properties: {
              auth_method: 'google',
              step: currentStep
            },
          });
          router.replace('/(app)');
        }
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      analytics.track({
        name: 'onboarding_apple_signin_attempted',
        properties: { step: currentStep },
      });

      if (Platform.OS === 'ios' && await AppleAuth.isAvailableAsync()) {
        try {
          const credential = await AppleAuth.signInAsync({
            requestedScopes: [
              AppleAuth.AppleAuthenticationScope.FULL_NAME,
              AppleAuth.AppleAuthenticationScope.EMAIL,
            ],
          });

          const result = await signIn('native-apple', credential);
          if (result) {
            analytics.track({
              name: 'onboarding_signin_completed',
              properties: {
                auth_method: 'apple',
                step: currentStep
              },
            });
            router.replace('/(app)');
          }
        } catch (nativeErr: any) {
          if (nativeErr?.code === 'ERR_CANCELED') {
            return; // User cancelled
          }
          console.warn('Native Apple sign-in failed:', nativeErr);
          Alert.alert('Apple Sign-In Error', 'Apple Sign-In failed. Please try again later.');
        }
      } else {
        Alert.alert('Apple Sign-In Unavailable', 'Apple Sign-In is not available on this device.');
      }
    } catch (error) {
      console.error('Apple sign in error:', error);
      Alert.alert('Apple Sign-In Error', 'Failed to sign in with Apple. Please try again.');
    }
  };

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.track({
      name: 'onboarding_get_started_tapped',
      properties: { step: currentStep },
    });
    setCurrentStep(1);
  };

  const renderIntro = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['#4CAF50', '#8BC34A', '#CDDC39']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoContainer}
        >
          <Text style={styles.logoEmoji}>🌱</Text>
        </LinearGradient>

        <Text style={styles.appTitle}>Run Garden</Text>
        <Text style={styles.appTagline}>Grow your garden with every run</Text>
      </View>

      <View style={styles.featuresSection}>
        <View style={styles.feature}>
          <Text style={styles.featureEmoji}>🏃‍♂️</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Run & Earn Plants</Text>
            <Text style={styles.featureDescription}>Every run rewards you with plants based on distance</Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureEmoji}>🌳</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Build Your Garden</Text>
            <Text style={styles.featureDescription}>Plant and grow your collection in a beautiful garden</Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureEmoji}>👥</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Share with Friends</Text>
            <Text style={styles.featureDescription}>Visit friends' gardens and motivate each other</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.getStartedButton}
        onPress={handleGetStarted}
      >
        <Text style={styles.getStartedButtonText}>Get Started</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderAuth = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={SlideInUp.duration(400)}
      exiting={SlideInDown.duration(300)}
    >
      <View style={styles.authHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentStep(0);
          }}
        >
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>

        <Text style={styles.authTitle}>Join Run Garden</Text>
        <Text style={styles.authSubtitle}>Save your progress and connect with friends</Text>
      </View>

      <View style={styles.authBenefits}>
        <View style={styles.benefit}>
          <View style={styles.benefitCheck}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
          <Text style={styles.benefitText}>Save your garden progress</Text>
        </View>

        <View style={styles.benefit}>
          <View style={styles.benefitCheck}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
          <Text style={styles.benefitText}>Sync between devices</Text>
        </View>

        <View style={styles.benefit}>
          <View style={styles.benefitCheck}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
          <Text style={styles.benefitText}>Connect with friends</Text>
        </View>
      </View>

      <View style={styles.authButtons}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          >
            <Ionicons name="logo-apple" size={20} color="white" />
            <Text style={styles.appleButtonText}>Sign in with Apple</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.privacyText}>
        We only use your account for authentication. Your data stays private.
      </Text>
    </Reanimated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {currentStep === 0 && renderIntro()}
        {currentStep === 1 && renderAuth()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Intro styles
  heroSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoEmoji: {
    fontSize: 48,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: 18,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  featuresSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    marginVertical: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
  },
  featureEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
  },

  getStartedButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: Theme.colors.accent.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },

  // Auth styles
  authHeader: {
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 8,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  authBenefits: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginTop: 40,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitText: {
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontWeight: '500',
  },

  authButtons: {
    gap: 12,
    marginTop: 40,
  },
  googleButton: {
    backgroundColor: '#DB4437',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#DB4437',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },

  privacyText: {
    fontSize: 13,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 24,
  },
}); 
