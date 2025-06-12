export interface LevelInfo {
  level: number;
  totalXP: number; // User's total XP
  xpForNextLevel: number; // XP required for next level
  remainingXPForNextLevel: number; // XP still needed to reach next level
  progressToNextLevel: number; // 0-1
}

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  oldLevel: number;
  xpGained: number;
}

class LevelingService {
  // XP required for each level (cumulative)
  // Level 1: 0 XP, Level 2: 500 XP, Level 3: 1500 XP, Level 4: 3000 XP, etc.
  private static getXPForLevel(level: number): number {
    if (level <= 1) return 0;
    // Progressive XP requirements: level^2 * 250 XP
    return Math.floor(Math.pow(level - 1, 2) * 250);
  }

  // Convert distance in meters to XP
  static distanceToXP(distanceMeters: number): number {
    // 1km = 100 XP, so 1 meter = 0.1 XP
    return Math.floor(distanceMeters * 0.1);
  }

  // Convert distance to XP with metric preference
  static convertDistanceToXP(distance: number, unit: 'km' | 'miles' | 'meters'): number {
    let distanceInMeters: number;
    
    switch (unit) {
      case 'km':
        distanceInMeters = distance * 1000;
        break;
      case 'miles':
        distanceInMeters = distance * 1609.34; // 1 mile = 1609.34 meters
        break;
      case 'meters':
      default:
        distanceInMeters = distance;
        break;
    }
    
    return this.distanceToXP(distanceInMeters);
  }

  // Calculate current level info from total XP
  static calculateLevelInfo(totalXP: number): LevelInfo {
    let level = 1;
    
    // Find current level
    while (this.getXPForLevel(level + 1) <= totalXP) {
      level++;
    }
    
    const xpForNextLevel = this.getXPForLevel(level + 1);
    const remainingXPForNextLevel = Math.max(0, xpForNextLevel - totalXP);
    const xpForCurrentLevel = this.getXPForLevel(level);
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
    const progressToNextLevel = xpNeededForNext > 0 ? 
      xpInCurrentLevel / xpNeededForNext : 1;

    return {
      level,
      totalXP,
      xpForNextLevel,
      remainingXPForNextLevel,
      progressToNextLevel: Math.min(1, progressToNextLevel),
    };
  }

  // Add XP and check for level up
  static addXP(currentTotalXP: number, xpToAdd: number): LevelUpResult {
    const oldLevelInfo = this.calculateLevelInfo(currentTotalXP);
    const newTotalXP = currentTotalXP + xpToAdd;
    const newLevelInfo = this.calculateLevelInfo(newTotalXP);
    
    return {
      leveledUp: newLevelInfo.level > oldLevelInfo.level,
      newLevel: newLevelInfo.level,
      oldLevel: oldLevelInfo.level,
      xpGained: xpToAdd,
    };
  }

  // Get level title based on level
  static getLevelTitle(level: number): string {
    const { LEVELS } = require('@/constants/Levels');
    // Ensure level is within bounds (1-100)
    const levelIndex = Math.max(1, Math.min(level, 100)) - 1;
    return LEVELS[levelIndex] || "Walker";
  }

  // Get level emoji
  static getLevelEmoji(level: number): string {
    if (level >= 50) return "👑";
    if (level >= 40) return "🏆";
    if (level >= 30) return "🥇";
    if (level >= 25) return "🥈";
    if (level >= 20) return "🥉";
    if (level >= 15) return "⭐";
    if (level >= 10) return "🔥";
    if (level >= 5) return "💪";
    return "🐨";
  }

  // Helper to format distance for display
  static formatDistance(meters: number, metricSystem: 'metric' | 'imperial' = 'metric'): string {
    if (metricSystem === 'imperial') {
      const miles = meters / 1609.34;
      return `${miles.toFixed(1)} mi`;
    } else {
      const kilometers = meters / 1000;
      return `${kilometers.toFixed(1)} km`;
    }
  }

  // Helper to format XP for display
  static formatXP(xp: number, showXp: boolean = true): string {
    return `${xp} ${showXp ? 'XP' : ''}`;
  }

  // Get level requirements for display
  static getLevelRequirements(): Array<{ level: number; xp: number; title: string; emoji: string }> {
    const levels = [];
    for (let i = 1; i <= 100; i++) {
      levels.push({
        level: i,
        xp: this.getXPForLevel(i),
        title: this.getLevelTitle(i),
        emoji: this.getLevelEmoji(i),
      });
    }
    return levels;
  }
}

export default LevelingService; 