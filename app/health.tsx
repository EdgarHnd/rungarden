import { Stack } from 'expo-router';
import React from 'react';
import HealthDashboard from '../components/HealthDashboard';

export default function HealthScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Health & Activities',
        }}
      />
      <HealthDashboard />
    </>
  );
} 