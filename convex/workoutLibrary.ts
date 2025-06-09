import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Seed workout library with base templates
export const seedWorkoutLibrary = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    
    // Check if library is already seeded
    const existingWorkouts = await ctx.db.query("workouts").take(1);
    if (existingWorkouts.length > 0) {
      return { message: "Workout library already seeded" };
    }

    const workouts = [
      // Easy runs
      {
        tag: "easy",
        levelMin: 0,
        levelMax: 3,
        name: "Easy Run",
        description: "Conversational pace run for building aerobic base",
        structure: [
          {
            type: "warmup" as const,
            duration: "5 min",
            intensity: "easy" as const,
            instructions: "Start with 5 minutes of gentle walking to warm up"
          },
          {
            type: "main" as const,
            duration: "20-30 min",
            intensity: "easy" as const,
            instructions: "Run at a comfortable, conversational pace. You should be able to talk in full sentences."
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "Cool down with 5 minutes of walking and gentle stretching"
          }
        ],
                 scalingFactors: {
           fiveK: 1.0,
           tenK: 1.2,
           halfMarathon: 1.5,
           marathon: 2.0
         },
        createdAt: now
      },

      // Run-walk for beginners
      {
        tag: "run-walk",
        levelMin: 0,
        levelMax: 1,
        name: "Run-Walk Intervals",
        description: "Build running endurance with walk breaks",
        structure: [
          {
            type: "warmup" as const,
            duration: "5 min",
            intensity: "easy" as const,
            instructions: "5 minutes of brisk walking"
          },
          {
            type: "main" as const,
            duration: "20 min",
            intensity: "moderate" as const,
            instructions: "Alternate 2 minutes running with 2 minutes walking. Repeat 5 times.",
            repetitions: 5,
            restDuration: "2 min walk"
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes of slow walking"
          }
        ],
                 scalingFactors: {
           fiveK: 1.0,
           tenK: 1.2,
           halfMarathon: 1.5,
           marathon: 1.8
         },
        createdAt: now
      },

      // C25K Week 1 Template
      {
        tag: "c25k-week1",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 1",
        description: "60 seconds running, 90 seconds walking (8 cycles)",
        structure: [
          {
            type: "warmup" as const,
            duration: "5 min",
            intensity: "easy" as const,
            instructions: "5 minutes of brisk walking to warm up"
          },
          {
            type: "main" as const,
            duration: "20 min",
            intensity: "moderate" as const,
            instructions: "Alternate 60 seconds running with 90 seconds walking. Repeat 8 times. Run at a comfortable pace - you should be able to talk.",
            repetitions: 8,
            restDuration: "90 sec walk"
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes of slow walking and gentle stretching"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.0,
          halfMarathon: 1.0,
          marathon: 1.0
        },
        createdAt: now
      },

      // C25K Week 2 Template
      {
        tag: "c25k-week2",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 2",
        description: "90 seconds running, 2 minutes walking (6 cycles)",
        structure: [
          {
            type: "warmup" as const,
            duration: "5 min",
            intensity: "easy" as const,
            instructions: "5 minutes of brisk walking to warm up"
          },
          {
            type: "main" as const,
            duration: "20 min",
            intensity: "moderate" as const,
            instructions: "Alternate 90 seconds running with 2 minutes walking. Repeat 6 times. Maintain conversational pace.",
            repetitions: 6,
            restDuration: "2 min walk"
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes of slow walking and gentle stretching"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.0,
          halfMarathon: 1.0,
          marathon: 1.0
        },
        createdAt: now
      },

      // C25K Week 3
      {
        tag: "c25k-week3",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 3",
        description: "Two reps of 90s jog, 90s walk, 3min jog, 3min walk",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking to warm up" },
          { type: "main" as const, duration: "18 min", intensity: "moderate" as const, instructions: "Two repetitions of: 90 sec jog, 90 sec walk, 3 min jog, 3 min walk." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking and gentle stretching" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },

      // C25K Week 4
      {
        tag: "c25k-week4",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 4",
        description: "3m jog, 90s walk, 5m jog, 2.5m walk, 3m jog, 90s walk, 5m jog",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking to warm up" },
          { type: "main" as const, duration: "22 min", intensity: "moderate" as const, instructions: "Jog 3 min, walk 90s, jog 5 min, walk 2.5 min, jog 3 min, walk 90s, jog 5 min." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },

      // C25K Week 5
      {
        tag: "c25k-week5a",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 5, Day 1",
        description: "5m jog, 3m walk, 5m jog, 3m walk, 5m jog",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "21 min", intensity: "moderate" as const, instructions: "Three 5-minute jogs separated by 3-minute walks." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },
      {
        tag: "c25k-week5b",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 5, Day 2",
        description: "8m jog, 5m walk, 8m jog",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "21 min", intensity: "moderate" as const, instructions: "Two 8-minute jogs separated by a 5-minute walk." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },
      {
        tag: "c25k-week5c",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 5, Day 3",
        description: "20 minute continuous run",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "20 min", intensity: "moderate" as const, instructions: "Run for 20 minutes without walking." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },

      // C25K Week 6
      {
        tag: "c25k-week6a",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 6, Day 1",
        description: "5m jog, 3m walk, 8m jog, 3m walk, 5m jog",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "24 min", intensity: "moderate" as const, instructions: "Jog 5 min, walk 3 min, jog 8 min, walk 3 min, jog 5 min." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },
      {
        tag: "c25k-week6b",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 6, Day 2",
        description: "10m jog, 3m walk, 10m jog",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "23 min", intensity: "moderate" as const, instructions: "Two 10-minute jogs separated by a 3-minute walk." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },
      {
        tag: "c25k-week6c",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 6, Day 3",
        description: "25 minute continuous run",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "25 min", intensity: "moderate" as const, instructions: "Run for 25 minutes without walking." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },

      // C25K Week 7
      {
        tag: "c25k-week7",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 7",
        description: "25 minute continuous run",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "25 min", intensity: "easy" as const, instructions: "Run continuously for 25 minutes. Pace should feel comfortable." },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },

      // C25K Week 8
      {
        tag: "c25k-week8",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 8",
        description: "28 minute continuous run",
        structure: [
          { type: "warmup" as const, duration: "5 min", intensity: "easy" as const, instructions: "5 minutes of brisk walking" },
          { type: "main" as const, duration: "28 min", intensity: "easy" as const, instructions: "Run continuously for 28 minutes. Almost there!" },
          { type: "cooldown" as const, duration: "5 min", intensity: "recovery" as const, instructions: "5 minutes of slow walking" }
        ],
        scalingFactors: { fiveK: 1.0, tenK: 1.0, halfMarathon: 1.0, marathon: 1.0 },
        createdAt: now
      },

      // C25K Week 9 Template
      {
        tag: "c25k-week9",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 9 - 5K Achievement!",
        description: "Full 30-minute continuous run (5K achievement)",
        structure: [
          {
            type: "warmup" as const,
            duration: "5 min",
            intensity: "easy" as const,
            instructions: "5 minutes of brisk walking to warm up"
          },
          {
            type: "main" as const,
            duration: "30 min",
            intensity: "easy" as const,
            instructions: "Run continuously for 30 minutes! You've achieved your 5K goal. Celebrate this amazing milestone!",
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes of slow walking and gentle stretching. You did it!"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.0,
          halfMarathon: 1.0,
          marathon: 1.0
        },
        createdAt: now
      },

      // C25K Week 9 Final
      {
        tag: "c25k-week9-final",
        levelMin: 0,
        levelMax: 0,
        name: "C25K Week 9 - Final Run!",
        description: "Full 30-minute continuous run (5K achievement)",
        structure: [
          {
            type: "warmup" as const,
            duration: "5 min",
            intensity: "easy" as const,
            instructions: "5 minutes of brisk walking to warm up"
          },
          {
            type: "main" as const,
            duration: "30 min",
            intensity: "easy" as const,
            instructions: "Run continuously for 30 minutes! You've achieved your 5K goal. Celebrate this amazing milestone!",
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes of slow walking and gentle stretching. You did it!"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.0,
          halfMarathon: 1.0,
          marathon: 1.0
        },
        createdAt: now
      },

      // Tempo runs
      {
        tag: "tempo",
        levelMin: 2,
        levelMax: 3,
        name: "Tempo Run",
        description: "Sustained effort at threshold pace",
        structure: [
          {
            type: "warmup" as const,
            duration: "15 min",
            intensity: "easy" as const,
            instructions: "15 minutes easy running to prepare for the tempo effort"
          },
          {
            type: "main" as const,
            duration: "20 min",
            intensity: "threshold" as const,
            instructions: "Run at comfortably hard pace - about 8/10 effort. This should feel challenging but sustainable."
          },
          {
            type: "cooldown" as const,
            duration: "10 min",
            intensity: "easy" as const,
            instructions: "10 minutes easy running to cool down"
          }
        ],
        scalingFactors: {
          fiveK: 0.8,
          tenK: 1.0,
          halfMarathon: 1.3,
          marathon: 1.5
        },
        createdAt: now
      },

      // Intervals
      {
        tag: "intervals",
        levelMin: 2,
        levelMax: 3,
        name: "400m Intervals",
        description: "Short, fast intervals to improve speed and VO2 max",
        structure: [
          {
            type: "warmup" as const,
            duration: "15 min",
            intensity: "easy" as const,
            instructions: "15 minutes easy running with 4x20 second strides"
          },
          {
            type: "main" as const,
            duration: "16 min",
            intensity: "vo2max" as const,
            instructions: "Run 400m at 5K pace (hard effort), jog 200m for recovery",
            repetitions: 6,
            restDuration: "200m jog"
          },
          {
            type: "cooldown" as const,
            duration: "10 min",
            intensity: "easy" as const,
            instructions: "10 minutes easy running"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.1,
          halfMarathon: 0.9,
          marathon: 0.8
        },
        createdAt: now
      },

      // Long runs
      {
        tag: "long",
        levelMin: 1,
        levelMax: 3,
        name: "Long Run",
        description: "Extended run to build endurance",
        structure: [
          {
            type: "warmup" as const,
            duration: "10 min",
            intensity: "easy" as const,
            instructions: "Start with 10 minutes of easy running"
          },
          {
            type: "main" as const,
            duration: "45-90 min",
            intensity: "easy" as const,
            instructions: "Run at an easy, sustainable pace. Focus on building time on your feet rather than speed."
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes walking and gentle stretching"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.3,
          halfMarathon: 1.8,
          marathon: 2.5
        },
        createdAt: now
      },

      // Recovery runs
      {
        tag: "recovery",
        levelMin: 1,
        levelMax: 3,
        name: "Recovery Run",
        description: "Very easy run for active recovery",
        structure: [
          {
            type: "main" as const,
            duration: "20-30 min",
            intensity: "recovery" as const,
            instructions: "Very easy running at a pace where you feel fully recovered by the end. Shorter and slower than easy runs."
          }
        ],
        scalingFactors: {
          fiveK: 0.7,
          tenK: 0.8,
          halfMarathon: 0.9,
          marathon: 1.0
        },
        createdAt: now
      },

      // Cross training
      {
        tag: "cross-train",
        levelMin: 0,
        levelMax: 3,
        name: "Cross Training",
        description: "Non-running aerobic exercise",
        structure: [
          {
            type: "main" as const,
            duration: "30-45 min",
            intensity: "moderate" as const,
            instructions: "Cycling, swimming, elliptical, or other low-impact cardio at moderate effort"
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.1,
          halfMarathon: 1.2,
          marathon: 1.3
        },
        createdAt: now
      },

      // Rest day activities
      {
        tag: "rest",
        levelMin: 0,
        levelMax: 3,
        name: "Active Rest",
        description: "Light movement and recovery activities",
        structure: [
          {
            type: "main" as const,
            duration: "15-30 min",
            intensity: "recovery" as const,
            instructions: "Gentle yoga, stretching, foam rolling, or easy walking. Focus on mobility and recovery."
          }
        ],
        scalingFactors: {
          fiveK: 1.0,
          tenK: 1.0,
          halfMarathon: 1.0,
          marathon: 1.0
        },
        createdAt: now
      },

      // 10K-Specific Workouts
      
      // 10K Threshold Tempo Run
      {
        tag: "10k-threshold",
        levelMin: 1,
        levelMax: 3,
        name: "10K Threshold Tempo",
        description: "Sustained threshold pace run - the key to 10K success",
        structure: [
          {
            type: "warmup" as const,
            duration: "15 min",
            intensity: "easy" as const,
            instructions: "15 minutes easy running with 4x20 second strides"
          },
          {
            type: "main" as const,
            duration: "20-30 min",
            intensity: "threshold" as const,
            instructions: "Run at 10K race pace or slightly slower. This should feel comfortably hard - about 8/10 effort. You should be able to say 3-4 words at a time."
          },
          {
            type: "cooldown" as const,
            duration: "10 min",
            intensity: "easy" as const,
            instructions: "10 minutes easy running to flush lactate"
          }
        ],
        scalingFactors: {
          fiveK: 0.8,
          tenK: 1.0,
          halfMarathon: 1.2,
          marathon: 1.4
        },
        createdAt: now
      },

      // 10K Progressive Tempo
      {
        tag: "10k-progressive",
        levelMin: 2,
        levelMax: 3,
        name: "10K Progressive Tempo",
        description: "Build from threshold to 10K pace",
        structure: [
          {
            type: "warmup" as const,
            duration: "15 min",
            intensity: "easy" as const,
            instructions: "15 minutes easy running with dynamic drills"
          },
          {
            type: "main" as const,
            duration: "24 min",
            intensity: "threshold" as const,
            instructions: "8 min threshold pace, 8 min 10K pace, 8 min faster than 10K pace. Progressive effort building race-specific fitness."
          },
          {
            type: "cooldown" as const,
            duration: "12 min",
            intensity: "easy" as const,
            instructions: "12 minutes easy running with light stretching"
          }
        ],
        scalingFactors: {
          fiveK: 0.9,
          tenK: 1.0,
          halfMarathon: 1.1,
          marathon: 1.2
        },
        createdAt: now
      },

      // 10K Mile Repeats
      {
        tag: "10k-mile-repeats",
        levelMin: 2,
        levelMax: 3,
        name: "10K Mile Repeats",
        description: "1 mile intervals at 10K pace for race simulation",
        structure: [
          {
            type: "warmup" as const,
            duration: "20 min",
            intensity: "easy" as const,
            instructions: "20 minutes easy running with 6x20 second strides"
          },
          {
            type: "main" as const,
            duration: "18 min",
            intensity: "threshold" as const,
            instructions: "3 x 1 mile at 10K race pace with 90 seconds recovery jog between. Focus on even pacing and race rhythm.",
            repetitions: 3,
            restDuration: "90 sec jog"
          },
          {
            type: "cooldown" as const,
            duration: "15 min",
            intensity: "easy" as const,
            instructions: "15 minutes easy running"
          }
        ],
        scalingFactors: {
          fiveK: 0.9,
          tenK: 1.0,
          halfMarathon: 1.1,
          marathon: 1.0
        },
        createdAt: now
      },

      // 10K 1200m Repeats
      {
        tag: "10k-1200m-repeats",
        levelMin: 1,
        levelMax: 3,
        name: "10K 1200m Repeats",
        description: "1200m intervals building 10K speed endurance",
        structure: [
          {
            type: "warmup" as const,
            duration: "18 min",
            intensity: "easy" as const,
            instructions: "18 minutes easy running with 4x30 second strides"
          },
          {
            type: "main" as const,
            duration: "20 min",
            intensity: "vo2max" as const,
            instructions: "4 x 1200m at slightly faster than 10K pace with 2 minutes recovery jog. Build race speed and confidence.",
            repetitions: 4,
            restDuration: "2 min jog"
          },
          {
            type: "cooldown" as const,
            duration: "12 min",
            intensity: "easy" as const,
            instructions: "12 minutes easy running"
          }
        ],
        scalingFactors: {
          fiveK: 1.1,
          tenK: 1.0,
          halfMarathon: 0.9,
          marathon: 0.8
        },
        createdAt: now
      },

      // 10K Fartlek
      {
        tag: "10k-fartlek",
        levelMin: 1,
        levelMax: 3,
        name: "10K Fartlek",
        description: "Playful speed work with 10K-specific surges",
        structure: [
          {
            type: "warmup" as const,
            duration: "15 min",
            intensity: "easy" as const,
            instructions: "15 minutes easy running to prepare for surges"
          },
          {
            type: "main" as const,
            duration: "25 min",
            intensity: "moderate" as const,
            instructions: "25 minutes with alternating surges: 3 min at 10K pace, 2 min easy, 2 min at 5K pace, 2 min easy. Repeat pattern. Fun and race-specific!"
          },
          {
            type: "cooldown" as const,
            duration: "10 min",
            intensity: "easy" as const,
            instructions: "10 minutes easy running to cool down"
          }
        ],
        scalingFactors: {
          fiveK: 0.9,
          tenK: 1.0,
          halfMarathon: 1.1,
          marathon: 1.2
        },
        createdAt: now
      },

      // 10K Long Run
      {
        tag: "10k-long-run",
        levelMin: 1,
        levelMax: 3,
        name: "10K Long Run",
        description: "Aerobic base building with 10K finish",
        structure: [
          {
            type: "warmup" as const,
            duration: "10 min",
            intensity: "easy" as const,
            instructions: "10 minutes easy running to settle into rhythm"
          },
          {
            type: "main" as const,
            duration: "50-75 min",
            intensity: "easy" as const,
            instructions: "Most of the run at easy pace, with the final 10-15 minutes at marathon to half marathon pace. Build endurance with finish."
          },
          {
            type: "cooldown" as const,
            duration: "5 min",
            intensity: "recovery" as const,
            instructions: "5 minutes walking and stretching"
          }
        ],
        scalingFactors: {
          fiveK: 1.2,
          tenK: 1.0,
          halfMarathon: 1.3,
          marathon: 1.8
        },
        createdAt: now
      },
    ];

    // Insert all workouts
    const insertPromises = workouts.map(workout => ctx.db.insert("workouts", workout));
    await Promise.all(insertPromises);

    return { message: `Seeded ${workouts.length} workouts`, count: workouts.length };
  },
});

// Get workouts by tag and fitness level
export const getWorkoutsByTag = query({
  args: {
    tag: v.string(),
    fitnessLevel: v.optional(v.union(
      v.literal("true-beginner"),
      v.literal("novice"),
      v.literal("intermediate"),
      v.literal("advanced")
    )),
  },
  handler: async (ctx, args) => {
    const levelMap = {
      "true-beginner": 0,
      "novice": 1,
      "intermediate": 2,
      "advanced": 3
    };

    const userLevel = args.fitnessLevel ? levelMap[args.fitnessLevel] : 3;

    return await ctx.db
      .query("workouts")
      .withIndex("by_tag", (q) => q.eq("tag", args.tag))
      .filter((q) => q.lte(q.field("levelMin"), userLevel))
      .filter((q) => q.or(
        q.eq(q.field("levelMax"), undefined),
        q.gte(q.field("levelMax"), userLevel)
      ))
      .collect();
  },
});

// Get workout by ID
export const getWorkout = query({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.workoutId);
  },
});

// Get all workout tags
export const getWorkoutTags = query({
  args: {},
  handler: async (ctx) => {
    const workouts = await ctx.db.query("workouts").collect();
    const tags = [...new Set(workouts.map(w => w.tag))];
    return tags.sort();
  },
});

// Add custom workout (for coaches or advanced users)
export const addCustomWorkout = mutation({
  args: {
    tag: v.string(),
    levelMin: v.number(),
    levelMax: v.optional(v.number()),
    name: v.string(),
    description: v.string(),
    structure: v.array(v.object({
      type: v.union(
        v.literal("warmup"),
        v.literal("main"),
        v.literal("recovery"),
        v.literal("cooldown")
      ),
      duration: v.optional(v.string()),
      distance: v.optional(v.number()),
      intensity: v.union(
        v.literal("easy"),
        v.literal("moderate"),
        v.literal("threshold"),
        v.literal("vo2max"),
        v.literal("recovery")
      ),
      instructions: v.string(),
      repetitions: v.optional(v.number()),
      restDuration: v.optional(v.string()),
    })),
    scalingFactors: v.optional(v.object({
      fiveK: v.number(),
      tenK: v.number(),
      halfMarathon: v.number(),
      marathon: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // For now, anyone can add workouts. In production, you might want to restrict this.
    const now = new Date().toISOString();
    
    return await ctx.db.insert("workouts", {
      ...args,
      createdAt: now,
    });
  },
}); 