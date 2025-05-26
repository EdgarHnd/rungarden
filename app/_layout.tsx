import { FontAwesome5 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { View } from 'react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'SF-Pro-Rounded-Ultralight': require('../assets/fonts/SF-Pro-Rounded-Ultralight.ttf'),
    'SF-Pro-Rounded-Thin': require('../assets/fonts/SF-Pro-Rounded-Thin.ttf'),
    'SF-Pro-Rounded-Light': require('../assets/fonts/SF-Pro-Rounded-Light.ttf'),
    'SF-Pro-Rounded-Regular': require('../assets/fonts/SF-Pro-Rounded-Regular.ttf'),
    'SF-Pro-Rounded-Medium': require('../assets/fonts/SF-Pro-Rounded-Medium.ttf'),
    'SF-Pro-Rounded-Semibold': require('../assets/fonts/SF-Pro-Rounded-Semibold.ttf'),
    'SF-Pro-Rounded-Bold': require('../assets/fonts/SF-Pro-Rounded-Bold.ttf'),
    'SF-Pro-Rounded-Heavy': require('../assets/fonts/SF-Pro-Rounded-Heavy.ttf'),
    'SF-Pro-Rounded-Black': require('../assets/fonts/SF-Pro-Rounded-Black.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          width: '90%',
          marginLeft: 20,
          marginRight: 20,
          elevation: 0,
          backgroundColor: '#fff',
          borderRadius: 30,
          height: 60,
          paddingBottom: 0,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: '#000',
        tabBarIconStyle: {
          marginTop: 10,
        },
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shoes"
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="running" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 70,
              height: 70,
              backgroundColor: '#000',
              borderRadius: 100,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <FontAwesome5 name="plus" size={30} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="trophies"
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
