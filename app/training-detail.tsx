import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Activity {
  type: 'run' | 'rest';
  title: string;
  description: string;
  duration: string;
  intensity: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
}

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams();
  const [activity, setActivity] = useState<Activity | null>(null);

  useEffect(() => {
    if (params.activity) {
      try {
        const activityData = JSON.parse(params.activity as string);
        setActivity(activityData);
      } catch (error) {
        console.error('Error parsing training data:', error);
        router.back();
      }
    }
  }, [params.activity]);

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'Easy': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Hard': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getIntensityDescription = (intensity: string) => {
    switch (intensity) {
      case 'Easy':
        return 'Light effort, you should be able to hold a conversation comfortably.';
      case 'Medium':
        return 'Moderate effort, breathing should be slightly elevated but controlled.';
      case 'Hard':
        return 'High effort, this should feel challenging and push your limits.';
      default:
        return 'Adjust effort based on how you feel today.';
    }
  };

  const getTips = (activity: Activity) => {
    switch (activity.type) {
      case 'run':
        return [
          'Start with a 5-10 minute warm-up walk',
          'Stay hydrated throughout your run',
          'Listen to your body and adjust pace as needed',
          'Cool down with gentle stretching',
        ];
      case 'rest':
        return [
          'Focus on deep, controlled breathing',
          'Hold each stretch for 20-30 seconds',
          'Don\'t push beyond mild discomfort',
          'Take time to relax and recover',
        ];
      default:
        return [];
    }
  };

  if (!activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }} style={styles.backButton}>
          <Ionicons name="chevron-back-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Training Plan</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Activity Title */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <Text style={styles.activityEmoji}>{activity.emoji}</Text>
            <View style={styles.titleText}>
              <Text style={styles.activityTitle}>{activity.title}</Text>
              <Text style={styles.activitySubtitle}>Today's suggested workout</Text>
            </View>
            <View style={[styles.intensityBadge, { backgroundColor: getIntensityColor(activity.intensity) }]}>
              <Text style={styles.intensityText}>{activity.intensity}</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatLabel}>Duration</Text>
            <Text style={styles.quickStatValue}>{activity.duration}</Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatLabel}>Type</Text>
            <Text style={styles.quickStatValue}>
              {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
            </Text>
          </View>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatLabel}>Intensity</Text>
            <Text style={styles.quickStatValue}>{activity.intensity}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>About This Workout</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>{activity.description}</Text>
          </View>
        </View>

        {/* Intensity Guide */}
        <View style={styles.intensitySection}>
          <Text style={styles.sectionTitle}>Intensity Guide</Text>
          <View style={styles.intensityCard}>
            <View style={styles.intensityHeader}>
              <View style={[styles.intensityDot, { backgroundColor: getIntensityColor(activity.intensity) }]} />
              <Text style={styles.intensityTitle}>{activity.intensity} Effort</Text>
            </View>
            <Text style={styles.intensityDescription}>
              {getIntensityDescription(activity.intensity)}
            </Text>
          </View>
        </View>

        {/* Tips & Guidelines */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Tips & Guidelines</Text>
          {getTips(activity).map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Text style={styles.tipIconText}>💡</Text>
              </View>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Progress Placeholder */}
        <View style={styles.progressSection}>
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
          <View style={styles.progressCard}>
            <Text style={styles.progressText}>
              Complete this workout to contribute to your weekly training goal!
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '60%' }]} />
            </View>
            <Text style={styles.progressLabel}>4 of 7 activities this week</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontFamily: 'SF-Pro-Rounded-Medium',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  titleSection: {
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  titleText: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  intensityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  intensityText: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#fff',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
    marginBottom: 4,
  },
  quickStatValue: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  descriptionSection: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 12,
  },
  descriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  descriptionText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'SF-Pro-Rounded-Regular',
    lineHeight: 24,
  },
  intensitySection: {
    margin: 16,
  },
  intensityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  intensityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  intensityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  intensityTitle: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#333',
  },
  intensityDescription: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Regular',
    lineHeight: 20,
  },
  tipsSection: {
    margin: 16,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tipIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  tipIconText: {
    fontSize: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontFamily: 'SF-Pro-Rounded-Regular',
    lineHeight: 20,
  },
  progressSection: {
    margin: 16,
    marginBottom: 32,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Regular',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBar: {
    backgroundColor: '#e5e5e7',
    borderRadius: 8,
    height: 8,
    marginBottom: 8,
  },
  progressFill: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    height: '100%',
  },
  progressLabel: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
    textAlign: 'center',
  },
  loading: {
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
    color: '#666',
  },
}); 