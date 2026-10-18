import { z } from "zod";
import { DIFFICULTIES, QUESTION_STATUS, QUESTION_TYPES, TIE_BREAK_OPTIONS } from "./constants";

const username = z
  .string()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be at most 30 characters.")
  .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores only.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.")
  .regex(/[a-z]/, "Include at least one lowercase letter.")
  .regex(/[A-Z]/, "Include at least one uppercase letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email address.").max(254),
  password,
  displayName: z.string().min(2, "Enter your name.").max(80),
  username,
  state: z.string().max(80).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  acceptTerms: z.literal(true, { message: "You must accept the Terms of Service." }),
});

export const loginSchema = z.object({
  identifier: z.string().min(3, "Enter your email or username.").max(254),
  password: z.string().min(1, "Enter your password."),
});

export const verifyEmailSchema = z.object({ token: z.string().min(32) });
export const forgotPasswordSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({ token: z.string().min(32), password });

export const profileSchema = z.object({
  displayName: z.string().min(2).max(80),
  state: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  timezone: z.string().max(60).optional(),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().min(2, "Enter your name.").max(80).optional(),
  state: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  timezone: z.string().max(60).optional(),
  leaderboardOptOut: z.boolean().optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: password.optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password to confirm."),
  confirm: z.literal("DELETE", { message: 'Type DELETE to confirm.' }),
});

export const startAttemptSchema = z.object({ examId: z.string().min(1) });

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).max(10),
  markedForReview: z.boolean().optional(),
  visited: z.boolean().optional(),
});

export const attemptEventSchema = z.object({
  type: z.enum([
    "visibility_hidden",
    "visibility_visible",
    "window_blur",
    "window_focus",
    "fullscreen_enter",
    "fullscreen_exit",
    "refresh",
    "reconnect",
    "visited",
    "marked",
    "unmarked",
  ]),
  detail: z.record(z.string(), z.unknown()).optional(),
  clientTime: z.string().datetime().optional(),
});

const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, "Option text is required.").max(1000),
  isCorrect: z.boolean(),
});

export const questionSchema = z
  .object({
    subjectId: z.string().min(1),
    topicId: z.string().nullable().optional(),
    difficulty: z.enum([DIFFICULTIES.EASY, DIFFICULTIES.MEDIUM, DIFFICULTIES.HARD]),
    type: z.enum([QUESTION_TYPES.SINGLE_CHOICE, QUESTION_TYPES.MULTIPLE_CHOICE]),
    text: z.string().min(3).max(5000),
    explanation: z.string().max(5000).nullable().optional(),
    imageUrl: z.string().url().max(1000).nullable().optional().or(z.literal("")),
    source: z.string().max(300).nullable().optional(),
    license: z.string().max(300).nullable().optional(),
    options: z.array(optionSchema).min(2).max(8),
  })
  .superRefine((value, ctx) => {
    const correct = value.options.filter((option) => option.isCorrect).length;
    if (correct === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Mark at least one correct option." });
    }
    if (value.type === QUESTION_TYPES.SINGLE_CHOICE && correct > 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Single choice questions allow exactly one correct option." });
    }
  });

export const questionStatusSchema = z.object({
  status: z.enum([
    QUESTION_STATUS.DRAFT,
    QUESTION_STATUS.IN_REVIEW,
    QUESTION_STATUS.APPROVED,
    QUESTION_STATUS.PUBLISHED,
    QUESTION_STATUS.RETIRED,
  ]),
});

export const examSchema = z.object({
  title: z.string().min(3).max(150),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
  description: z.string().min(10).max(2000),
  categoryId: z.string().min(1),
  difficulty: z.enum([DIFFICULTIES.EASY, DIFFICULTIES.MEDIUM, DIFFICULTIES.HARD]),
  durationMinutes: z.number().int().min(1).max(360),
  marksPerCorrect: z.number().min(0).max(100),
  negativeMarksPerWrong: z.number().min(0).max(100),
  allowPartialCredit: z.boolean().default(false),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).max(100).nullable().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  publishResultsImmediately: z.boolean().default(true),
  resultsPublishAt: z.string().datetime().nullable().optional(),
  revealSolutions: z.boolean().default(true),
  requiresDesktop: z.boolean().default(false),
  maxFocusWarnings: z.number().int().min(0).max(100).default(5),
  tieBreakRules: z.array(z.enum(Object.keys(TIE_BREAK_OPTIONS) as [string, ...string[]])).default([]),
  instructions: z.string().max(5000).nullable().optional(),
  sections: z
    .array(
      z.object({
        subjectId: z.string().min(1),
        title: z.string().min(1).max(100),
        questionCount: z.number().int().min(1).max(200),
        marksPerCorrect: z.number().min(0).max(100).nullable().optional(),
        negativeMarksPerWrong: z.number().min(0).max(100).nullable().optional(),
      }),
    )
    .min(1, "Add at least one section.")
    .max(10),
});

export const examUpdateSchema = examSchema.partial().extend({
  sections: examSchema.shape.sections.optional(),
});

export const assignQuestionsSchema = z.object({
  examId: z.string().min(1),
  sectionId: z.string().min(1),
  questionIds: z.array(z.string().min(1)).min(1).max(500),
});

export const userUpdateSchema = z.object({
  role: z.enum(["STUDENT", "QUESTION_EDITOR", "EXAM_MANAGER", "ADMIN", "SUPER_ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]).optional(),
});

export const alertReviewSchema = z.object({
  action: z.enum(["RESOLVE", "DISMISS"]),
  note: z.string().max(1000).optional(),
});

export const attemptAdminSchema = z.object({
  action: z.enum(["INVALIDATE", "RELEASE_SESSION", "RECALCULATE"]),
  reason: z.string().max(500).optional(),
});

export const questionDefectiveSchema = z.object({
  defective: z.boolean(),
  reason: z.string().min(3).max(500),
});

export const settingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  registrationOpen: z.boolean().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  subject: z.string().min(3).max(150),
  message: z.string().min(10).max(3000),
});

export const reportQuestionSchema = z.object({
  reason: z.string().min(3).max(1000),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ExamInput = z.infer<typeof examSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
