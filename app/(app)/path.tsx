import { api } from '@/convex/_generated/api';
import { formatDistance } from '@/utils/formatters';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface ActivityWithPlant {
  _id: string;
  startDate: string;
  distance: number;
  duration: number;
  calories: number;
  workoutName?: string;
  plantEarned?: string;
  source?: string;
}

interface DayData {
  date: string;
  activities: ActivityWithPlant[];
  plantsEarned: any[];
}

export default function ActivitiesScreen() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Get user's activities and plants
  const activities = useQuery(api.activities.getUserActivities, { days: 90, limit: 200 });
  const userPlants = useQuery(api.plants.getUserPlants);

  // Get the most recent activity for "Last run" display
  const lastRun = useMemo(() => {
    if (!activities || activities.length === 0) return null;
    return activities[0]; // Activities are typically sorted by date descending
  }, [activities]);

  // Get plant associated with the last run
  const lastRunPlant = useMemo(() => {
    if (!lastRun || !userPlants) return null;

    // Find the plant that was earned from the last run
    const plant = userPlants.find((plant: any) =>
      plant.earnedFromActivityId === lastRun._id
    );

    return plant;
  }, [lastRun, userPlants]);

  // Generate calendar days for the selected month
  const calendarDays = useMemo(() => {
    if (!activities || !userPlants) return [];

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days: DayData[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];

      // Find activities for this day
      const dayActivities = activities.filter((activity: ActivityWithPlant) => {
        const activityDate = new Date(activity.startDate).toISOString().split('T')[0];
        return activityDate === dateStr;
      });

      // Find plants earned on this day
      const plantsEarned = userPlants.filter((plant: any) => {
        if (!plant.earnedFromActivity) return false;
        const plantDate = new Date(plant.earnedFromActivity.startDate).toISOString().split('T')[0];
        return plantDate === dateStr;
      });

      days.push({
        date: dateStr,
        activities: dayActivities,
        plantsEarned,
      });
    }

    return days;
  }, [selectedMonth, activities, userPlants]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  const showDayDetails = (day: DayData) => {
    if (day.activities.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If there's only one activity, navigate directly to detail page
    if (day.activities.length === 1) {
      router.push({
        pathname: '/activity-detail',
        params: {
          id: day.activities[0]._id
        }
      });
      return;
    }

    // If multiple activities, show alert with option to view each
    const totalDistance = day.activities.reduce((sum, act) => sum + act.distance, 0);
    const totalDuration = day.activities.reduce((sum, act) => sum + act.duration, 0);
    const plantsText = day.plantsEarned.length > 0
      ? `\n\n🌱 Plants earned: ${day.plantsEarned.map(p => p.plantType?.emoji || '🌱').join(' ')}`
      : '';

    Alert.alert(
      `📅 ${new Date(day.date).toLocaleDateString()}`,
      `🏃‍♂️ ${day.activities.length} runs\n` +
      `📏 ${formatDistance(totalDistance, 'metric')}\n` +
      `⏱️ ${Math.round(totalDuration)} minutes\n` +
      `🔥 ${day.activities.reduce((sum, act) => sum + act.calories, 0)} calories` +
      plantsText,
      [
        { text: 'Cancel', style: 'cancel' },
        ...day.activities.map((activity, index) => ({
          text: `View Run ${index + 1}`,
          onPress: () => {
            router.push({
              pathname: '/activity-detail',
              params: {
                id: activity._id
              }
            });
          }
        }))
      ]
    );
  };



  const getPlantEmoji = (day: DayData) => {
    if (day.plantsEarned.length === 0) return null;
    return day.plantsEarned[0]?.plantType?.emoji || '🌱';
  };

  const monthName = selectedMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedMonth.getMonth() === now.getMonth() &&
      selectedMonth.getFullYear() === now.getFullYear();
  }, [selectedMonth]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.title}>Last run</Text>

          {/* Last Run Card */}
          {lastRun && (
            <TouchableOpacity
              style={styles.lastRunCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/activity-detail',
                  params: {
                    id: lastRun._id
                  }
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.dayOfWeek}>
                {new Date(lastRun.startDate).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              <Text style={styles.runDate}>
                {new Date(lastRun.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>

              {/* Plant Illustration */}
              <View style={styles.treeContainer}>
                <Text style={styles.treeEmoji}>
                  {lastRunPlant?.plantType?.emoji || '🌳'}
                </Text>
              </View>

              <Text style={styles.distanceText}>
                DISTANCE {formatDistance(lastRun.distance, 'metric')}
              </Text>
              <Text style={styles.paceText}>
                PACE {lastRun.duration > 0 ? Math.round((lastRun.duration / 60) / (lastRun.distance / 1000)) : 0}:{String(Math.round(((lastRun.duration / 60) / (lastRun.distance / 1000) % 1) * 60)).padStart(2, '0')} /km
              </Text>
            </TouchableOpacity>
          )}

          {/* Month Navigation */}
          <View style={styles.monthNavigation}>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => navigateMonth('prev')}
            >
              <Text style={styles.monthButtonText}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.monthTitle}>{isCurrentMonth ? 'This month' : monthName}</Text>

            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => navigateMonth('next')}
            >
              <Text style={styles.monthButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {/* Add empty cells for first week offset */}
            {Array.from({ length: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay() }, (_, i) => (
              <View key={`empty-${i}`} style={styles.calendarDay} />
            ))}

            {calendarDays.map((day, index) => {
              const plantEmoji = getPlantEmoji(day);
              const hasActivity = day.activities.length > 0;
              const dayNumber = new Date(day.date).getDate();

              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.calendarDay,
                    hasActivity && styles.calendarDayWithActivity,
                    plantEmoji && styles.calendarDayWithPlant
                  ]}
                  onPress={() => showDayDetails(day)}
                  disabled={!hasActivity}
                  activeOpacity={0.7}
                >
                  {plantEmoji ? (
                    <Text style={styles.dayPlantEmoji}>{plantEmoji}</Text>
                  ) : (
                    <Text style={[
                      styles.dayNumber,
                      hasActivity && styles.dayNumberActive
                    ]}>
                      {dayNumber}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 100, // Space for tab bar
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Black',
    color: '#000000',
    marginBottom: 24,
  },
  lastRunCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 3,
    borderColor: '#000000',
  },
  dayOfWeek: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  runDate: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    marginBottom: 20,
  },
  treeContainer: {
    marginVertical: 20,
  },
  treeEmoji: {
    fontSize: 80,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginTop: 20,
    marginBottom: 4,
    letterSpacing: 1,
  },
  paceText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    letterSpacing: 1,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  monthButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  calendarDay: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 20,
  },
  calendarDayWithActivity: {
    //backgroundColor: '#B8E6B8', // Light green background for activity days
  },
  calendarDayWithPlant: {
    //backgroundColor: '#A8D8A8', // Slightly darker green for plant days
  },
  dayNumber: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#666666',
  },
  dayNumberActive: {
    color: '#000000',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  dayPlantEmoji: {
    fontSize: 24,
  },
}); 
