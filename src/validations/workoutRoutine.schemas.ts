import { z } from "zod";

const weekKeySchema = z.string().regex(/^\d{4}-W\d{2}$/, "Invalid weekKey format (expected YYYY-W##)");

const dayKeySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export const routineWeekParamsSchema = z.object({
    weekKey: weekKeySchema,
});

export const routineInitQuerySchema = z.object({
    title: z.string().min(1).max(200).optional(),
    split: z.string().min(1).max(200).optional(),
    unarchive: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => {
            if (typeof v === "boolean") return v;
            if (typeof v === "string") return v === "true";
            return undefined;
        }),
});

export const routineArchiveQuerySchema = z.object({
    archived: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => {
            if (typeof v === "boolean") return v;
            if (typeof v === "string") return v === "true";
            return undefined;
        }),
});

const routineExerciseSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(200),
    sets: z.number().min(0).max(99).nullable().optional(),
    reps: z.string().max(50).nullable().optional(),
    rpe: z.number().min(0).max(10).nullable().optional(),
    load: z.string().max(100).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    attachmentPublicIds: z.array(z.string().min(1)).nullable().optional(),
});

const routineDaySchema = z.object({
    dayKey: dayKeySchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)").optional(),

    sessionType: z.string().max(200).nullable().optional(),
    focus: z.string().max(500).nullable().optional(),

    exercises: z.array(routineExerciseSchema).nullable().optional(),

    notes: z.string().max(5000).nullable().optional(),
    tags: z.array(z.string().min(1)).nullable().optional(),
});

export const routineUpsertBodySchema = z
    .object({
        title: z.string().max(200).nullable().optional(),
        split: z.string().max(200).nullable().optional(),
        plannedDays: z.array(dayKeySchema).nullable().optional(),

        // ✅ Zod v4: record(keyType, valueType)
        meta: z.record(z.string(), z.unknown()).nullable().optional(),

        // Either full days array or single day patch
        days: z.array(routineDaySchema).optional(),
        day: routineDaySchema.optional(),
    })
    .strict();

export const routineAttachmentUploadQuerySchema = z.object({}).passthrough();

export const routineAttachmentDeleteQuerySchema = z.object({
    publicId: z.string().min(1),
    deleteCloudinary: z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((v) => {
            if (typeof v === "boolean") return v;
            if (typeof v === "string") return v === "true";
            return undefined;
        }),
});

/**
 * =========================================================
 * Gym Check (sync checklist + day metrics)
 * =========================================================
 */

export const routineGymCheckParamsSchema = z.object({
    weekKey: weekKeySchema,
    dayKey: dayKeySchema,
});

const gymCheckExercisePatchSchema = z
    .object({
        done: z.boolean().nullable().optional(),
        notes: z.string().max(3000).nullable().optional(),
        durationMin: z.number().min(0).max(24 * 60).nullable().optional(),
        mediaPublicIds: z.array(z.string().min(1)).nullable().optional(),
    })
    .strict();

const gymCheckMetricsPatchSchema = z
    .object({
        startAt: z.string().max(60).nullable().optional(), // ISO datetime string
        endAt: z.string().max(60).nullable().optional(), // ISO datetime string

        activeKcal: z.number().min(0).max(200000).nullable().optional(),
        totalKcal: z.number().min(0).max(200000).nullable().optional(),

        avgHr: z.number().min(0).max(300).nullable().optional(),
        maxHr: z.number().min(0).max(300).nullable().optional(),

        distanceKm: z.number().min(0).max(100000).nullable().optional(),
        steps: z.number().min(0).max(500000).nullable().optional(),
        elevationGainM: z.number().min(0).max(100000).nullable().optional(),

        paceSecPerKm: z.number().min(0).max(1000000).nullable().optional(),
        cadenceRpm: z.number().min(0).max(10000).nullable().optional(),

        effortRpe: z.number().min(0).max(10).nullable().optional(),

        trainingSource: z.string().max(120).nullable().optional(),
        dayEffortRpe: z.number().min(0).max(10).nullable().optional(),
    })
    .strict();

export const routineGymCheckPatchBodySchema = z
    .object({
        durationMin: z.number().min(0).max(24 * 60).nullable().optional(),
        notes: z.string().max(5000).nullable().optional(),

        metrics: gymCheckMetricsPatchSchema.nullable().optional(),

        // ✅ Zod v4: record(keyType, valueType)
        exercises: z.record(z.string(), gymCheckExercisePatchSchema).nullable().optional(),
    })
    .strict();

export const routineWeeksListQuerySchema = z.object({
    status: z.enum(["active", "archived"]).optional(),
    limit: z
        .union([z.number(), z.string()])
        .optional()
        .transform((v) => {
            const n = typeof v === "string" ? Number(v) : v;
            if (!n || Number.isNaN(n)) return 20;
            return Math.max(1, Math.min(100, Math.floor(n)));
        }),
});