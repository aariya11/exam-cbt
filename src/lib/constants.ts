// Central domain constants. Stored values in the database are plain strings so
// the schema stays portable (SQLite has no enum support); these objects are the
// single source of truth in application code.

export const ROLES = {
  STUDENT: "STUDENT",
  QUESTION_EDITOR: "QUESTION_EDITOR",
  EXAM_MANAGER: "EXAM_MANAGER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Higher rank = more privileges. Used by hasRole().
const ROLE_RANK: Record<Role, number> = {
  STUDENT: 0,
  QUESTION_EDITOR: 1,
  EXAM_MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function isAtLeastRole(role: string, min: Role): boolean {
  const rank = ROLE_RANK[role as Role];
  return rank !== undefined && rank >= ROLE_RANK[min];
}

export const STAFF_ROLES: Role[] = [
  ROLES.QUESTION_EDITOR,
  ROLES.EXAM_MANAGER,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

export const DIFFICULTIES = {
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
} as const;
export type Difficulty = (typeof DIFFICULTIES)[keyof typeof DIFFICULTIES];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const QUESTION_TYPES = {
  SINGLE_CHOICE: "SINGLE_CHOICE",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
} as const;
export type QuestionType = (typeof QUESTION_TYPES)[keyof typeof QUESTION_TYPES];

export const QUESTION_STATUS = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  PUBLISHED: "PUBLISHED",
  RETIRED: "RETIRED",
} as const;
export type QuestionStatus = (typeof QUESTION_STATUS)[keyof typeof QUESTION_STATUS];

export const EXAM_STATUS = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;
export type ExamStatus = (typeof EXAM_STATUS)[keyof typeof EXAM_STATUS];

export const ATTEMPT_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  AUTO_SUBMITTED: "AUTO_SUBMITTED",
  INVALIDATED: "INVALIDATED",
} as const;
export type AttemptStatus = (typeof ATTEMPT_STATUS)[keyof typeof ATTEMPT_STATUS];

export const USER_STATUS = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
} as const;

export const TIE_BREAK_OPTIONS = {
  ACCURACY_DESC: "Higher accuracy first",
  WRONG_ASC: "Fewer incorrect answers first",
  ATTEMPTED_DESC: "More questions attempted first",
  TIME_ASC: "Less time used first (only where the examination rules allow)",
} as const;
export type TieBreakRule = keyof typeof TIE_BREAK_OPTIONS;

export const PAPER_VERSION = 1;

// Attempt event types recorded for monitoring and integrity review.
export const ATTEMPT_EVENTS = {
  START: "start",
  RESUME: "resume",
  ANSWER_SAVED: "answer_saved",
  CLEARED: "cleared",
  MARKED: "marked",
  UNMARKED: "unmarked",
  VISITED: "visited",
  VISIBILITY_HIDDEN: "visibility_hidden",
  VISIBILITY_VISIBLE: "visibility_visible",
  WINDOW_BLUR: "window_blur",
  WINDOW_FOCUS: "window_focus",
  FULLSCREEN_ENTER: "fullscreen_enter",
  FULLSCREEN_EXIT: "fullscreen_exit",
  REFRESH: "refresh",
  RECONNECT: "reconnect",
  SUBMIT: "submit",
  AUTO_FINALIZE: "auto_finalize",
  CONCURRENT_ACCESS: "concurrent_access",
  DEADLINE_REJECTED: "deadline_rejected",
} as const;
export type AttemptEventType = (typeof ATTEMPT_EVENTS)[keyof typeof ATTEMPT_EVENTS];

// Events that are considered focus-loss signals for warning counters.
export const FOCUS_LOSS_EVENTS: string[] = [
  ATTEMPT_EVENTS.VISIBILITY_HIDDEN,
  ATTEMPT_EVENTS.WINDOW_BLUR,
  ATTEMPT_EVENTS.FULLSCREEN_EXIT,
];

export const INTEGRITY_ALERT_TYPES = {
  CONCURRENT_ACCESS: "CONCURRENT_ACCESS",
  FOCUS_LOSS_THRESHOLD: "FOCUS_LOSS_THRESHOLD",
  DEADLINE_ANOMALY: "DEADLINE_ANOMALY",
  REPEATED_DEADLINE_REJECTIONS: "REPEATED_DEADLINE_REJECTIONS",
  UNUSUAL_SUBMISSION_PATTERN: "UNUSUAL_SUBMISSION_PATTERN",
} as const;

export const ACHIEVEMENTS = {
  FIRST_ATTEMPT: {
    code: "FIRST_ATTEMPT",
    title: "First Steps",
    description: "Completed your first RankForge mock test.",
    icon: "flag",
  },
  CONSISTENT_FIVE: {
    code: "CONSISTENT_FIVE",
    title: "Consistent Candidate",
    description: "Completed five mock tests.",
    icon: "repeat",
  },
  PERFECT_SCORE: {
    code: "PERFECT_SCORE",
    title: "Perfect Paper",
    description: "Scored full marks on a mock test with at least 10 questions.",
    icon: "star",
  },
  SHARPSHOOTER: {
    code: "SHARPSHOOTER",
    title: "Sharpshooter",
    description: "100% accuracy with at least 20 questions attempted.",
    icon: "target",
  },
  HARD_50: {
    code: "HARD_50",
    title: "Hard Mode",
    description: "Scored at least 50% on a Hard difficulty mock test.",
    icon: "flame",
  },
  TOP_10: {
    code: "TOP_10",
    title: "Top Ten",
    description: "Finished a published mock test inside the top 10.",
    icon: "trophy",
  },
} as const;

export type AchievementCode = keyof typeof ACHIEVEMENTS;

export const SYSTEM_SETTING_KEYS = {
  MAINTENANCE_MODE: "maintenance_mode",
  REGISTRATION_OPEN: "registration_open",
} as const;

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 50;

// Student-facing label for a ranking, to avoid implying official examination
// result rankings. Used in UI copy.
export const RANKING_DISCLAIMER =
  "Rankings reflect performance among RankForge participants who took the same mock test under these rules. They are practice rankings and not official examination results.";

export const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;
