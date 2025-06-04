import Leaderboard from '@/components/Leaderboard';
import Theme from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function TrophiesScreen() {
  const [error, setError] = useState<string | null>(null);

  const handleError = (message: string) => {
    setError(message);
    Alert.alert('Error', message);
  };

  return (
    <LinearGradient
      colors={[Theme.colors.background.primary, Theme.colors.background.secondary, Theme.colors.background.primary]}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <Text style={styles.subtitle}>See how you stack up with other runners</Text>
      </View>

      <View style={styles.content}>
        <Leaderboard onError={handleError} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: Theme.spacing.xl,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: Theme.spacing.xl,
  },
}); 