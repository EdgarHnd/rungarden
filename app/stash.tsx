import PlantStashSkeleton from '@/components/PlantStashSkeleton';
import { Theme } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { formatDistance, formatPlantDistance, metersToKilometers } from '@/utils/formatters';
import { FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

import { getImageSource } from '@/utils/plantImageMapping';

interface PlantStashItem {
  _id: string;
  name: string;
  emoji: string;
  imagePath?: string;
  distanceRequired: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';
  category: 'flower' | 'bush' | 'tree' | 'desert' | 'mushroom';
  description: string;
  isUnlocked: boolean;
  totalCount: number;
  unplantedCount: number;
  distanceToUnlock: number;
}


export default function StashScreen() {
  const analytics = useAnalytics();
  const navigation = useNavigation();
  const [contentReady, setContentReady] = useState(false);

  // Animation values
  const skeletonOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  // Get comprehensive plant stash data
  const stashData = useQuery(api.plants.getPlantStashData);

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  // Helper function to format distance with km in parentheses for imperial users
  const formatDistanceWithKm = (meters: number) => {
    const formattedDistance = formatDistance(meters, metricSystem);
    if (metricSystem === 'imperial') {
      const km = metersToKilometers(meters);
      return `${formattedDistance} (${km.toFixed(km < 1 ? 1 : 0)}km)`;
    }
    return formattedDistance;
  };

  // Disable swipe back gesture for consistent behavior
  useEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ gestureEnabled: false });
  }, []);

  // Handle smooth transition from skeleton to content
  useEffect(() => {
    if (stashData && profile && !contentReady) {
      // Wait a brief moment to ensure content is ready, then fade transition
      const timer = setTimeout(() => {
        setContentReady(true);
        // Fade out skeleton and fade in content
        skeletonOpacity.value = withTiming(0, { duration: 300 });
        contentOpacity.value = withTiming(1, { duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [stashData, profile, contentReady, skeletonOpacity, contentOpacity]);


  const handlePlantPress = (plant: PlantStashItem) => {
    // Plants are auto-planted, so just show info
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (plant.isUnlocked) {
      // Could show plant details modal here in the future
    } else {
    }
  };


  // Helper function to check if a plant is a milestone
  const isMilestone = (distanceRequired: number) => {
    const milestoneDistances = [5000, 10000, 21000, 42000, 100000]; // 5km, 10km, 21km, 42km, 100km
    return milestoneDistances.includes(distanceRequired);
  };

  const renderPlantItem = ({ item, index }: { item: PlantStashItem; index: number }) => {
    const isLocked = !item.isUnlocked;
    const hasPlants = item.unplantedCount > 0;
    const isHeroPlant = isMilestone(item.distanceRequired);

    return (
      <TouchableOpacity
        style={[
          styles.plantItem,
          isLocked && styles.lockedItem,
          hasPlants && item.isUnlocked && styles.availableItem,
        ]}
        onPress={() => handlePlantPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.plantContainer}>
          {isLocked ? (
            <Image
              source={getImageSource('assets/images/plants/locked.png')}
              style={styles.plantImage}
              resizeMode="contain"
            />
          ) : (
            <Image
              source={getImageSource(item.imagePath, item.distanceRequired)}
              style={styles.plantImage}
              resizeMode="contain"
            />
          )}
          <Text style={[
            styles.plantDistance,
            isHeroPlant && styles.heroDistanceText
          ]}>
            {formatPlantDistance(item.distanceRequired, metricSystem)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const unlockedCount = stashData?.plants.filter(p => p.isUnlocked).length || 0;
  const totalCount = stashData?.plants.length || 100;
  const availablePlants = stashData?.plants.filter(p => p.isUnlocked && p.unplantedCount > 0).length || 0;

  const isLoading = !contentReady;

  // Animated styles
  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skeletonOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <FontAwesome5 name="times" size={20} color={Theme.colors.text.primary} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>Plant Collection</Text>
          <Text style={styles.subtitle}>
            {isLoading ? 'Loading...' : `${unlockedCount}/${totalCount} unlocked`}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Manual plant selection removed - plants auto-planted */}
        </View>
      </View>

      {/* Plant Grid with smooth transition */}
      <View style={styles.contentContainer}>
        {/* Skeleton Loader */}
        <Animated.View style={[styles.absoluteFill, skeletonAnimatedStyle]}>
          <PlantStashSkeleton itemCount={16} />
        </Animated.View>

        {/* Actual Content */}
        <Animated.View style={[styles.absoluteFill, contentAnimatedStyle]}>
          <FlatList
            data={stashData?.plants || []}
            renderItem={renderPlantItem}
            keyExtractor={(item, index) => `${item._id}-${index}`}
            numColumns={2}
            contentContainerStyle={styles.plantGrid}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.row}
          />
        </Animated.View>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  instructionsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  instructionsText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  plantGrid: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: 20, // Reduced padding since no bottom action bar
  },
  row: {
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  plantItem: {
    width: (screenWidth - 40) / 2, // 2 columns with less spacing for larger items
    aspectRatio: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginHorizontal: 6,
    position: 'relative',
  },
  lockedItem: {
    opacity: 0.5,
  },
  availableItem: {
    // Available plants can have subtle highlighting if needed
  },
  plantContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  plantEmojiText: {
    fontSize: 48,
    marginBottom: 4,
  },
  plantImage: {
    width: 120,
    height: 120,
    marginBottom: 4,
  },
  plantDistance: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },
  plantQuantity: {
    fontSize: 8,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    textAlign: 'center',
    marginTop: 1,
  },
  categoryIcon: {
    fontSize: 8,
    textAlign: 'center',
    opacity: 0.6,
  },
  lockedText: {
    color: '#9CA3AF',
  },
  // Milestone styling
  heroEmojiText: {
    fontSize: 64, // Slightly larger for hero plants
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroDistanceText: {
    color: '#DAA520',
    fontFamily: Theme.fonts.bold,
    textShadowColor: 'rgba(255, 215, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
