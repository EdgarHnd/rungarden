import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useTrackNavigation } from '@/hooks/useTrackNavigation';
import { FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Tabs, usePathname } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';



export default function AppLayout() {
  useTrackNavigation();
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const pathname = usePathname();

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

  // Check if we're on the index screen
  const isOnIndexScreen = pathname === '/' || pathname === '/index';

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
          tabBarShowLabel: false,
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
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="users" size={size} color={color} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('leaderboard')),
          })}
        />
        <Tabs.Screen
          name="index"
          options={({ navigation }) => ({
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="seedling" size={size} color={color} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('index')),
          })}
        />
        <Tabs.Screen
          name="profile"
          options={({ navigation }) => ({
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="user" solid size={size} color={color} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('profile')),
          })}
        />
      </Tabs>

      {/* Floating Record Run Button - Only show on index screen */}
      {isOnIndexScreen && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/run');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingButtonText}>Record Run</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    transform: [{ translateX: -75 }],
    width: 150,
    height: 50,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  floatingButtonText: {
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.background.primary,
  },
});
