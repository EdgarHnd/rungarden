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
  // Get challenges with dynamic descriptions based on metric preference
  static getChallenges(isMetric: boolean = true): Challenge[] {
    return [
      { id: 'first_run', name: 'First Steps', description: 'Complete your first run', emoji: '🐨', reward: 'Koala badge' },
      { id: 'early_bird', name: 'Early Bird', description: 'Run before 7 AM', emoji: '🐓', reward: 'Rooster hat' },
      { 
        id: 'distance_1k', 
        name: isMetric ? '1K Runner' : '0.6Mi Runner', 
        description: isMetric ? 'Run 1 kilometer' : 'Run 0.6 miles', 
        emoji: '🏃‍♂️', 
        reward: 'Running shoes' 
      },
      { 
        id: 'distance_5k', 
        name: isMetric ? '5K Hero' : '3.1Mi Hero', 
        description: isMetric ? 'Run 5 kilometers' : 'Run 3.1 miles', 
        emoji: '⭐', 
        reward: 'Star badge' 
      },
      { 
        id: 'distance_10k', 
        name: isMetric ? '10K Champion' : '6.2Mi Champion', 
        description: isMetric ? 'Run 10 kilometers' : 'Run 6.2 miles', 
        emoji: '🥇', 
        reward: 'Gold medal' 
      },
      { 
        id: 'hot_runner', 
        name: 'Hot Hero', 
        description: isMetric ? 'Run above 30°C' : 'Run above 86°F', 
        emoji: '🔥', 
        reward: 'Sunhat' 
      },
      { 
        id: 'speed_demon', 
        name: 'Speed Demon', 
        description: isMetric ? '1 km under 6 minutes' : '1 mi under 9:39', 
        emoji: '⚡', 
        reward: 'Lightning shoes' 
      },
      { 
        id: 'long_runner', 
        name: 'Distance Warrior', 
        description: isMetric ? 'Run over 21 kilometers' : 'Run over 13 miles', 
        emoji: '🏆', 
        reward: 'Trophy' 
      },
    ];
  }

  // Check which challenges are unlocked by a new run
  static checkChallengesForRun(
    run: DatabaseActivity, 
    userStats?: {
      totalRuns: number;
      totalDistance: number;
      isFirstRun: boolean;
    },
    isMetric: boolean = true
  ): Challenge[] {
    const unlockedChallenges: Challenge[] = [];
    const runDate = new Date(run.startDate);
    const runDistanceKm = run.distance / 1000;
    const runDistanceMi = run.distance * 0.000621371;
    const runPace = run.distance > 0 ? (run.duration / runDistanceKm) : 0; // minutes per km
    const runPaceMi = run.distance > 0 ? (run.duration / runDistanceMi) : 0; // minutes per mile

    const challenges = this.getChallenges(isMetric);

    // First run challenge
    if (userStats?.isFirstRun) {
      const challenge = challenges.find(c => c.id === 'first_run');
      if (challenge) unlockedChallenges.push(challenge);
    }

    // Early bird challenge (before 7 AM)
    if (runDate.getHours() < 7) {
      const challenge = challenges.find(c => c.id === 'early_bird');
      if (challenge) unlockedChallenges.push(challenge);
    }

    // Distance-based challenges
    if (isMetric) {
      if (runDistanceKm >= 1) {
        const challenge = challenges.find(c => c.id === 'distance_1k');
        if (challenge) unlockedChallenges.push(challenge);
      }

      if (runDistanceKm >= 5) {
        const challenge = challenges.find(c => c.id === 'distance_5k');
        if (challenge) unlockedChallenges.push(challenge);
      }

      if (runDistanceKm >= 10) {
        const challenge = challenges.find(c => c.id === 'distance_10k');
        if (challenge) unlockedChallenges.push(challenge);
      }

      if (runDistanceKm >= 21) {
        const challenge = challenges.find(c => c.id === 'long_runner');
        if (challenge) unlockedChallenges.push(challenge);
      }

      // Speed challenge (under 6 min/km pace for at least 1km)
      if (runDistanceKm >= 1 && runPace < 6) {
        const challenge = challenges.find(c => c.id === 'speed_demon');
        if (challenge) unlockedChallenges.push(challenge);
      }
    } else {
      // Imperial distances
      if (runDistanceMi >= 0.6) {
        const challenge = challenges.find(c => c.id === 'distance_1k');
        if (challenge) unlockedChallenges.push(challenge);
      }

      if (runDistanceMi >= 3.1) {
        const challenge = challenges.find(c => c.id === 'distance_5k');
        if (challenge) unlockedChallenges.push(challenge);
      }

      if (runDistanceMi >= 6.2) {
        const challenge = challenges.find(c => c.id === 'distance_10k');
        if (challenge) unlockedChallenges.push(challenge);
      }

      if (runDistanceMi >= 13) {
        const challenge = challenges.find(c => c.id === 'long_runner');
        if (challenge) unlockedChallenges.push(challenge);
      }

      // Speed challenge (under 9:39 min/mile pace for at least 1 mile)
      if (runDistanceMi >= 1 && runPaceMi < 9.65) {
        const challenge = challenges.find(c => c.id === 'speed_demon');
        if (challenge) unlockedChallenges.push(challenge);
      }
    }

    // Remove duplicates (in case a user has already unlocked)
    return unlockedChallenges.filter((challenge, index, self) => 
      index === self.findIndex(c => c.id === challenge.id)
    );
  }

  // Get all available challenges (for backward compatibility, defaults to metric)
  static getAllChallenges(): Challenge[] {
    return this.getChallenges(true);
  }

  // Get a specific challenge by ID with metric preference
  static getChallengeById(id: string, isMetric: boolean = true): Challenge | undefined {
    return this.getChallenges(isMetric).find(c => c.id === id);
  }
}

export default ChallengeService; 