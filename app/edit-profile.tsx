import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Theme from '../constants/theme';
import { api } from '../convex/_generated/api';

export default function EditProfileScreen() {
  const router = useRouter();
  const userProfile = useQuery(api.userProfile.getOrCreateProfile);
  const updateProfile = useMutation(api.userProfile.updateProfile);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
      });
    }
  }, [userProfile]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateProfile({
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
      });
      router.back();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (label: string, value: string, key: keyof typeof formData) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => setFormData(prev => ({ ...prev, [key]: text }))}
          placeholder={label}
          placeholderTextColor={Theme.colors.text.tertiary}
        />
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={[Theme.colors.background.primary, Theme.colors.background.secondary]}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar section commented out for now
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            <Ionicons name="camera" size={24} color={Theme.colors.text.primary} />
          </View>
        </View>
        */}

        {renderField('First name', formData.firstName, 'firstName')}
        {renderField('Last name', formData.lastName, 'lastName')}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: Theme.colors.text.primary,
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  saveButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.medium,
    backgroundColor: Theme.colors.accent.primary,
  },
  saveText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.background.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: Theme.spacing.xxxl,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Theme.colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    width: 32,
    height: 32,
    tintColor: Theme.colors.text.tertiary,
  },
  fieldContainer: {
    marginBottom: Theme.spacing.xl,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    paddingHorizontal: Theme.spacing.lg,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  chevronButton: {
    padding: Theme.spacing.sm,
  },
  chevronIcon: {
    width: 20,
    height: 20,
    tintColor: Theme.colors.text.tertiary,
  },
});
