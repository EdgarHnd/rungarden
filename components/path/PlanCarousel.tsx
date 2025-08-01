import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Animated, Dimensions, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.8;
const SPACING = 0;
const SIDECARD_SPACING = (screenWidth - CARD_WIDTH) / 2;

export default function PlanCarousel({
  planOptions,
  onSelectPlan,
  setSelectedGoalIndex,
  scrollX,
}: {
  planOptions: any[],
  onSelectPlan: (plan: any) => void,
  setSelectedGoalIndex: (index: number) => void,
  scrollX: any,
}) {
  const scrollViewRef = useRef<ScrollView>(null);

  return (
    <Animated.ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.slideshowContainer}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + SPACING}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
      onMomentumScrollBegin={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onMomentumScrollEnd={(event) => {
        const newIndex = Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + SPACING));
        setSelectedGoalIndex(newIndex);
      }}
    >
      {planOptions.map((option, index) => {
        const inputRange = [
          (index - 1) * (CARD_WIDTH + SPACING),
          index * (CARD_WIDTH + SPACING),
          (index + 1) * (CARD_WIDTH + SPACING),
        ];

        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.8, 1, 0.8],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.7, 1, 0.7],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View key={option.value} style={{ transform: [{ scale }], opacity }}>
            <TouchableOpacity
              onPress={() => onSelectPlan(option)}
              disabled={option.disabled}
              activeOpacity={0.8}
            >
              <ImageBackground
                source={option.image}
                style={[styles.planCard, { width: CARD_WIDTH, marginHorizontal: SPACING / 2 }]}
                imageStyle={styles.planCardImageStyle}
              >
                <View style={[styles.planCardOverlay, { backgroundColor: option.disabled ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)' }]}>
                  <Text style={[styles.planCardLevel, { backgroundColor: option.disabled ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)' }]}>{option.level}</Text>
                  <Text style={styles.planCardTitle}>{option.title}</Text>
                  <Text style={styles.planCardButtonSubtitle}>{option.subtitle}</Text>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  planCard: {
    borderColor: Theme.colors.special.secondary.plan,
    borderRadius: 10,
    borderWidth: 0,
    justifyContent: 'flex-end',
    minHeight: 350,
    overflow: 'hidden',
    padding: 24,
  },
  planCardImageStyle: {
    borderRadius: 10,
  },
  planCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  planCardTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 30,
    textAlign: 'center',
  },
  planCardButtonSubtitle: {
    color: Theme.colors.text.primary,
    fontSize: 20,
  },
  planCardLevel: {
    position: 'absolute',
    top: 10,
    right: 10,
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    backgroundColor: Theme.colors.background.secondary + '80',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  slideshowContainer: {
    alignItems: 'center',
    paddingHorizontal: SIDECARD_SPACING - SPACING,
  },
});
