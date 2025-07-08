import RecordingModal from '@/components/modals/RecordingModal';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useTrackNavigation } from '@/hooks/useTrackNavigation';
import { FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

function LeaderboardIcon({ color, size }: { color: string; size: number }) {
  const pending = useQuery(api.friends.getPendingFriendRequests);
  const hasPending = (pending?.length ?? 0) > 0;
  return (
    <View style={{ position: 'relative' }}>
      <FontAwesome5 name="trophy" size={size} color={color} />
      {hasPending && (
        <View style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: Theme.colors.special.primary.heart,
        }} />
      )}
    </View>
  );
}

export default function AppLayout() {
  useTrackNavigation();
  const [showRecordingModal, setShowRecordingModal] = useState(false);

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
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            backgroundColor: Theme.colors.background.primary,
            height: 80,
            paddingBottom: 0,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarBackground: () => (
            <View

            >
              <LinearGradient
                colors={[Theme.colors.background.primary + '00', Theme.colors.background.primary]}
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
            </View>
          ),
          tabBarShowLabel: false,
          tabBarActiveTintColor: Theme.colors.accent.primary,
          tabBarIconStyle: {
            marginTop: 10,
          },
          tabBarInactiveTintColor: Theme.colors.text.muted,
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
              <FontAwesome5 name="calendar-alt" size={size} color={color} />
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
                backgroundColor: Theme.colors.accent.primary,
                borderRadius: Theme.borderRadius.full,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <FontAwesome5 name="circle" size={40} color={Theme.colors.text.primary} />
              </View>
            ),
            tabBarButton: createTabBarButton(() => setShowRecordingModal(true)),
          })}
        />
        <Tabs.Screen
          name="leaderboard"
          options={({ navigation }) => ({
            tabBarIcon: ({ color, size }) => (
              <LeaderboardIcon color={color as string} size={size as number} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('leaderboard')),
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

      {/* Recording Modal */}
      <RecordingModal
        visible={showRecordingModal}
        onClose={() => setShowRecordingModal(false)}
      />
    </>
  );
}
