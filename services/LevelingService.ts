export interface LevelInfo {
  level: number;
  totalDistance: number; // User's total absolute distance
  distanceForNextLevel: number; // Absolute distance required for next level
  remainingDistanceForNextLevel: number; // Distance still needed to reach next level
  progressToNextLevel: number; // 0-1
}

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  oldLevel: number;
  distanceGained: number;
}

class LevelingService {
  // Distance required for each level (cumulative, in meters)
  // Level 1: 0km, Level 2: 5km, Level 3: 15km, Level 4: 30km, etc.
  private static getDistanceForLevel(level: number): number {
    if (level <= 1) return 0;
    // Progressive distance requirements: level^2 * 2.5km
    return Math.floor(Math.pow(level - 1, 2) * 2500); // 2500 meters = 2.5km
  }

  // Calculate current level info from total distance
  static calculateLevelInfo(totalDistanceMeters: number): LevelInfo {
    let level = 1;
    
    // Find current level
    while (this.getDistanceForLevel(level + 1) <= totalDistanceMeters) {
      level++;
    }
    
    const distanceForNextLevel = this.getDistanceForLevel(level + 1);
    const remainingDistanceForNextLevel = Math.max(0, distanceForNextLevel - totalDistanceMeters);
    const distanceForCurrentLevel = this.getDistanceForLevel(level);
    const distanceInCurrentLevel = totalDistanceMeters - distanceForCurrentLevel;
    const distanceNeededForNext = distanceForNextLevel - distanceForCurrentLevel;
    const progressToNextLevel = distanceNeededForNext > 0 ? 
      distanceInCurrentLevel / distanceNeededForNext : 1;

    return {
      level,
      totalDistance: totalDistanceMeters,
      distanceForNextLevel,
      remainingDistanceForNextLevel,
      progressToNextLevel: Math.min(1, progressToNextLevel),
    };
  }

  // Add distance and check for level up
  static addDistance(currentTotalDistance: number, distanceToAdd: number): LevelUpResult {
    const oldLevelInfo = this.calculateLevelInfo(currentTotalDistance);
    const newTotalDistance = currentTotalDistance + distanceToAdd;
    const newLevelInfo = this.calculateLevelInfo(newTotalDistance);
    
    return {
      leveledUp: newLevelInfo.level > oldLevelInfo.level,
      newLevel: newLevelInfo.level,
      oldLevel: oldLevelInfo.level,
      distanceGained: distanceToAdd,
    };
  }

  // Get level title based on level
  static getLevelTitle(level: number): string {
    if (level >= 50) return "Koala Legend";
    if (level >= 40) return "Ultra Koala";
    if (level >= 30) return "Marathon Koala";
    if (level >= 25) return "Elite Koala";
    if (level >= 20) return "Racing Koala";
    if (level >= 15) return "Swift Koala";
    if (level >= 10) return "Running Koala";
    if (level >= 5) return "Jogging Koala";
    return "Baby Koala";
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
  static formatDistance(meters: number): string {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(1)}km`;
  }

  // Get level requirements for display
  static getLevelRequirements(): Array<{ level: number; distance: number; title: string; emoji: string }> {
    const levels = [];
    for (let i = 1; i <= 50; i++) {
      levels.push({
        level: i,
        distance: this.getDistanceForLevel(i),
        title: this.getLevelTitle(i),
        emoji: this.getLevelEmoji(i),
      });
    }
    return levels;
  }
}

export default LevelingService; 