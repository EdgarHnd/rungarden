import Theme from '@/constants/theme';
import { getActivityType } from '@/constants/types';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DayData {
  date: string;
  activities: any[];
  plannedWorkout?: any | null;
  weekIndex: number;
  isRestDayCompleted?: boolean;
}

interface WeekViewHorizontalProps {
  dayData: DayData[];
  currentDayIndex: number;
  onDaySelect: (dayIndex: number) => void;
  onSelectedPositionChange?: (position: number) => void; // New prop to track position
}

export default function WeekViewHorizontal({
  dayData,
  currentDayIndex,
  onDaySelect,
  onSelectedPositionChange
}: WeekViewHorizontalProps) {
  // Find today's actual date and index in the data
  const today = new Date();
  const todayString = today.toDateString();

  // Find today's index in the dayData array
  const todayIndex = dayData.findIndex(day => {
    const dayDate = new Date(day.date);
    return dayDate.toDateString() === todayString;
  });

  // Center the view around today with 2 days before and 2 days after
  let centerIndex = todayIndex;

  // If today is not found, fallback to selected day
  if (centerIndex === -1) {
    centerIndex = currentDayIndex;
  }

  // Calculate start and end indices for 5-day view centered on today
  let startIndex = Math.max(0, centerIndex - 2); // 2 days before today
  let endIndex = Math.min(dayData.length, startIndex + 5); // 5 days total

  // Adjust if we're near the beginning or end of the data
  if (endIndex - startIndex < 5) {
    if (startIndex === 0) {
      // Near beginning, extend end if possible
      endIndex = Math.min(dayData.length, startIndex + 5);
    } else {
      // Near end, adjust start
      startIndex = Math.max(0, endIndex - 5);
    }
  }

  const displayDays = dayData.slice(startIndex, endIndex);

  const getDayLabel = (dateString: string): string => {
    const date = new Date(dateString);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames[date.getDay()];
  };

  const getDayNumber = (dateString: string): string => {
    const date = new Date(dateString);
    return date.getDate().toString().padStart(2, '0');
  };

  const isToday = (dateString: string): boolean => {
    const today = new Date();
    const date = new Date(dateString);
    return today.toDateString() === date.toDateString();
  };

  const hasActivity = (dayData: DayData): boolean => {
    return dayData.activities && dayData.activities.length > 0;
  };

  const getActivityIcon = (dayData: DayData): { name: string; color: string } => {
    if (hasActivity(dayData)) {
      return { name: 'fire', color: '#FF6B35' }; // Fire icon for completed activities
    }

    const workoutType = getActivityType(dayData.plannedWorkout);
    if (workoutType === 'rest') {
      return { name: 'bed', color: Theme.colors.text.primary }; // Bed icon for planned rest
    }

    return { name: 'running', color: Theme.colors.text.primary }; // Running icon for planned runs
  };

  const renderActivityIcon = (day: DayData, isSelected: boolean) => {
    const iconData = getActivityIcon(day);
    return (
      <FontAwesome5
        name={iconData.name}
        size={16}
        color={iconData.color}
        style={[styles.activityIcon, isSelected && styles.selectedDayIcon, isToday(day.date) && styles.todayDayIcon]}
      />
    );
  };

  const DayCard = ({ day, globalIndex, isSelected, isDayToday, positionIndex }: {
    day: DayData;
    globalIndex: number;
    isSelected: boolean;
    isDayToday: boolean;
    positionIndex: number;
  }) => {
    const scaleAnim = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    // Notify parent of selected position when this card is selected
    React.useEffect(() => {
      if (isSelected && onSelectedPositionChange) {
        onSelectedPositionChange(positionIndex);
      }
    }, [isSelected, positionIndex]);

    if (isSelected) {
      return (
        <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity
            onPress={() => onDaySelect(globalIndex)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
          >
            <View
              style={[styles.dayCard, styles.selectedDayCard]}
            >
              <View style={styles.dateContainer}>
                <Text style={[styles.dayLabel, styles.selectedDayLabel]}>
                  {getDayLabel(day.date)}
                </Text>

                <Text style={[styles.dayNumber, styles.selectedDayNumber]}>
                  {getDayNumber(day.date)}
                </Text>
              </View>

              {renderActivityIcon(day, isSelected)}
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={() => onDaySelect(globalIndex)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <LinearGradient colors={[Theme.colors.background.tertiary, Theme.colors.background.primary]} style={[
            styles.dayCard,
            isDayToday && styles.todayDayCard,
          ]}>
            <View style={styles.dateContainer}>
              <Text style={[
                styles.dayLabel,
                isDayToday && styles.todayDayLabel,
              ]}>
                {getDayLabel(day.date)}
              </Text>

              <Text style={[
                styles.dayNumber,
                isDayToday && styles.todayDayNumber,
              ]}>
                {getDayNumber(day.date)}
              </Text>
            </View>

            {renderActivityIcon(day, isSelected)}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.scrollContainer}
      >
        {displayDays.map((day, index) => {
          const globalIndex = startIndex + index; // Use startIndex to calculate global index
          const isSelected = globalIndex === currentDayIndex;
          const isDayToday = isToday(day.date);

          return (
            <DayCard
              key={day.date}
              day={day}
              globalIndex={globalIndex}
              isSelected={isSelected}
              isDayToday={isDayToday}
              positionIndex={index} // Pass the position within the 5-day view
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background.primary,
  },
  scrollContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xs,
  },
  dayCard: {
    width: 65,
    height: 120,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 30, // Increased corner radius
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Theme.spacing.lg,
  },
  selectedDayCard: {
    width: 80,
    height: 150,
    borderRadius: 40,
    backgroundColor: Theme.colors.background.tertiary,
    borderColor: 'transparent',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  todayDayCard: {
    // borderColor: Theme.colors.text.tertiary,
    // borderWidth: 1,
  },
  dayLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: 4,
  },
  selectedDayLabel: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  todayDayLabel: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  dayNumber: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    marginBottom: 6,
  },
  selectedDayNumber: {
    color: Theme.colors.text.primary,
    fontSize: 20,
  },
  todayDayNumber: {
    color: Theme.colors.text.primary,
  },
  activityIcon: {
    marginTop: 4,
    color: Theme.colors.text.tertiary,
  },
  selectedDayIcon: {
    color: Theme.colors.text.primary,
  },
  todayDayIcon: {
    color: Theme.colors.text.primary,
  },
  dateContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 