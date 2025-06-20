import { SuggestedActivity } from '@/constants/types';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: string | null;
  isOnStreak: boolean;
  daysUntilStreakBreak: number;
  streakStatus: 'active' | 'at_risk' | 'broken';
}

export interface WeeklyStreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastStreakWeek: string | null;
  isOnStreak: boolean;
  weeksUntilStreakBreak: number;
  streakStatus: 'active' | 'at_risk' | 'broken';
  mascotHealth: number;
}

class StreakService {
  /**
   * @deprecated Use weekly streak calculation instead - calculateWeeklyStreakInfo()
   * Calculate comprehensive streak information for a user (DAILY - DEPRECATED)
   */
  static calculateStreakInfo(
    plannedWorkouts: SuggestedActivity[],
    currentStreak: number = 0,
    longestStreak: number = 0,
    lastStreakDate: string | null = null
  ): StreakInfo {
    console.warn('Daily streak calculation is deprecated. Use weekly streak calculation instead.');
    
    // Minimal implementation for backward compatibility
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStreakDate: null,
      isOnStreak: false,
      daysUntilStreakBreak: 0,
      streakStatus: 'broken'
    };
  }

  /**
   * @deprecated Use weekly streak calculation instead
   */
  private static calculateCurrentStreakFromWorkouts(sortedTrainingWorkouts: SuggestedActivity[]): {
    currentStreak: number;
    lastStreakDate: string | null;
  } {
    console.warn('Daily streak calculation is deprecated.');
    return { currentStreak: 0, lastStreakDate: null };
  }

  /**
   * @deprecated Use weekly streak calculation instead
   */
  private static determineStreakStatus(
    recentWorkouts: SuggestedActivity[],
    today: string
  ): 'active' | 'at_risk' | 'broken' {
    console.warn('Daily streak calculation is deprecated.');
    return 'broken';
  }

  /**
   * @deprecated Use weekly streak calculation instead
   */
  private static calculateDaysUntilStreakBreak(
    recentWorkouts: SuggestedActivity[],
    today: string
  ): number {
    console.warn('Daily streak calculation is deprecated.');
    return 0;
  }

  /**
   * @deprecated Weekly streaks don't use individual workout completion - use weekly goal achievement instead
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
    console.warn('Individual workout streak updates are deprecated. Use weekly goal completion instead.');
    
    return {
      newCurrentStreak: currentStreak,
      newLongestStreak: longestStreak,
      newLastStreakDate: lastStreakDate || workoutDate,
      streakIncreased: false
    };
  }

  /**
   * Get streak flame icons for weekly streak display
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
      total: maxIcons,
    };
  }

  /**
   * Get appropriate message for weekly streak
   */
  static getStreakMessage(streakInfo: WeeklyStreakInfo): string {
    const { currentStreak, streakStatus } = streakInfo;
    
    if (streakStatus === 'broken') {
      return "Hit your weekly goal to restart your streak! 🔥";
    }
    
    if (streakStatus === 'at_risk') {
      return "You need to complete your weekly goal to maintain your streak!";
    }
    
    if (currentStreak >= 12) {
      return "Incredible! You've maintained consistency for 3+ months!";
    } else if (currentStreak >= 4) {
      return "Outstanding habit building! You're unstoppable!";
    } else if (currentStreak >= 2) {
      return "Great momentum! Keep hitting those weekly goals!";
    } else if (currentStreak > 0) {
      return "Nice work! Keep building your weekly streak!";
    }
    
    return "Complete your weekly running goal to start your streak!";
  }

  /**
   * Get streak milestone rewards for weekly streaks
   */
  static getStreakRewards(newStreak: number, oldStreak: number): {
    streakFreezes: number;
    milestoneReached?: number;
    message?: string;
  } {
    let streakFreezes = 0;
    let milestoneReached: number | undefined;
    let message: string | undefined;

    // Weekly streak milestones (much longer intervals)
    const milestones = [4, 8, 12, 24, 52]; // 1 month, 2 months, 3 months, 6 months, 1 year
    
    for (const milestone of milestones) {
      if (newStreak >= milestone && oldStreak < milestone) {
        milestoneReached = milestone;
        
        if (milestone === 4) {
          streakFreezes = 1;
          message = "1 month streak! Earned 1 streak freeze! 🧊";
        } else if (milestone === 12) {
          streakFreezes = 2;
          message = "3 month streak! Earned 2 streak freezes! 🧊🧊";
        } else if (milestone === 52) {
          streakFreezes = 3;
          message = "1 year streak! Earned 3 streak freezes! 🧊🧊🧊";
        } else {
          message = `${milestone} week streak milestone! Amazing! 🏆`;
        }
        break;
      }
    }

    return { streakFreezes, milestoneReached, message };
  }

  /**
   * Calculate weekly streak info for simple training schedule users
   * THIS IS THE MAIN STREAK CALCULATION METHOD
   */
  static calculateWeeklyStreakInfo(
    activities: any[],
    scheduleHistory: any[],
    currentStreak: number = 0,
    longestStreak: number = 0,
    lastStreakWeek: string | null = null,
    mascotHealth: number = 4,
    weekStartDay: number = 1
  ): WeeklyStreakInfo {
    if (scheduleHistory.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastStreakWeek: null,
        isOnStreak: false,
        weeksUntilStreakBreak: 0,
        streakStatus: 'broken',
        mascotHealth: 4
      };
    }

    // Get current week
    const today = new Date();
    const currentWeekStart = this.getWeekStart(today, weekStartDay);
    const currentWeekStartISO = currentWeekStart.toISOString().split('T')[0];

    // Calculate actual streak from data
    const calculatedStreak = this.calculateCurrentWeeklyStreakFromData(
      activities, 
      scheduleHistory, 
      currentWeekStartISO, 
      weekStartDay
    );

    // Use the higher of calculated or stored streak
    const actualCurrentStreak = Math.max(calculatedStreak.currentStreak, currentStreak);
    const actualLongestStreak = Math.max(actualCurrentStreak, longestStreak);

    // Determine current week status
    const weekStatus = this.determineWeeklyStreakStatus(
      activities,
      scheduleHistory,
      currentWeekStartISO,
      weekStartDay
    );

    return {
      currentStreak: actualCurrentStreak,
      longestStreak: actualLongestStreak,
      lastStreakWeek: calculatedStreak.lastStreakWeek || lastStreakWeek,
      isOnStreak: actualCurrentStreak > 0 && weekStatus.status === 'active',
      weeksUntilStreakBreak: weekStatus.weeksUntilBreak,
      streakStatus: weekStatus.status,
      mascotHealth: Math.max(0, Math.min(4, mascotHealth))
    };
  }

  /**
   * Calculate current weekly streak from activity and schedule data
   */
  private static calculateCurrentWeeklyStreakFromData(
    activities: any[],
    scheduleHistory: any[],
    currentWeekStart: string,
    weekStartDay: number
  ): {
    currentStreak: number;
    lastStreakWeek: string | null;
  } {
    let streak = 0;
    let lastStreakWeek: string | null = null;
    let weekStart = new Date(currentWeekStart);

    // Go back week by week
    while (true) {
      const weekStartISO = weekStart.toISOString().split('T')[0];
      
      // Get the effective schedule for this week
      const weekSchedule = this.getScheduleForWeek(weekStartISO, scheduleHistory);
      if (!weekSchedule) {
        break; // No schedule data
      }

      // Count run days in this week
      const runDaysInWeek = this.countRunDaysInWeek(activities, weekStartISO);
      const goalMet = runDaysInWeek >= weekSchedule.runsPerWeek;

      if (goalMet) {
        streak++;
        if (!lastStreakWeek) {
          lastStreakWeek = weekStartISO;
        }
      } else {
        break; // Streak broken
      }

      // Move to previous week
      weekStart.setDate(weekStart.getDate() - 7);
      
      // Safety check
      if (streak > 520) break; // More than 10 years
    }

    return { currentStreak: streak, lastStreakWeek };
  }

  /**
   * Determine weekly streak status
   */
  private static determineWeeklyStreakStatus(
    activities: any[],
    scheduleHistory: any[],
    currentWeekStart: string,
    weekStartDay: number
  ): {
    status: 'active' | 'at_risk' | 'broken';
    weeksUntilBreak: number;
  } {
    const weekSchedule = this.getScheduleForWeek(currentWeekStart, scheduleHistory);
    if (!weekSchedule) {
      return { status: 'broken', weeksUntilBreak: 0 };
    }

    const runDaysThisWeek = this.countRunDaysInWeek(activities, currentWeekStart);
    const goalMet = runDaysThisWeek >= weekSchedule.runsPerWeek;

    if (goalMet) {
      return { status: 'active', weeksUntilBreak: 0 };
    }

    // Check if there's still time this week to complete the goal
    const today = new Date();
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(new Date(currentWeekStart).getDate() + 6);
    
    if (today <= weekEnd) {
      return { status: 'at_risk', weeksUntilBreak: 1 };
    }

    return { status: 'broken', weeksUntilBreak: 0 };
  }

  /**
   * Get appropriate weekly streak message
   */
  static getWeeklyStreakMessage(streakInfo: WeeklyStreakInfo, runsThisWeek: number, runsNeeded: number): string {
    const { currentStreak, streakStatus } = streakInfo;
    const runsRemaining = Math.max(0, runsNeeded - runsThisWeek);
    
    if (streakStatus === 'active') {
      return `${currentStreak} week streak! Weekly goal complete! 🔥`;
    } else if (streakStatus === 'at_risk') {
      if (runsRemaining === 1) {
        return `${runsRemaining} more run needed to maintain your ${currentStreak} week streak!`;
      } else {
        return `${runsRemaining} more runs needed to maintain your ${currentStreak} week streak!`;
      }
    } else {
      if (runsRemaining === 1) {
        return `${runsRemaining} run needed to start your streak!`;
      } else {
        return `${runsRemaining} runs needed to start your streak!`;
      }
    }
  }

  /**
   * Get mascot health message based on health level
   */
  static getMascotHealthMessage(health: number): string {
    switch (health) {
      case 4: return "Blaze is at full energy! ⚡⚡⚡⚡";
      case 3: return "Blaze is feeling strong! ⚡⚡⚡";
      case 2: return "Blaze needs some motivation! ⚡⚡";
      case 1: return "Blaze is getting tired... ⚡";
      case 0: return "Blaze needs you to get back on track! 💔";
      default: return "Blaze is ready to run! ⚡⚡⚡⚡";
    }
  }

  /**
   * Helper function to get week start date
   */
  private static getWeekStart(date: Date, weekStartDay: number): Date {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();

    let diff;
    if (weekStartDay === 1) {
      diff = day === 0 ? 6 : day - 1;
    } else {
      diff = day;
    }

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  private static getScheduleForWeek(weekStartDate: string, scheduleHistory: any[]): any | null {
    const effectiveSchedules = scheduleHistory
      .filter(h => h.effectiveFromDate <= weekStartDate)
      .sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate));
    
    return effectiveSchedules[0] || null;
  }

  private static countRunDaysInWeek(activities: any[], weekStartDate: string): number {
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const weekStartISO = weekStart.toISOString().split('T')[0];
    const weekEndISO = weekEnd.toISOString().split('T')[0];
    
    const runDays = new Set<string>();
    
    activities.forEach(activity => {
      const activityDate = activity.startDate.split('T')[0];
      if (activityDate >= weekStartISO && activityDate <= weekEndISO) {
        runDays.add(activityDate);
      }
    });
    
    return runDays.size;
  }
}

export default StreakService; 