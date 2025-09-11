import { FontAwesome5 } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Dimensions,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import GardenCanvas from '@/components/GardenCanvas';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { DEFAULT_GRID_CONFIG, gridToScreen } from '@/utils/isometricGrid';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PlantInGarden {
  _id: string;
  plantTypeId: string;
  gridPosition?: {
    row: number;
    col: number
  };
  currentStage: number;
  waterLevel?: number;
  isWilted?: boolean;
  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  };
}

// Static plant display component for friend's garden (matches DraggablePlant exactly)
function FriendPlantDisplay({ plant, gridConfig }: { plant: PlantInGarden; gridConfig: any }) {
  const { gridPosition, plantType } = plant;

  if (!gridPosition || !plantType) return null;

  // Use the exact same sizing and positioning as DraggablePlant
  const baseSize = 18;
  const screenPos = gridToScreen(gridPosition, gridConfig);

  // Get grid depth for proper z-index (same as DraggablePlant)
  const gridDepth = gridPosition.row + gridPosition.col;

  return (
    <View
      style={[
        styles.plantContainer,
        {
          left: screenPos.x - baseSize / 2,
          top: screenPos.y - baseSize,
          zIndex: gridDepth,
        },
      ]}
    >
      <View style={styles.plantTouchArea}>
        <View style={styles.plantImageContainer}>
          <Text style={[
            styles.plantEmoji,
            plant.isWilted && styles.wiltedPlant,
          ]}>
            {plantType.emoji || '🌱'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function FriendGardenScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { friendId, friendName } = params;

  // Get specific friend's garden data
  const friendData = useQuery(
    api.friends.getFriendGarden,
    friendId ? { friendId: friendId as any } : 'skip'
  );

  const displayName = friendName as string || 'Friend';
  const plants = friendData?.plants || [];

  // Use the exact same grid config as the main garden - no modifications
  const friendGridConfig = DEFAULT_GRID_CONFIG;

  // Debug logging
  console.log('Friend garden render:', { friendId, friendData, plants: plants.length });

  // Show loading while data is being fetched
  if (friendData === undefined) {
    return <LoadingScreen />;
  }

  // Show error only if we explicitly get null (shouldn't happen with current query)
  if (friendData === null || !friendData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
          >
            <FontAwesome5 name="arrow-left" size={20} color={Theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Garden Not Found</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-triangle" size={64} color={Theme.colors.text.muted} />
          <Text style={styles.errorTitle}>Garden Not Available</Text>
          <Text style={styles.errorMessage}>
            This friend's garden could not be loaded.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
        >
          <FontAwesome5 name="arrow-left" size={20} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{displayName}'s Garden</Text>
          <Text style={styles.subtitle}>
            {plants.length} plant{plants.length !== 1 ? 's' : ''} growing
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Garden Canvas - Full screen with zoom and pan */}
      <GardenCanvas
        key={`${friendId}-${Date.now()}`} // Force completely fresh instance
        onGridTap={() => { }} // No interactions in friend's garden
        showGrid={true}
      >
        {/* Render friend's plants */}
        {plants.map((plant) => (
          <FriendPlantDisplay
            key={plant._id}
            plant={plant as PlantInGarden}
            gridConfig={DEFAULT_GRID_CONFIG}
          />
        ))}
      </GardenCanvas>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <FontAwesome5 name="info-circle" size={16} color={Theme.colors.text.secondary} />
        <Text style={styles.infoBannerText}>
          You're exploring {displayName}'s garden. Zoom and pan to look around!
        </Text>
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
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background.secondary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Theme.shadows.small,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  placeholder: {
    width: 40, // Same as back button for balance
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: Theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  plantContainer: {
    position: 'absolute',
  },
  plantTouchArea: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plantEmoji: {
    fontSize: 14,
    textAlign: 'center',
  },
  wiltedPlant: {
    opacity: 0.6,
  },
  infoBanner: {
    position: 'absolute',
    bottom: 100, // Above tab bar
    left: 20,
    right: 20,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Theme.shadows.small,
  },
  infoBannerText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: Theme.colors.text.secondary,
    marginLeft: 8,
    flex: 1,
  },
});
