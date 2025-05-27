import { FontAwesome5 } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function AppLayout() {
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
