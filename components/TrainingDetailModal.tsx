import React from 'react';
import {
  Modal,
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

interface TrainingDetailModalProps {
  activity: Activity | null;
  isVisible: boolean;
  onClose: () => void;
}

export default function TrainingDetailModal({
  activity,
  isVisible,
  onClose,
}: TrainingDetailModalProps) {
  if (!activity) return null;

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
        return 'A comfortable effort where you can maintain a conversation throughout the activity. Perfect for building aerobic base and recovery.';
      case 'Medium':
        return 'A moderate effort that challenges you but remains sustainable. You should feel worked but not exhausted.';
      case 'Hard':
        return 'A challenging effort that pushes your limits. You\'ll be breathing hard and this should feel tough but achievable.';
      default:
        return 'Follow your body\'s signals and adjust intensity as needed.';
    }
  };

  const getTrainingTips = (activity: Activity) => {
    const tips = [];

    if (activity.type === 'run') {
      tips.push('Warm up with 5-10 minutes of easy walking or light jogging');
      tips.push('Stay hydrated before, during, and after your run');
      tips.push('Cool down with gentle walking and stretching');

      if (activity.intensity === 'Easy') {
        tips.push('Focus on maintaining a comfortable, conversational pace');
        tips.push('This should feel relaxed and enjoyable');
      } else if (activity.intensity === 'Hard') {
        tips.push('Listen to your body and don\'t push through pain');
        tips.push('Allow adequate recovery time after this session');
      }
    } else {
      tips.push('Focus on gentle movement and stretching');
      tips.push('Take time to breathe deeply and relax');
      tips.push('Don\'t skip rest days - they\'re crucial for improvement');
      tips.push('Consider light activities like yoga or walking');
    }

    return tips;
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
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
          <View style={styles.quickStatsContainer}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{activity.duration}</Text>
              <Text style={styles.quickStatLabel}>Duration</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>
                {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
              </Text>
              <Text style={styles.quickStatLabel}>Activity Type</Text>
            </View>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{activity.intensity}</Text>
              <Text style={styles.quickStatLabel}>Intensity</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workout Description</Text>
            <View style={styles.card}>
              <Text style={styles.description}>{activity.description}</Text>
            </View>
          </View>

          {/* Intensity Guide */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Intensity Guide</Text>
            <View style={styles.card}>
              <Text style={styles.intensityGuideText}>
                {getIntensityDescription(activity.intensity)}
              </Text>
            </View>
          </View>

          {/* Training Tips */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training Tips</Text>
            <View style={styles.card}>
              {getTrainingTips(activity).map((tip, index) => (
                <View key={index} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why This Workout?</Text>
            <View style={styles.card}>
              <Text style={styles.benefitsText}>
                {activity.type === 'run'
                  ? `This ${activity.intensity.toLowerCase()} run helps build your cardiovascular fitness, strengthens your running muscles, and improves your overall endurance. ${activity.intensity === 'Easy' ? 'Easy runs form the foundation of any good training program.' : activity.intensity === 'Hard' ? 'High-intensity workouts boost your speed and power.' : 'Moderate efforts help bridge easy and hard training zones.'}`
                  : 'Rest and recovery days are just as important as training days. They allow your body to adapt to training stress, rebuild stronger, and prevent injury. Active recovery helps maintain movement while giving your body the break it needs.'
                }
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontFamily: 'SF-Pro-Rounded-Medium',
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
    fontSize: 16,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  intensityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  intensityText: {
    fontSize: 14,
    color: 'white',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#007AFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickStatLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF-Pro-Rounded-Medium',
    textAlign: 'center',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  intensityGuideText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  tipBullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 12,
    marginTop: 2,
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  tipText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    fontFamily: 'SF-Pro-Rounded-Regular',
    flex: 1,
  },
  benefitsText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    fontFamily: 'SF-Pro-Rounded-Regular',
  },
}); 