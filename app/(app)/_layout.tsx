import { FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';

export default function AppLayout() {
  const createTabBarButton = (onPress: () => void) => {
    return ({ children, style, ...props }: any) => (
      <TouchableOpacity
        {...props}
        style={style}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 1)',
          height: 80,
          paddingBottom: 0,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={80}
            tint="light"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
            }}
          >
            {/* Very soft, subtle white blur fade */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)']}
              locations={[0, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                position: 'absolute',
                top: -100,
                left: 0,
                right: 0,
                height: 100,
              }}
            />
          </BlurView>
        ),
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
        options={({ navigation }) => ({
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="home" size={size} color={color} />
          ),
          tabBarButton: createTabBarButton(() => navigation.navigate('index')),
        })}
      />
      <Tabs.Screen
        name="activities"
        options={({ navigation }) => ({
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="running" size={size} color={color} />
          ),
          tabBarButton: createTabBarButton(() => navigation.navigate('activities')),
        })}
      />
      <Tabs.Screen
        name="add"
        options={({ navigation }) => ({
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 70,
              height: 70,
              backgroundColor: '#000',
              borderRadius: 100,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <FontAwesome5 name="circle" size={40} color="#fff" />
            </View>
          ),
          tabBarButton: createTabBarButton(() =>
            Alert.alert(
              "Coming Soon",
              "Recording feature is coming soon!",
              [{ text: "OK", style: "default" }]
            )
          ),
        })}
      />
      <Tabs.Screen
        name="trophies"
        options={({ navigation }) => ({
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="trophy" size={size} color={color} />
          ),
          tabBarButton: createTabBarButton(() => navigation.navigate('trophies')),
        })}
      />
      <Tabs.Screen
        name="profile"
        options={({ navigation }) => ({
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="user-alt" size={size} color={color} />
          ),
          tabBarButton: createTabBarButton(() => navigation.navigate('profile')),
        })}
      />
    </Tabs>
  );
}
