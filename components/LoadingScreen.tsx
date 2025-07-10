import { Theme } from '@/constants/theme';
import LottieView from 'lottie-react-native';
import React from 'react';
import { View } from 'react-native';

export default function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background.primary }}>
      <LottieView
        source={require('@/assets/images/loading.json')}
        autoPlay
        loop
        style={{ width: 100, height: 100 }}
      />
    </View>
  );
} 