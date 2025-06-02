import DatabaseHealthService, { UserProfile } from '@/services/DatabaseHealthService';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvex, useConvexAuth } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);

  useEffect(() => {
    if (isAuthenticated && convex) {
      const service = new DatabaseHealthService(convex);
      setHealthService(service);
      loadProfileData(service);
    }
  }, [isAuthenticated, convex]);

  const loadProfileData = async (service: DatabaseHealthService) => {
    try {
      setIsLoading(true);
      const profileData = await service.getUserProfile();
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await signOut();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to delete account");
              console.error("Delete account error:", error);
            }
          }
        },
      ]
    );
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#E0E0E0', '#F5F5F5', '#E0E0E0']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="chevron-left" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Navigate to profile editing or account details
              Alert.alert('Coming Soon', 'Profile editing features are coming soon!');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Edit Profile</Text>
              <FontAwesome5 name="user-edit" size={20} color="#333" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Health Data Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Health Data</Text>
          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Coming Soon', 'Health data export features are coming soon!');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Export Data</Text>
              <FontAwesome5 name="download" size={20} color="#333" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Terms and Conditions</Text>
              <FontAwesome5 name="chevron-right" size={20} color="#333" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Coming Soon', 'Privacy policy will be available soon!');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Privacy Policy</Text>
              <FontAwesome5 name="chevron-right" size={20} color="#333" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.section}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Linking.openURL('mailto:support@koko.app');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={styles.optionText}>Support</Text>
              <FontAwesome5 name="chevron-right" size={20} color="#333" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.section, styles.dangerSection]}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <View style={styles.sectionContent}>
              <Text style={[styles.optionText, styles.dangerText]}>Delete Account</Text>
              <FontAwesome5 name="trash-alt" size={20} color="#FF3B30" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60, // Safe area spacing
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
  },
  placeholder: {
    width: 40, // Same width as back button for centering
  },
  scrollView: {
    flex: 1,
  },
  sectionGroup: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
    marginLeft: 20,
    marginBottom: 12,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#333',
  },
  dangerSection: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  dangerText: {
    color: '#FF3B30',
  },
  bottomSpacing: {
    height: 100, // Space for tab bar
  },
}); 