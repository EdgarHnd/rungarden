import Leaderboard from '@/components/Leaderboard';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function TrophiesScreen() {
  const [error, setError] = useState<string | null>(null);

  const handleError = (message: string) => {
    setError(message);
    Alert.alert('Error', message);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Leaderboard</Text>
        <Text style={styles.subtitle}>Compete with other runners</Text>
      </View>

      <View style={styles.content}>
        <Leaderboard onError={handleError} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
}); 