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
  }
}; 