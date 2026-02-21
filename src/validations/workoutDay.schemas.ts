import { z } from "zod";

/**
 * =========================================================
 * Small primitives
 * =========================================================
 */

export const isoDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date format: YYYY-MM-DD");

export const weekKeySchema = z
    .string()
    .regex(/^\d{4}-W\d{2}$/, "Expected weekKey format: YYYY-W##");

const boolFromQuery = z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
        if (s === "false" || s === "0" || s === "no" || s === "off") return false;
    }
    return v;
}, z.boolean());

const numberFromQuery = z.coerce.number();

const intFromQuery = numberFromQuery
    .refine((n) => Number.isFinite(n), "Expected a finite number")
    .refine((n) => Number.isInteger(n), "Expected an integer");

const nonNegIntFromQuery = intFromQuery.refine((n) => n >= 0, "Expected >= 0");
const nonNegNumFromQuery = numberFromQuery
    .refine((n) => Number.isFinite(n), "Expected a finite number")
    .refine((n) => n >= 0, "Expected >= 0");

const recordUnknown = z.record(z.string(), z.unknown());
const recordUnknownNullable = recordUnknown.nullable();

export const dayParamsSchema = z.object({
    date: isoDateSchema,
});

export const sessionParamsSchema = z.object({
    date: isoDateSchema,
    sessionId: z.string().min(1),
});

export const weekParamsSchema = z.object({
    weekKey: weekKeySchema,
});

export const upsertDayQuerySchema = z.object({
    mode: z.enum(["merge", "replace"]).optional(),
});

const fieldsSchema = z.preprocess((v) => {
    if (typeof v === "string") {
        return v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return v;
}, z.array(z.string()).optional());

export const rangeQuerySchema = z.object({
    from: isoDateSchema,
    to: isoDateSchema,
});

export const calendarQuerySchema = z.object({
    from: isoDateSchema,
    to: isoDateSchema,
    fields: fieldsSchema.optional(),

    fillMissingDays: boolFromQuery.optional(),
    includeRollups: boolFromQuery.optional(),

    includeSleep: boolFromQuery.optional(),
    includeTraining: boolFromQuery.optional(),
    includeSummaries: boolFromQuery.optional(),
    includeTotals: boolFromQuery.optional(),
    includeTypes: boolFromQuery.optional(),
    includeRaw: boolFromQuery.optional(),
});

export const weekQuerySchema = z.object({
    fields: fieldsSchema.optional(),

    fillMissingDays: boolFromQuery.optional(),
    includeRollups: boolFromQuery.optional(),

    includeSleep: boolFromQuery.optional(),
    includeTraining: boolFromQuery.optional(),
    includeSummaries: boolFromQuery.optional(),
    includeTotals: boolFromQuery.optional(),
    includeTypes: boolFromQuery.optional(),
    includeRaw: boolFromQuery.optional(),
});

export const statsQuerySchema = z.object({
    from: isoDateSchema,
    to: isoDateSchema,
});

export const mediaUploadQuerySchema = z.object({
    returnMode: z.enum(["day", "session"]).optional(),
});

export const mediaDeleteQuerySchema = z.object({
    publicId: z.string().min(1),
    returnMode: z.enum(["day", "session"]).optional(),
});

/**
 * NEW: Attach existing media items (no upload)
 * - Mirrors WorkoutMediaItemSchema in WorkoutDay.model
 */
export const attachSessionMediaQuerySchema = z.object({
    returnMode: z.enum(["day", "session"]).optional(),
});

const attachMediaItemSchema = z
    .object({
        publicId: z.string().min(1).max(300),
        url: z.string().url().max(2000),
        resourceType: z.enum(["image", "video"]),
        format: z.string().max(30).nullable().optional(),
        createdAt: z.string().min(10).nullable().optional(), // ISO string-ish (we'll normalize in controller if null)
        meta: recordUnknownNullable.optional(),
    })
    .strict();

export const attachSessionMediaBodySchema = z
    .object({
        items: z.array(attachMediaItemSchema).min(1, "Expected at least 1 media item"),
    })
    .strict();

const sleepSchema = z
    .object({
        timeAsleepMinutes: nonNegIntFromQuery.nullable().optional(),

        timeInBedMinutes: nonNegIntFromQuery.nullable().optional(),

        score: nonNegIntFromQuery
            .refine((n) => n <= 100, "Expected <= 100")
            .nullable()
            .optional(),

        awakeMinutes: nonNegIntFromQuery.nullable().optional(),
        remMinutes: nonNegIntFromQuery.nullable().optional(),
        coreMinutes: nonNegIntFromQuery.nullable().optional(),
        deepMinutes: nonNegIntFromQuery.nullable().optional(),

        source: z.string().nullable().optional(),
        raw: recordUnknownNullable.optional(),
    })
    .strict();

const mediaItemSchema = z
    .object({
        publicId: z.string().min(1),
        url: z.string().url(),
        resourceType: z.enum(["image", "video"]),
        format: z.string().nullable().optional(),
        createdAt: z.string().nullable().optional(), // ISO string
        meta: recordUnknownNullable.optional(),
    })
    .strict();

const setUnitSchema = z.enum(["lb", "kg"]);

const exerciseSetSchema = z
    .object({
        setIndex: intFromQuery.refine((n) => n >= 1, "Expected >= 1"),
        reps: nonNegIntFromQuery.nullable().optional(),
        weight: nonNegNumFromQuery.nullable().optional(),
        unit: setUnitSchema,
        rpe: numberFromQuery.min(0).max(10).nullable().optional(),

        isWarmup: z.coerce.boolean().optional(),
        isDropSet: z.coerce.boolean().optional(),
        tempo: z.string().nullable().optional(),
        restSec: nonNegIntFromQuery.nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict();

const exerciseSchema = z
    .object({
        id: z.string().min(1).optional(),
        name: z.string().min(1),

        movementId: z.string().nullable().optional(),

        muscleGroup: z.string().nullable().optional(),
        equipment: z.string().nullable().optional(),

        notes: z.string().nullable().optional(),

        sets: z
            .array(exerciseSetSchema)
            .min(1, "Expected at least 1 set")
            .superRefine((sets, ctx) => {
                const seen = new Set<number>();
                for (let i = 0; i < sets.length; i++) {
                    const idx = sets[i].setIndex;
                    if (seen.has(idx)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Duplicate setIndex: ${idx}`,
                            path: [i, "setIndex"],
                        });
                    }
                    seen.add(idx);
                }
            }),

        meta: recordUnknownNullable.optional(),
    })
    .strict();

const trainingSessionSchema = z
    .object({
        id: z.string().min(1).optional(),
        type: z.string().min(1),

        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),

        durationSeconds: nonNegIntFromQuery.nullable().optional(),
        activeKcal: nonNegIntFromQuery.nullable().optional(),
        totalKcal: nonNegIntFromQuery.nullable().optional(),

        avgHr: nonNegIntFromQuery.refine((n) => n <= 300, "Expected <= 300").nullable().optional(),
        maxHr: nonNegIntFromQuery.refine((n) => n <= 300, "Expected <= 300").nullable().optional(),

        distanceKm: nonNegNumFromQuery.nullable().optional(),
        steps: nonNegIntFromQuery.nullable().optional(),
        elevationGainM: nonNegNumFromQuery.nullable().optional(),

        paceSecPerKm: nonNegNumFromQuery.nullable().optional(),
        cadenceRpm: nonNegNumFromQuery.nullable().optional(),

        effortRpe: numberFromQuery.min(0).max(10).nullable().optional(),

        notes: z.string().nullable().optional(),
        meta: recordUnknownNullable.optional(),

        media: z.array(mediaItemSchema).optional(),

        // NEW (Priority 2)
        exercises: z.array(exerciseSchema).optional(),
    })
    .strict();

const trainingSchema = z
    .object({
        sessions: z.array(trainingSessionSchema).nullable().optional(),
        source: z.string().nullable().optional(),
        dayEffortRpe: numberFromQuery.min(0).max(10).nullable().optional(),
        raw: recordUnknownNullable.optional(),
    })
    .strict();

export const upsertDayBodySchema = z
    .object({
        sleep: sleepSchema.nullable().optional(),
        training: trainingSchema.nullable().optional(),
        notes: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict();
