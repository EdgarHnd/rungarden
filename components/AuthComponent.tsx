import { useAuthActions } from "@convex-dev/auth/react";
import { makeRedirectUri } from "expo-auth-session";
import { openAuthSessionAsync } from "expo-web-browser";
import React from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const redirectTo = makeRedirectUri();

export default function AuthComponent() {
  const { signIn, signOut } = useAuthActions();

  const handleSignIn = async () => {
    try {
      await signIn("anonymous");
      Alert.alert("Success", "Signed in successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to sign in");
      console.error("Sign in error:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
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
        Alert.alert("Success", "Signed in with Google successfully!");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to sign in with Google");
      console.error("Google sign in error:", error);
    }
  };

  const handleAppleSignIn = async () => {
    // Placeholder for Apple Sign-In
    Alert.alert("Coming Soon", "Apple Sign-In is not yet implemented.");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert("Success", "Signed out successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
      console.error("Sign out error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Authentication Status</Text>

      <View style={styles.authContainer}>
        <Text style={styles.statusText}>🔐 Ready to Authenticate</Text>
        <Text style={styles.userInfo}>Choose your preferred sign-in method</Text>

        <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Sign In Anonymously</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.signInButton, styles.googleButton]} onPress={handleGoogleSignIn}>
          <Text style={styles.buttonText}>Sign In with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.signInButton, styles.appleButton]} onPress={handleAppleSignIn}>
          <Text style={styles.buttonText}>Sign In with Apple (Coming Soon)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#374151',
    marginBottom: 16,
  },
  authContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#374151',
    marginBottom: 12,
  },
  userInfo: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#6B7280',
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
}); 