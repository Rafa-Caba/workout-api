import { z } from "zod";

const ISODateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

export const updateMeSchema = z.object({
    name: z.string().min(1).max(120).optional(),

    sex: z.enum(["male", "female", "other"]).nullable().optional(),

    heightCm: z.number().min(0).max(300).nullable().optional(),
    currentWeightKg: z.number().min(0).max(500).nullable().optional(),

    units: z
        .object({
            weight: z.enum(["kg", "lb"]),
            distance: z.enum(["km", "mi"]),
        })
        .nullable()
        .optional(),

    birthDate: ISODateSchema.nullable().optional(),

    activityGoal: z
        .enum(["fat_loss", "hypertrophy", "strength", "maintenance", "other"])
        .nullable()
        .optional(),

    timezone: z.string().max(120).nullable().optional(),

    /**
     * Baseline training profile (user-owned)
     */
    trainingLevel: z
        .enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"])
        .nullable()
        .optional(),

    healthNotes: z.string().max(5000).nullable().optional(),
});