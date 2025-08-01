export type TokenBase = "R" | "E" | "L" | "T" | "F" | "X" | "U" | "WR";
export type Token = `${TokenBase}${string}`;

export interface PlanTemplate {
  name: string;
  weeks: Token[][]; // 7 tokens per inner array, Sunday-first
}

// --- Example templates ------------------------------------------------------
// NOTE: These are minimal stubs so the new generator works end-to-end.
//       Flesh them out later with full real schedules.

export const planTemplates: Record<string, PlanTemplate> = {
  // Couch-to-5K (9 weeks). Distances are in miles for E/L tokens.
  C25K: {
    name: "Couch to 5K – 9 wk",
    weeks: [
      // Week 1 – 3x WR1 sessions
      ["R", "WR/1", "R", "WR/1", "R", "WR/1", "R"],
      // Week 2 – 3x WR2 sessions
      ["R", "WR/2", "R", "WR/2", "R", "WR/2", "R"],
      // Week 3 – 3x WR3 sessions
      ["R", "WR/3", "R", "WR/3", "R", "WR/3", "R"],
      // Week 4 – 3x WR4 sessions
      ["R", "WR/4", "R", "WR/4", "R", "WR/4", "R"],
      // Week 5 – three distinct workouts
      ["R", "WR/5A", "R", "WR/5B", "R", "WR/5C", "R"],
      // Week 6 – three distinct workouts
      ["R", "WR/6A", "R", "WR/6B", "R", "WR/6C", "R"],
      // Week 7 – 3x WR7 sessions
      ["R", "WR/7", "R", "WR/7", "R", "WR/7", "R"],
      // Week 8 – 3x WR8 sessions
      ["R", "WR/8", "R", "WR/8", "R", "WR/8", "R"],
      // Week 9 – 3x WR9 sessions (final)
      ["R", "WR/9", "R", "WR/9", "R", "WR/9", "R"],
    ]
  },

  // 16-week Marathon finish-strong (stub – first 4 wks only for brevity)
  M16: {
    name: "Marathon – 16 wk finish-strong",
    weeks: [
      ["R", "E4", "E5", "X40", "E5", "R", "L8"],
      ["R", "E4", "E5", "X40", "E6", "R", "L9"],
      ["R", "E4", "E6", "X40", "E6", "R", "L10"],
      ["R", "E4", "E6", "X40", "E7", "R", "L11"],
      // ...extend up to 16 weeks in real file
    ]
  },

  // ────────────────────────────────────────────────────────────
  // BEGINNER-FOCUSED ADDITIONAL PLANS
  // ────────────────────────────────────────────────────────────

  // New to Running – 8-week (3 runs/week)
  N2R8: {
    name: "New to Running – 8 wk",
    weeks: [
      ["R", "WR/1", "R", "WR/1", "R", "WR/1", "R"],
      ["R", "WR/1", "R", "WR/1", "R", "WR/1", "R"],
      ["R", "WR/2", "R", "WR/3", "R", "WR/3", "R"],
      ["R", "WR/2", "R", "WR/3", "R", "WR/3", "R"],
      ["R", "WR/4", "R", "WR/5A", "R", "WR/5B", "R"],
      ["R", "WR/5C", "R", "WR/6A", "R", "WR/6B", "R"],
      ["R", "WR/6C", "R", "WR/7", "R", "WR/7", "R"],
      ["R", "WR/8", "R", "WR/8", "R", "WR/9", "R"],
    ],
  },

  // 5K Improvement – 8-week (3 runs/week)
  F5K8: {
    name: "5K Improvement – 8 wk",
    weeks: [
      ["R", "E2", "R", "T1", "R", "L3", "R"],
      ["R", "E2", "R", "T1", "R", "L3", "R"],
      ["R", "E2", "R", "T2", "R", "L4", "R"],
      ["R", "E2", "R", "T2", "R", "L4", "R"],
      ["R", "E3", "R", "F15", "R", "L4.5", "R"],
      ["R", "E3", "R", "F15", "R", "L4.5", "R"],
      ["R", "E3", "R", "T3", "R", "L5", "R"],
      ["R", "E3", "R", "T3", "R", "L5", "R"],
    ],
  },

  // First 10K – 10-week (4 runs/week)
  B10K: {
    name: "First 10K – 10 wk",
    weeks: [
      ["L3", "E2", "R", "T1", "R", "E2", "R"], // Week 1
      ["L3", "E2", "R", "T1", "R", "E2", "R"], // Week 2
      ["L4", "E2", "R", "F15", "R", "E3", "R"], // Week 3
      ["L4", "E2", "R", "F15", "R", "E3", "R"], // Week 4
      ["L4.5", "E3", "R", "T2", "R", "E3", "R"], // Week 5
      ["L5", "E3", "R", "F20", "R", "E3", "R"], // Week 6
      ["L5.5", "E3", "R", "T3", "R", "E3", "R"], // Week 7
      ["L6", "E3", "R", "F20", "R", "E3", "R"], // Week 8
      ["L4", "E2", "R", "T2", "R", "U2", "R"], // Week 9 – cut-back
      ["L6.2", "E2", "R", "T1", "R", "U2", "R"], // Week 10 – race sim
    ],
  },

  // Returning to Running – 6-week (2–3 runs/week)
  RTR6: {
    name: "Returning to Running – 6 wk",
    weeks: [
      ["R", "WR/6C", "R", "E2", "R", "R", "R"], // Week 1
      ["R", "WR/7", "R", "E2.5", "R", "R", "R"], // Week 2
      ["R", "WR/7", "R", "E3", "R", "R", "R"], // Week 3
      ["R", "E2", "R", "F12", "R", "E2", "R"], // Week 4
      ["L4", "E2.5", "R", "T1", "R", "R", "R"], // Week 5
      ["U2", "E2", "R", "T1", "R", "R", "R"], // Week 6
    ],
  },

  // Maintenance / Keep-Fit – 12-week (rolling, 4 sessions/week)
  MAINT12: {
    name: "Maintenance – 12 wk",
    weeks: [
      ["R", "E3", "X40", "R", "F20", "R", "L5"], // Week 1
      ["R", "E3", "X40", "R", "T2", "R", "L5"], // Week 2
      ["R", "E3", "X40", "R", "U3", "R", "L3"], // Week 3 cut-back
      ["R", "E3", "X40", "R", "F20", "R", "L5"], // Week 4
      ["R", "E3", "X40", "R", "T2", "R", "L5"], // Week 5
      ["R", "E3", "X40", "R", "U3", "R", "L3"], // Week 6 cut-back
      ["R", "E3", "X40", "R", "F20", "R", "L5"], // Week 7
      ["R", "E3", "X40", "R", "T2", "R", "L5"], // Week 8
      ["R", "E3", "X40", "R", "U3", "R", "L3"], // Week 9 cut-back
      ["R", "E3", "X40", "R", "F20", "R", "L5"], // Week 10
      ["R", "E3", "X40", "R", "T2", "R", "L5"], // Week 11
      ["R", "E3", "X40", "R", "U3", "R", "L3"], // Week 12 cut-back
    ],
  },
}; 