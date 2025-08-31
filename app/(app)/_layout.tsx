import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useTrackNavigation } from '@/hooks/useTrackNavigation';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';



export default function AppLayout() {
  useTrackNavigation();
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const profile = useQuery(api.userProfile.getOrCreateProfile);

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
            paddingBottom: 20,
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
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 16,
            fontFamily: 'SF-Pro-Rounded-Medium',
            marginTop: 5,
          },
          tabBarActiveTintColor: Theme.colors.accent.primary,
          tabBarInactiveTintColor: Theme.colors.text.muted,
        }}
      >
        <Tabs.Screen
          name="leaderboard"
          options={({ navigation }) => ({
            title: 'feed',
            tabBarIcon: () => null,
            tabBarButton: createTabBarButton(() => navigation.navigate('leaderboard')),
            tabBarLabelStyle: {
              fontSize: 24,
              fontFamily: 'Times',
              fontWeight: '400',
              bottom: 20,
            },
          })}
        />
        <Tabs.Screen
          name="index"
          options={({ navigation }) => ({
            title: 'garden',
            tabBarIcon: () => null,
            tabBarButton: createTabBarButton(() => navigation.navigate('index')),
            tabBarLabelStyle: {
              fontSize: 24,
              fontFamily: 'Times',
              bottom: 20,
              fontWeight: '400',
            },
          })}
        />
        <Tabs.Screen
          name="profile"
          options={({ navigation }) => ({
            title: 'profile',
            tabBarIcon: () => null,
            tabBarButton: createTabBarButton(() => navigation.navigate('profile')),
            tabBarLabelStyle: {
              fontSize: 24,
              fontFamily: 'Times',
              fontWeight: '400',
              bottom: 20,
            },
          })}
        />
      </Tabs>
    </>
  );
}
