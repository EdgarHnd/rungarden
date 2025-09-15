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

import DraggablePlant from '@/components/DraggablePlant';
import GardenCanvas from '@/components/GardenCanvas';
import IsometricPlatform from '@/components/IsometricPlatform';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { DEFAULT_GRID_CONFIG } from '@/utils/isometricGrid';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PlantInGarden {
  _id: string;
  plantTypeId: string;
  gridPosition?: { row: number; col: number };
  currentStage: number;
  waterLevel: number;
  isWilted: boolean;
  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  };
}

export default function FriendGardenScreen() {
  const router = useRouter();
  const { friendId } = useLocalSearchParams();
  const friendName = useLocalSearchParams().friendName as string;

  // Get specific friend's garden data
  const friendData = useQuery(
    api.friends.getFriendGarden,
    friendId ? { friendId: friendId as any } : 'skip'
  );

  const displayName = friendName as string || 'Friend';
  const plants = friendData?.plants || [];

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

      {/* Garden Canvas */}
      <GardenCanvas
        onGridTap={() => { }}
        onDoubleTap={() => { }}
        unlockedTiles={[]}
        showGrid={false}
        enableZoom={false}
      >
        {/* Isometric platform (background) */}
        <IsometricPlatform
          gridConfig={DEFAULT_GRID_CONFIG}
        />

        {/* Render friend's plants */}
        {plants.map((plant) => (
          <DraggablePlant
            key={plant._id}
            plant={plant as any}
            onGridPositionChange={() => { }}
            onPlantTap={() => { }}
            unlockedTiles={[]}
          />
        ))}
      </GardenCanvas>
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
    justifyContent: 'center',
    alignItems: 'center',
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
  gardenContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
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
