import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Challenge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  reward: string;
}

export default function ChallengesModal() {
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? "metric") === "metric";

  // Dynamic challenges based on metric preference
  const challenges: Challenge[] = [
    // Time-based
    { id: '1', emoji: '🐓', name: 'Early Bird', description: 'Run before 7 AM', reward: 'Rooster hat' },
    { id: '2', emoji: '🍱', name: 'Lunch Runner', description: 'Run at noon', reward: 'Lunchbox accessory' },
    { id: '3', emoji: '🌙', name: 'Midnight', description: 'Run exactly at midnight', reward: 'Moon outfit' },

    // Weather & Environment
    { id: '4', emoji: '🔥', name: 'Hot Hero', description: isMetric ? 'Run above 30°C' : 'Run above 86°F', reward: 'Sunhat' },
    { id: '5', emoji: '❄️', name: 'Snow Runner', description: 'Run in snow', reward: 'Winter coat' },
    { id: '6', emoji: '💨', name: 'Wind Warrior', description: 'Run in windy conditions', reward: 'Kite accessory' },
    { id: '7', emoji: '⛈️', name: 'Storm Chaser', description: 'Run during storm', reward: 'Lightning cape' },

    // Location & Exploration
    { id: '8', emoji: '🌳', name: 'Park Explorer', description: 'Run in 3 different parks', reward: 'Leafy headband' },
    { id: '9', emoji: '🏙️', name: 'Urban Runner', description: 'Run in downtown area', reward: 'City skyline T-shirt' },
    { id: '10', emoji: '🏖️', name: 'Beach Runner', description: 'Run along the beach', reward: 'Surfboard accessory' },

    // Consistency & Habit Formation
    { id: '11', emoji: '⚔️', name: 'Weekly Warrior', description: 'Daily runs for one week', reward: 'Warrior helmet' },
    { id: '12', emoji: '👑', name: 'Monthly Master', description: 'Goals 4 weeks in a row', reward: 'Golden running shoes' },
    { id: '13', emoji: '🏆', name: 'Quarterly Champ', description: 'Achieve 90-day streak', reward: 'Crown accessory' },

    // Distance & Cumulative
    { id: '14', emoji: '🧦', name: isMetric ? '20km Club' : '12mi Club', description: isMetric ? '20 km cumulative' : '12 mi cumulative', reward: 'Neon socks' },
    { id: '15', emoji: '🩳', name: isMetric ? '50km Club' : '31mi Club', description: isMetric ? '50 km cumulative' : '31 mi cumulative', reward: 'Camouflage shorts' },
    { id: '16', emoji: '🪶', name: isMetric ? '200km Club' : '124mi Club', description: isMetric ? '200 km cumulative' : '124 mi cumulative', reward: 'Wings accessory' },
    { id: '17', emoji: '🦘', name: isMetric ? '500km Club' : '311mi Club', description: isMetric ? '500 km cumulative' : '311 mi cumulative', reward: 'Koala superhero costume' },

    // Intensity & Speed
    { id: '18', emoji: '⏱️', name: 'PB Breaker', description: 'Beat your personal best', reward: 'Stopwatch necklace' },
    { id: '19', emoji: '⚡', name: 'Speed Demon', description: isMetric ? '1 km under 6 minutes' : '1 mi under 9:39', reward: 'Flash lightning shoes' },
    { id: '20', emoji: '🏃', name: 'Interval Master', description: 'Complete 5 interval runs', reward: 'Race bib accessory' },

    // Special Events
    { id: '21', emoji: '🎂', name: 'Birthday Run', description: 'Run on your birthday', reward: 'Birthday cake hat' },
    { id: '22', emoji: '🎃', name: 'Halloween Run', description: 'Run on Halloween', reward: 'Pumpkin costume' },
    { id: '23', emoji: '🎄', name: 'Christmas Run', description: 'Run on Christmas Eve', reward: 'Reindeer antlers' },
    { id: '24', emoji: '💕', name: 'Valentine Run', description: 'Run on Valentine\'s Day', reward: 'Heart-shaped sunglasses' },
  ];

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleChallengePress = (challenge: Challenge) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      challenge.name,
      `${challenge.description}\n\nReward: ${challenge.reward}`,
      [{ text: 'Got it!', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏅 Challenges</Text>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {challenges.map((challenge) => (
            <TouchableOpacity
              key={challenge.id}
              style={styles.challengeCard}
              onPress={() => handleChallengePress(challenge)}
              activeOpacity={0.7}
            >
              <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
              <Text style={styles.challengeName}>{challenge.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>🚀 More Coming Soon!</Text>
          <Text style={styles.footerSubtitle}>
            New challenges added regularly. Keep running!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  closeButton: {
    padding: Theme.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: Theme.spacing.xl,
  },
  challengeCard: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    marginBottom: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeEmoji: {
    fontSize: 32,
    marginBottom: Theme.spacing.sm,
  },
  challengeName: {
    fontSize: 12,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footer: {
    alignItems: 'center',
    padding: Theme.spacing.xl,
    marginTop: Theme.spacing.xl,
    marginBottom: 40,
  },
  footerTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  footerSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 