export interface Scenario {
  id: string;
  short: string;
  lead: string;
  body: string;
  act: string;
  avoid: string;
  /** Illustrative slider presets for the simulator */
  effort: number;
  reward: number;
}

/** Illustrative everyday scenarios — not a validated psychological test. */
export const OPENING: Scenario = {
  id: 'trash',
  short: 'Trash',
  lead: 'You are sitting on your couch.',
  body: "You know you should get up and take out the trash. But you really don't want to.",
  act: 'I do it anyway',
  avoid: 'I put it off',
  effort: 3,
  reward: 3,
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'exercise',
    short: 'Workout',
    lead: 'You are tired.',
    body: 'You planned to exercise today.',
    act: 'Exercise anyway',
    avoid: "Skip today's workout",
    effort: 7,
    reward: 6,
  },
  {
    id: 'phone',
    short: 'Phone',
    lead: 'You are studying.',
    body: 'Your phone is next to you. A notification lights up the screen.',
    act: 'Continue studying',
    avoid: 'Check your phone',
    effort: 5,
    reward: 5,
  },
  {
    id: 'avoided',
    short: 'Avoided task',
    lead: 'A task has waited for days.',
    body: 'You have been avoiding it. It is still there.',
    act: 'Start it now',
    avoid: 'Delay it again',
    effort: 6,
    reward: 7,
  },
  {
    id: 'route',
    short: 'Hard route',
    lead: 'Two ways forward.',
    body: 'One is easy. The other takes more effort — and teaches you more.',
    act: 'Choose the harder task',
    avoid: 'Choose the easier one',
    effort: 8,
    reward: 7,
  },
  {
    id: 'commitment',
    short: 'Commitment',
    lead: 'You would rather relax.',
    body: 'But you made a commitment to yourself.',
    act: 'Follow through',
    avoid: 'Take a break, postpone it',
    effort: 6,
    reward: 6,
  },
];

/** All scenarios — used as presets in the simulator. */
export const ALL_SCENARIOS = [OPENING, ...SCENARIOS];

/** The onboarding: the opening dilemma plus two scenarios (3 questions in total). */
export const QUESTIONS = [OPENING, SCENARIOS[0], SCENARIOS[1]];

export type Choice = 'act' | 'avoid';
