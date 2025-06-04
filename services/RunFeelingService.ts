export type FeelingType = 'amazing' | 'good' | 'okay' | 'tough' | 'struggled';

export interface RunFeeling {
  runId: string;
  feeling: FeelingType;
  recordedAt: string;
}

class RunFeelingService {
  // In the future, this could sync to Convex
  // For now, we'll just log the feeling
  static recordFeeling(runId: string, feeling: FeelingType): void {
    const runFeeling: RunFeeling = {
      runId,
      feeling,
      recordedAt: new Date().toISOString(),
    };

    console.log('Run feeling recorded:', runFeeling);
    
    // TODO: Sync to Convex
    // This could be stored in a "runFeelings" table linked to activities
    // await ctx.db.insert("runFeelings", { 
    //   activityId: runId, 
    //   feeling, 
    //   recordedAt: now 
    // });
  }

  // Helper to get feeling display data
  static getFeelingDisplayData(feeling: FeelingType) {
    const feelingMap = {
      amazing: { emoji: '🔥', label: 'Amazing', color: '#FF6B35' },
      good: { emoji: '😊', label: 'Good', color: '#10B981' },
      okay: { emoji: '👍', label: 'Okay', color: '#3B82F6' },
      tough: { emoji: '😤', label: 'Tough', color: '#F59E0B' },
      struggled: { emoji: '😅', label: 'Struggled', color: '#EF4444' },
    };

    return feelingMap[feeling];
  }
}

export default RunFeelingService; 