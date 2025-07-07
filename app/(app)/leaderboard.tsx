import Leaderboard from '@/components/Leaderboard';
import Theme from '@/constants/theme';
import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, View } from 'react-native';

export default function TrophiesScreen() {
  const [error, setError] = useState<string | null>(null);

  const handleError = (message: string) => {
    setError(message);
    Alert.alert('Error', message);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Leaderboard onError={handleError} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
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