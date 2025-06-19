// Challenge utilities - centralized challenge definitions and achievement logic

export interface Challenge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  maxProgress: number;
  progressUnit: string; // 'runs', 'km', 'days', 'friends', etc.
  reward: string;
  sortOrder: number;
}

// Get all available challenges
export function getChallenges(isMetric: boolean = true): Challenge[] {
  return [
    // First Steps
    {
      id: 'first_run',
      name: 'First Steps',
      description: 'Complete your first run',
      emoji: '🐨',
      category: 'milestones',
      maxProgress: 1,
      progressUnit: 'run',
      reward: 'Koala badge',
      sortOrder: 1,
    },
    
    // Time-based challenges
    {
      id: 'early_riser',
      name: 'Early Riser',
      description: 'Complete 3 runs before 9:00 AM',
      emoji: '🌅',
      category: 'habits',
      maxProgress: 3,
      progressUnit: 'runs',
      reward: 'Sunrise headband',
      sortOrder: 10,
    },
    
    // Distance milestones
    {
      id: 'distance_5k',
      name: isMetric ? '5K Hero' : '3.1Mi Hero',
      description: isMetric ? 'Run 5 kilometers in one session' : 'Run 3.1 miles in one session',
      emoji: '⭐',
      category: 'distance',
      maxProgress: 1,
      progressUnit: 'run',
      reward: 'Star badge',
      sortOrder: 20,
    },
    
    {
      id: 'distance_10k',
      name: isMetric ? '10K Champion' : '6.2Mi Champion',
      description: isMetric ? 'Run 10 kilometers in one session' : 'Run 6.2 miles in one session',
      emoji: '🥇',
      category: 'distance',
      maxProgress: 1,
      progressUnit: 'run',
      reward: 'Gold medal',
      sortOrder: 21,
    },
    
    // Speed challenges
    {
      id: 'speed_demon',
      name: 'Speed Demon',
      description: isMetric ? 'Run under 6 min/km pace for at least 1km' : 'Run under 9:39 min/mile pace for at least 1 mile',
      emoji: '⚡',
      category: 'performance',
      maxProgress: 1,
      progressUnit: 'run',
      reward: 'Lightning bolt',
      sortOrder: 25,
    },
    
    // Long distance
    {
      id: 'long_runner',
      name: isMetric ? 'Half Marathon Hero' : '13.1Mi Hero',
      description: isMetric ? 'Run 21 kilometers in one session' : 'Run 13.1 miles in one session',
      emoji: '🏃‍♂️',
      category: 'distance',
      maxProgress: 1,
      progressUnit: 'run',
      reward: 'Marathon medal',
      sortOrder: 22,
    },
    
    // Consistency challenges
    {
      id: 'weekly_warrior',
      name: 'Weekly Warrior',
      description: 'Run every day for one week',
      emoji: '⚔️',
      category: 'consistency',
      maxProgress: 7,
      progressUnit: 'days',
      reward: 'Warrior helmet',
      sortOrder: 30,
    },
    
    // Cumulative distance
    {
      id: 'total_distance_100k',
      name: isMetric ? '100K Club' : '62Mi Club',
      description: isMetric ? 'Run 100 kilometers total' : 'Run 62 miles total',
      emoji: '🏃‍♂️',
      category: 'cumulative',
      maxProgress: isMetric ? 100 : 62,
      progressUnit: isMetric ? 'km' : 'mi',
      reward: 'Distance warrior outfit',
      sortOrder: 40,
    },
    
    {
      id: 'total_distance_500k',
      name: isMetric ? '500K Club' : '311Mi Club',
      description: isMetric ? 'Run 500 kilometers total' : 'Run 311 miles total',
      emoji: '🦘',
      category: 'cumulative',
      maxProgress: isMetric ? 500 : 311,
      progressUnit: isMetric ? 'km' : 'mi',
      reward: 'Koala superhero costume',
      sortOrder: 41,
    },
  ];
}

// Calculate progress for a specific challenge based on activity data
export function calculateChallengeProgress(
  challengeId: string,
  activityData: {
    distance: number;
    duration: number;
    startDate: string;
    calories: number;
  },
  allActivities: any[],
  isMetric: boolean = true
): number | null {
  const { distance, duration, startDate } = activityData;
  const runDate = new Date(startDate);
  const runDistanceKm = distance / 1000;
  const runDistanceMi = distance * 0.000621371;
  const isEarlyBird = runDate.getHours() < 9; // Before 9 AM
  const runPace = distance > 0 ? (duration / runDistanceKm) : 0; // minutes per km

  // Calculate various metrics
  const totalRuns = allActivities.length;
  const totalDistance = allActivities.reduce((sum, a) => sum + a.distance, 0);

  switch (challengeId) {
    case 'first_run':
      return totalRuns === 1 ? 1 : 0;
      
    case 'early_riser':
      return isEarlyBird ? 1 : 0; // This will be accumulated by the caller
      
    case 'distance_5k':
      return (isMetric ? runDistanceKm >= 5 : runDistanceMi >= 3.1) ? 1 : 0;
      
    case 'distance_10k':
      return (isMetric ? runDistanceKm >= 10 : runDistanceMi >= 6.2) ? 1 : 0;
      
    case 'speed_demon':
      if (isMetric) {
        return (runDistanceKm >= 1 && runPace < 6) ? 1 : 0;
      } else {
        const runPaceMi = distance > 0 ? (duration / runDistanceMi) : 0;
        return (runDistanceMi >= 1 && runPaceMi < 9.65) ? 1 : 0; // Under 9:39 min/mile
      }
      
    case 'long_runner':
      return (isMetric ? runDistanceKm >= 21 : runDistanceMi >= 13) ? 1 : 0;
      
    case 'total_distance_100k':
      return Math.floor(totalDistance / 1000); // Progress in km
      
    case 'total_distance_500k':
      return Math.floor(totalDistance / 1000); // Progress in km
      
    case 'weekly_warrior':
      // This would need more complex logic to check consecutive days
      return null; // Not implemented yet
      
    default:
      return null;
  }
} 