import { z } from "zod";

export const adminCreateUserSchema = z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    password: z.string().min(8).max(128),

    role: z.enum(["admin", "user"]).optional().default("user"),

    sex: z.enum(["male", "female", "other"]).nullable().optional(),

    isActive: z.boolean().optional(),

    heightCm: z.number().min(0).max(300).nullable().optional(),
    currentWeightKg: z.number().min(0).max(500).nullable().optional(),

    units: z
        .object({
            weight: z.enum(["kg", "lb"]),
            distance: z.enum(["km", "mi"]),
        })
        .nullable()
        .optional(),

    birthDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(), // YYYY-MM-DD

    activityGoal: z
        .enum(["fat_loss", "hypertrophy", "strength", "maintenance", "other"])
        .nullable()
        .optional(),

    timezone: z.string().max(100).nullable().optional(),
});

export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

export const adminUpdateUserSchema = adminCreateUserSchema
    .omit({ password: true })
    .partial();

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export const adminUpdatePasswordSchema = z.object({
    password: z.string().min(8).max(128),
});

export type AdminUpdatePasswordInput = z.infer<typeof adminUpdatePasswordSchema>;

// Query params for list endpoint (page, limit, q, role)
// isActive lo parseamos manualmente en el controller
export const adminListUsersQuerySchema = z.object({
    q: z.string().trim().min(1).max(120).optional(),
    role: z.enum(["admin", "user"]).optional(),
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
