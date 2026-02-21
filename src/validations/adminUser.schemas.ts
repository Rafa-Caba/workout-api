import { z } from "zod";

/**
 * Coaching
 */
export const coachModeSchema = z.enum(["NONE", "TRAINER", "TRAINEE"]);
export type CoachMode = z.infer<typeof coachModeSchema>;

/**
 * Common helpers
 */
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const objectIdSchema = z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

/**
 * =========================================================
 * Base object (NO refinements here)
 * =========================================================
 */
const adminUserBaseObjectSchema = z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(254),

    role: z.enum(["admin", "user"]).optional().default("user"),
    sex: z.enum(["male", "female", "other"]).nullable().optional(),
    isActive: z.boolean().optional(),

    profilePicUrl: z.string().max(2000).nullable().optional(),

    heightCm: z.number().min(0).max(300).nullable().optional(),
    currentWeightKg: z.number().min(0).max(500).nullable().optional(),

    units: z
        .object({
            weight: z.enum(["kg", "lb"]),
            distance: z.enum(["km", "mi"]),
        })
        .nullable()
        .optional(),

    birthDate: isoDateSchema.nullable().optional(), // YYYY-MM-DD

    activityGoal: z
        .enum(["fat_loss", "hypertrophy", "strength", "maintenance", "other"])
        .nullable()
        .optional(),

    timezone: z.string().max(100).nullable().optional(),

    /**
     * Coaching
     */
    coachMode: coachModeSchema.optional().default("NONE"),
    assignedTrainer: objectIdSchema.nullable().optional().default(null),
});

/**
 * =========================================================
 * Create user
 * - Includes password
 * - Full cross-field enforcement for coaching
 * =========================================================
 */
export const adminCreateUserSchema = adminUserBaseObjectSchema
    .extend({
        password: z.string().min(8).max(128),
    })
    .superRefine((val, ctx) => {
        const coachMode = val.coachMode ?? "NONE";
        const assignedTrainer = val.assignedTrainer ?? null;

        // Cross-field rule:
        // - TRAINEE => assignedTrainer required (non-null)
        // - NONE/TRAINER => assignedTrainer must be null
        if (coachMode === "TRAINEE") {
            if (!assignedTrainer) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["assignedTrainer"],
                    message: 'assignedTrainer is required when coachMode is "TRAINEE".',
                });
            }
        } else {
            if (assignedTrainer !== null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["assignedTrainer"],
                    message: 'assignedTrainer must be null unless coachMode is "TRAINEE".',
                });
            }
        }
    });

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

/**
 * =========================================================
 * Update user
 * - Partial updates
 * - If coachMode is provided, enforce strict cross-field rules
 * =========================================================
 */
export const adminUpdateUserSchema = adminUserBaseObjectSchema
    .partial()
    .superRefine((val, ctx) => {
        // Only enforce coaching rule if coachMode is explicitly being updated
        if (val.coachMode === undefined) return;

        const coachMode = val.coachMode ?? "NONE";
        const assignedTrainer =
            val.assignedTrainer === undefined ? undefined : val.assignedTrainer;

        if (coachMode === "TRAINEE") {
            // If switching to TRAINEE, require assignedTrainer in this request
            if (assignedTrainer === undefined || assignedTrainer === null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["assignedTrainer"],
                    message:
                        'assignedTrainer is required when setting coachMode to "TRAINEE".',
                });
            }
        } else {
            // If switching to NONE/TRAINER, assignedTrainer must be null (or omitted)
            if (assignedTrainer !== undefined && assignedTrainer !== null) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["assignedTrainer"],
                    message:
                        'assignedTrainer must be null when coachMode is not "TRAINEE".',
                });
            }
        }
    });

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

/**
 * Password update (separate endpoint)
 */
export const adminUpdatePasswordSchema = z.object({
    password: z.string().min(8).max(128),
});

export type AdminUpdatePasswordInput = z.infer<typeof adminUpdatePasswordSchema>;

/**
 * Params
 */
export const adminUserIdParamsSchema = z.object({
    id: objectIdSchema,
});

export type AdminUserIdParams = z.infer<typeof adminUserIdParamsSchema>;

/**
 * Query params for list endpoint
 * - page/limit coercion
 * - isActive parsed manually in controller
 * - allow coachMode filter
 */
export const adminListUsersQuerySchema = z.object({
    q: z.string().trim().min(1).max(120).optional(),
    role: z.enum(["admin", "user"]).optional(),

    coachMode: coachModeSchema.optional(),

    page: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 1)),
    limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 20)),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema> & {
    isActive?: boolean;
};