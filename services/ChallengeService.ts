import { DatabaseActivity } from './DatabaseHealthService';

export interface Challenge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  reward: string;
}

export interface ChallengeUnlock {
  challenge: Challenge;
  unlockedAt: string;
}

class ChallengeService {
  private static challenges: Challenge[] = [
    { id: 'first_run', name: 'First Steps', description: 'Complete your first run', emoji: '🐨', reward: 'Koala badge' },
    { id: 'early_bird', name: 'Early Bird', description: 'Run before 7 AM', emoji: '🐓', reward: 'Rooster hat' },
    { id: 'distance_1k', name: '1K Runner', description: 'Run 1 kilometer', emoji: '🏃‍♂️', reward: 'Running shoes' },
    { id: 'distance_5k', name: '5K Hero', description: 'Run 5 kilometers', emoji: '⭐', reward: 'Star badge' },
    { id: 'distance_10k', name: '10K Champion', description: 'Run 10 kilometers', emoji: '🥇', reward: 'Gold medal' },
    { id: 'hot_runner', name: 'Hot Hero', description: 'Run above 30°C', emoji: '🔥', reward: 'Sunhat' },
    { id: 'speed_demon', name: 'Speed Demon', description: '1 km under 6 minutes', emoji: '⚡', reward: 'Lightning shoes' },
    { id: 'long_runner', name: 'Distance Warrior', description: 'Run over 21 kilometers', emoji: '🏆', reward: 'Trophy' },
  ];

  // Check which challenges are unlocked by a new run
  static checkChallengesForRun(run: DatabaseActivity, userStats?: {
    totalRuns: number;
    totalDistance: number;
    isFirstRun: boolean;
  }): Challenge[] {
    const unlockedChallenges: Challenge[] = [];
    const runDate = new Date(run.startDate);
    const runDistanceKm = run.distance / 1000;
    const runPace = run.distance > 0 ? (run.duration / runDistanceKm) : 0; // minutes per km

    // First run challenge
    if (userStats?.isFirstRun) {
      const challenge = this.challenges.find(c => c.id === 'first_run');
      if (challenge) unlockedChallenges.push(challenge);
    }

    // Early bird challenge (before 7 AM)
    if (runDate.getHours() < 7) {
      const challenge = this.challenges.find(c => c.id === 'early_bird');
      if (challenge) unlockedChallenges.push(challenge);
    }

    // Distance-based challenges
    if (runDistanceKm >= 1) {
      const challenge = this.challenges.find(c => c.id === 'distance_1k');
      if (challenge) unlockedChallenges.push(challenge);
    }

    if (runDistanceKm >= 5) {
      const challenge = this.challenges.find(c => c.id === 'distance_5k');
      if (challenge) unlockedChallenges.push(challenge);
    }

    if (runDistanceKm >= 10) {
      const challenge = this.challenges.find(c => c.id === 'distance_10k');
      if (challenge) unlockedChallenges.push(challenge);
    }

    if (runDistanceKm >= 21) {
      const challenge = this.challenges.find(c => c.id === 'long_runner');
      if (challenge) unlockedChallenges.push(challenge);
    }

    // Speed challenge (under 6 min/km pace for at least 1km)
    if (runDistanceKm >= 1 && runPace < 6) {
      const challenge = this.challenges.find(c => c.id === 'speed_demon');
      if (challenge) unlockedChallenges.push(challenge);
    }

    // Remove duplicates (in case a user has already unlocked)
    return unlockedChallenges.filter((challenge, index, self) => 
      index === self.findIndex(c => c.id === challenge.id)
    );
  }

  // Get all available challenges
  static getAllChallenges(): Challenge[] {
    return [...this.challenges];
  }

  // Get a specific challenge by ID
  static getChallengeById(id: string): Challenge | undefined {
    return this.challenges.find(c => c.id === id);
  }
}

export default ChallengeService; 