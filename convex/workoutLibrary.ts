export interface VariantConfig {
  pattern: string;
  repeats?: number;
  summary?: string;
}

export interface WorkoutSkeleton {
  type: string;
  subType?: string;
  description: string;
  globalDescription?: string; // Add this for detailed UI descriptions
  steps?: any[]; // for distance-based runs etc.
  warmup?: any;
  cooldown?: any;
  variants?: Record<string, VariantConfig>;
  updatedAt: string;
}

// Canonical workout library keyed by token base (R, E, L, X, T, F, U…)
export const WORKOUT_LIBRARY: Record<string, WorkoutSkeleton> = {
  R: { 
    type: "rest", 
    description: "Rest day", 
    globalDescription: "Recovery is an essential part of training. Your body repairs and strengthens during rest, making you ready for the next challenge.",
    steps: [], 
    updatedAt: "" 
  },

  // Walk/Run c25k workout
  WR: {
    type: "run",
    description: "Walk/Run",
    globalDescription: "Build your running endurance gradually with structured walk-run intervals. This proven approach helps beginners develop cardiovascular fitness while reducing injury risk.",
    warmup: { label: "Warmup", duration: "5 min", effort: "easy" },
    cooldown: { label: "Cool-down", duration: "5 min", effort: "easy" },
    variants: {
      "1": { pattern: "60s run / 90s walk", repeats: 8, summary: "Repeat 8 times: 60 sec run, 90 sec walk" },
      "2": { pattern: "90s run / 120s walk", repeats: 6, summary: "Repeat 6 times: 90 sec run, 2 min walk" },
      "3": { pattern: "90s run / 90s walk / 180s run / 180s walk", repeats: 2, summary: "Repeat 2 times: 90s run, 90s walk, 3 min run, 3 min walk" },
      "4": { pattern: "3m run / 90s walk / 5m run / 2.5m walk / 3m run / 90s walk / 5m run", summary: "A varied pace run with walking breaks" },
      "5A": { pattern: "5m run / 3m walk / 5m run / 3m walk / 5m run", summary: "3x 5 minute runs with 3 minute walk breaks" },
      "5B": { pattern: "8m run / 5m walk / 8m run", summary: "Two 8-minute runs with a 5 minute walk break" },
      "5C": { pattern: "20m run", summary: "Continuous 20 minute run" },
      "6A": { pattern: "5m run / 3m walk / 8m run / 3m walk / 5m run", summary: "Two 5-minute and one 8-minute run with walk breaks" },
      "6B": { pattern: "10m run / 3m walk / 10m run", summary: "Two 10-minute runs with a 3 minute walk break" },
      "6C": { pattern: "25m run", summary: "Continuous 25 minute run" },
      "7": { pattern: "25m run", summary: "Continuous 25 minute run" },
      "8": { pattern: "28m run", summary: "Continuous 28 minute run" },
      "9": { pattern: "30m run", summary: "Continuous 30 minute run" },
    },
    updatedAt: "",
  },

  // Easy run – placeholders for distance (km/mi)
  E: {
    type: "run",
    subType: "easy",
    description: "{{mi}} mi easy run", // will be hydrated
    globalDescription: "Easy runs form the foundation of your training. Run at a comfortable pace where you can hold a conversation, building your aerobic base and endurance.",
    steps: [
      { order: 1, label: "Run", distance: "{{km}}", effort: "easy" }
    ],
    updatedAt: "",
  },

  // Long run skeleton
  L: {
    type: "run",
    subType: "long",
    description: "{{mi}} mi long run",
    globalDescription: "Long runs build cardiovascular endurance and mental toughness. Focus on maintaining a steady, comfortable effort throughout the duration.",
    steps: [
      { order: 1, label: "Run", distance: "{{km}}", effort: "easy" }
    ],
    updatedAt: "",
  },

  // Cross-training placeholder (minutes)
  X: {
    type: "cross-train",
    description: "{{min}} min cross-training",
    globalDescription: "Cross-training activities like cycling, swimming, or yoga complement your running by building strength, improving flexibility, and providing active recovery.",
    steps: [
      { order: 1, duration: "{{min}} min", effort: "moderate" }
    ],
    updatedAt: "",
  },

  // Tempo run skeleton (placeholder speed/distance)
  T: {
    type: "run",
    subType: "tempo",
    description: "Tempo run – {{mi}} mi at threshold",
    globalDescription: "Tempo runs improve your lactate threshold and race pace. Run at a 'comfortably hard' effort where you can only speak a few words at a time.",
    steps: [
      { order: 1, label: "Warm-up", duration: "10 min", effort: "easy" },
      { order: 2, label: "Tempo", distance: "{{km}}", effort: "hard" },
      { order: 3, label: "Cool-down", duration: "10 min", effort: "easy" }
    ],
    updatedAt: "",
  },

  // Fartlek skeleton (placeholder distance/time)
  F: {
    type: "run",
    subType: "interval",
    description: "Fartlek – {{min}} min session",
    globalDescription: "Fartlek training combines fast and slow running in an unstructured format. Vary your pace based on how you feel, building speed and mental flexibility.",
    steps: [
      { order: 1, label: "Warm-up", duration: "10 min", effort: "easy" },
      { order: 2, label: "Fartlek", duration: "{{min}} min", effort: "hard" },
      { order: 3, label: "Cool-down", duration: "10 min", effort: "easy" }
    ],
    updatedAt: "",
  },

  // Tune-up / shake-out run
  U: {
    type: "run",
    subType: "recovery",
    description: "{{mi}} mi shake-out run",
    globalDescription: "Recovery runs help flush out metabolic waste and promote blood flow to tired muscles. Keep the effort very easy and focus on relaxed form.",
    steps: [
      { order: 1, label: "Run", distance: "{{km}}", effort: "very easy" }
    ],
    updatedAt: "",
  },
}; 