import { Theme } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDistance } from '@/utils/formatters';
import { FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

interface PlantStashItem {
  _id: string;
  name: string;
  emoji: string;
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
  const navigation = useNavigation();
  const [selectedPlant, setSelectedPlant] = useState<PlantStashItem | null>(null);

  // Get comprehensive plant stash data
  const stashData = useQuery(api.plants.getPlantStashData);

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  // Disable swipe back gesture for consistent behavior
  useEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ gestureEnabled: false });
  }, []);


  const handlePlantPress = (plant: PlantStashItem) => {
    // Plants are auto-planted, so just show info
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (plant.isUnlocked) {
      // Could show plant details modal here in the future
      console.log(`Viewing ${plant.name} - unlocked by ${plant.distanceRequired / 1000}km runs`);
    } else {
      console.log(`${plant.name} locked - need ${plant.distanceToUnlock}km run to unlock`);
    }
  };

  const handleSelectPlant = () => {
    if (selectedPlant) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Navigate back to garden with selected plant data
      router.back();
      // Use a simple global state or event system for now
      // In a production app, you'd use a proper state management solution
      if ((global as any).onPlantSelected) {
        (global as any).onPlantSelected(selectedPlant);
      }
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
    const isSelected = selectedPlant?._id === item._id;
    const isHeroPlant = isMilestone(item.distanceRequired);

    return (
      <TouchableOpacity
        style={[
          styles.plantItem,
          isLocked && styles.lockedItem,
          hasPlants && item.isUnlocked && styles.availableItem,
          isSelected && styles.selectedItem
        ]}
        onPress={() => handlePlantPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.plantContainer}>
          <Text style={[
            styles.plantEmojiText,
            isHeroPlant && styles.heroEmojiText
          ]}>
            {isLocked ? '🔒' : item.emoji}
          </Text>
          <Text style={[
            styles.plantDistance,
            isHeroPlant && styles.heroDistanceText
          ]}>
            {formatDistance(item.distanceRequired, metricSystem)}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIndicatorText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const unlockedCount = stashData?.plants.filter(p => p.isUnlocked).length || 0;
  const totalCount = stashData?.plants.length || 100;
  const availablePlants = stashData?.plants.filter(p => p.isUnlocked && p.unplantedCount > 0).length || 0;

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
            {unlockedCount}/{totalCount} unlocked
          </Text>
        </View>

        <View style={styles.headerRight}>
          {selectedPlant && (
            <TouchableOpacity onPress={handleSelectPlant} style={styles.selectButton}>
              <Text style={styles.selectButtonText}>Select</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Plant Grid */}
      <FlatList
        data={stashData?.plants || []}
        renderItem={renderPlantItem}
        keyExtractor={(item, index) => `${item._id}-${index}`}
        numColumns={2}
        contentContainerStyle={styles.plantGrid}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
      />

      {/* Bottom Action Bar */}
      {selectedPlant && (
        <View style={styles.bottomActionBar}>
          <View style={styles.selectedPlantInfo}>
            <Text style={styles.selectedPlantEmoji}>{selectedPlant.emoji}</Text>
            <View style={styles.selectedPlantDetails}>
              <Text style={styles.selectedPlantName}>{selectedPlant.name}</Text>
              <Text style={styles.selectedPlantMeta}>
                {selectedPlant.rarity} • {selectedPlant.unplantedCount} available
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleSelectPlant} style={styles.plantButton}>
            <Text style={styles.plantButtonText}>Plant</Text>
          </TouchableOpacity>
        </View>
      )}
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
  selectButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  selectButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.background.primary,
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
    paddingBottom: 120, // Extra padding for bottom action bar
  },
  row: {
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  plantItem: {
    width: (screenWidth - 60) / 2, // 2 columns with spacing
    aspectRatio: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginHorizontal: 8,
    position: 'relative',
  },
  lockedItem: {
    opacity: 0.5,
  },
  availableItem: {
    // Available plants can have subtle highlighting if needed
  },
  selectedItem: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 8,
  },
  plantContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  plantEmojiText: {
    fontSize: 28,
    marginBottom: 2,
  },
  plantDistance: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
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
  selectedIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Theme.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicatorText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontFamily: Theme.fonts.bold,
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34, // Safe area padding
  },
  selectedPlantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedPlantEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  selectedPlantDetails: {
    flex: 1,
  },
  selectedPlantName: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  selectedPlantMeta: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textTransform: 'capitalize',
  },
  plantButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  plantButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.background.primary,
  },
  // Milestone styling
  heroEmojiText: {
    fontSize: 32, // Slightly larger for hero plants
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
