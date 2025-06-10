export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  isOnStreak: boolean;
  daysUntilStreakBreak: number;
  streakStatus: 'active' | 'at_risk' | 'broken';
}

export interface PlannedWorkout {
  scheduledDate: string;
  type: string;
  status: 'scheduled' | 'completed' | 'skipped' | 'missed';
}

class StreakService {
  /**
   * Calculate comprehensive streak information for a user
   */
  static calculateStreakInfo(
    plannedWorkouts: PlannedWorkout[],
    currentStreak: number = 0,
    longestStreak: number = 0,
    lastStreakDate: string | null = null
  ): StreakInfo {
    // Filter out rest days - only training days count toward streak
    const trainingWorkouts = plannedWorkouts.filter(workout => 
      workout.type !== 'rest' && 
      workout.type !== 'cross-train' // Also exclude cross-training from streak
    );

    // Sort by date (oldest first)
    const sortedWorkouts = trainingWorkouts.sort((a, b) => 
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );

    // Calculate current streak from the data
    const calculatedStreak = this.calculateCurrentStreakFromWorkouts(sortedWorkouts);
    
    // Use the higher of calculated or stored streak (in case of data inconsistencies)
    const actualCurrentStreak = Math.max(calculatedStreak.currentStreak, currentStreak);
    const actualLongestStreak = Math.max(actualCurrentStreak, longestStreak);

    // Determine streak status
    const today = new Date().toISOString().split('T')[0];
    const recentWorkouts = sortedWorkouts.filter(workout => {
      const workoutDate = new Date(workout.scheduledDate);
      const daysDiff = Math.floor((new Date(today).getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7; // Look at last 7 days
    });

    const streakStatus = this.determineStreakStatus(recentWorkouts, today);
    const daysUntilBreak = this.calculateDaysUntilStreakBreak(recentWorkouts, today);

    return {
      currentStreak: actualCurrentStreak,
      longestStreak: actualLongestStreak,
      lastStreakDate: calculatedStreak.lastStreakDate || lastStreakDate,
      isOnStreak: actualCurrentStreak > 0 && streakStatus === 'active',
      daysUntilStreakBreak: daysUntilBreak,
      streakStatus
    };
  }

  /**
   * Calculate current streak from workout data
   */
  private static calculateCurrentStreakFromWorkouts(sortedTrainingWorkouts: PlannedWorkout[]): {
    currentStreak: number;
    lastStreakDate: string | null;
  } {
    if (sortedTrainingWorkouts.length === 0) {
      return { currentStreak: 0, lastStreakDate: null };
    }

    let currentStreak = 0;
    let lastStreakDate: string | null = null;
    const today = new Date().toISOString().split('T')[0];

    // Work backwards from today to find consecutive completed training days
    for (let i = sortedTrainingWorkouts.length - 1; i >= 0; i--) {
      const workout = sortedTrainingWorkouts[i];
      const workoutDate = workout.scheduledDate;
      
      // Only count workouts up to today
      if (workoutDate > today) {
        continue;
      }

      if (workout.status === 'completed') {
        currentStreak++;
        lastStreakDate = workoutDate;
      } else if (workout.status === 'missed' || workout.status === 'skipped') {
        // Streak is broken by missed or skipped training days
        break;
      }
      // 'scheduled' workouts in the past should break the streak too
      else if (workout.status === 'scheduled' && workoutDate < today) {
        break;
      }
    }

    return { currentStreak, lastStreakDate };
  }

  /**
   * Determine the current status of the streak
   */
  private static determineStreakStatus(
    recentWorkouts: PlannedWorkout[],
    today: string
  ): 'active' | 'at_risk' | 'broken' {
    const todayWorkout = recentWorkouts.find(w => w.scheduledDate === today);
    const yesterdayWorkout = recentWorkouts.find(w => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return w.scheduledDate === yesterday.toISOString().split('T')[0];
    });

    // If today has a completed workout, streak is active
    if (todayWorkout?.status === 'completed') {
      return 'active';
    }

    // If today has a scheduled workout, check yesterday
    if (todayWorkout?.status === 'scheduled') {
      // If yesterday was completed or was a rest day, we're still good
      if (yesterdayWorkout?.status === 'completed' || !yesterdayWorkout) {
        return 'at_risk'; // Need to complete today to maintain streak
      }
    }

    // If we have missed or skipped recent training days, streak might be broken
    const hasMissedRecent = recentWorkouts.some(w => 
      (w.status === 'missed' || w.status === 'skipped') && 
      w.scheduledDate <= today
    );

    return hasMissedRecent ? 'broken' : 'at_risk';
  }

  /**
   * Calculate how many days until streak breaks (if at risk)
   */
  private static calculateDaysUntilStreakBreak(
    recentWorkouts: PlannedWorkout[],
    today: string
  ): number {
    const todayWorkout = recentWorkouts.find(w => w.scheduledDate === today);
    
    // If today has a scheduled training workout, user has until end of day
    if (todayWorkout?.status === 'scheduled') {
      return 1;
    }

    // Look for next training day
    const futureWorkouts = recentWorkouts.filter(w => w.scheduledDate > today);
    const nextTrainingDay = futureWorkouts.find(w => w.status === 'scheduled');
    
    if (nextTrainingDay) {
      const daysDiff = Math.floor(
        (new Date(nextTrainingDay.scheduledDate).getTime() - new Date(today).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      return daysDiff + 1;
    }

    return 0; // No upcoming training days found
  }

  /**
   * Update streak when a workout is completed
   */
  static updateStreakOnWorkoutCompletion(
    workoutDate: string,
    workoutType: string,
    currentStreak: number,
    lastStreakDate: string | null,
    longestStreak: number
  ): {
    newCurrentStreak: number;
    newLongestStreak: number;
    newLastStreakDate: string;
    streakIncreased: boolean;
  } {
    // Only training days count toward streak
    if (workoutType === 'rest' || workoutType === 'cross-train') {
      return {
        newCurrentStreak: currentStreak,
        newLongestStreak: longestStreak,
        newLastStreakDate: lastStreakDate || workoutDate,
        streakIncreased: false
      };
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Only count workouts completed today or in the past
    if (workoutDate > today) {
      return {
        newCurrentStreak: currentStreak,
        newLongestStreak: longestStreak,
        newLastStreakDate: lastStreakDate || workoutDate,
        streakIncreased: false
      };
    }

    // If this is the first workout or continues the streak
    let newCurrentStreak = currentStreak;
    let streakIncreased = false;

    if (!lastStreakDate) {
      // First ever training day completed
      newCurrentStreak = 1;
      streakIncreased = true;
    } else {
      const lastStreakDateTime = new Date(lastStreakDate).getTime();
      const workoutDateTime = new Date(workoutDate).getTime();
      const daysBetween = Math.floor((workoutDateTime - lastStreakDateTime) / (1000 * 60 * 60 * 24));

      if (daysBetween <= 3) { // Allow some flexibility for training plans
        newCurrentStreak = currentStreak + 1;
        streakIncreased = true;
      } else {
        // Gap is too large, reset streak
        newCurrentStreak = 1;
        streakIncreased = false;
      }
    }

    const newLongestStreak = Math.max(newCurrentStreak, longestStreak);

    return {
      newCurrentStreak,
      newLongestStreak,
      newLastStreakDate: workoutDate,
      streakIncreased
    };
  }

  /**
   * Get streak flame icons for display (like in the image)
   */
  static getStreakFlameIcons(currentStreak: number, maxIcons: number = 7): {
    filled: number;
    outlined: number;
    total: number;
  } {
    const filled = Math.min(currentStreak, maxIcons);
    const outlined = maxIcons - filled;
    
    return {
      filled,
      outlined,
      total: maxIcons
    };
  }

  /**
   * Get streak encouragement message
   */
  static getStreakMessage(streakInfo: StreakInfo): string {
    const { currentStreak, streakStatus } = streakInfo;

    if (currentStreak === 0) {
      return "Start your training streak today! 🔥";
    }

    if (streakStatus === 'active') {
      if (currentStreak === 1) {
        return "Great start! Keep it going! 💪";
      } else if (currentStreak < 7) {
        return `${currentStreak} day streak! You're building momentum! 🚀`;
      } else if (currentStreak < 14) {
        return `${currentStreak} days strong! You're on fire! 🔥`;
      } else if (currentStreak < 30) {
        return `${currentStreak} day streak! Absolutely crushing it! 💥`;
      } else {
        return `${currentStreak} days! You're a training legend! 👑`;
      }
    }

    if (streakStatus === 'at_risk') {
      return `${currentStreak} day streak at risk! Complete today's workout! ⚡`;
    }

    return "Time to rebuild your streak! You've got this! 💪";
  }

  /**
   * Check if user deserves a streak freeze (milestone rewards)
   */
  static getStreakRewards(newStreak: number, oldStreak: number): {
    streakFreezes: number;
    milestoneReached?: number;
    message?: string;
  } {
    const milestones = [7, 14, 30, 60, 100, 365];
    let streakFreezes = 0;
    let milestoneReached: number | undefined;
    let message: string | undefined;

    for (const milestone of milestones) {
      if (newStreak >= milestone && oldStreak < milestone) {
        milestoneReached = milestone;
        
        // Award streak freezes at certain milestones
        if (milestone === 7) {
          streakFreezes = 1;
          message = "7 day streak! Earned 1 streak freeze! 🧊";
        } else if (milestone === 30) {
          streakFreezes = 2;
          message = "30 day streak! Earned 2 streak freezes! 🧊🧊";
        } else if (milestone === 100) {
          streakFreezes = 3;
          message = "100 day streak! Earned 3 streak freezes! 🧊🧊🧊";
        } else {
          message = `${milestone} day streak milestone! Amazing! 🏆`;
        }
        break;
      }
    }

    return { streakFreezes, milestoneReached, message };
  }
}

export default StreakService; 