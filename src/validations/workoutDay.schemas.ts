// src/validations/workoutDay.schemas.ts
// Schemas de validación para workout days, sleep, training sessions,
// backfill individual y backfill por rango.

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

const boolFromQuery = z.preprocess((value: unknown) => {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim().toLowerCase();

        if (["true", "1", "yes", "on"].includes(normalizedValue)) {
            return true;
        }

        if (["false", "0", "no", "off"].includes(normalizedValue)) {
            return false;
        }
    }

    return value;
}, z.boolean());

const numberFromQuery = z.coerce.number();

const intFromQuery = numberFromQuery
    .refine((value) => Number.isFinite(value), "Expected a finite number")
    .refine((value) => Number.isInteger(value), "Expected an integer");

const nonNegIntFromQuery = intFromQuery.refine((value) => value >= 0, "Expected >= 0");

const nonNegNumFromQuery = numberFromQuery
    .refine((value) => Number.isFinite(value), "Expected a finite number")
    .refine((value) => value >= 0, "Expected >= 0");

const recordUnknown = z.record(z.string(), z.unknown());
const recordUnknownNullable = recordUnknown.nullable();

/**
 * Raw payloads from HealthKit / Health Connect can be objects, arrays,
 * strings, numbers, booleans, or null depending on platform/provider.
 * This is intentionally unknown while still keeping the rest strongly typed.
 */
const rawHealthPayloadSchema = z.unknown().nullable();

const workoutDataSourceSchema = z.enum(["manual", "healthkit", "health-connect"]);
const workoutSessionDataSourceSchema = z.enum([
    "manual",
    "healthkit",
    "health-connect",
    "app-live",
]);
const workoutSessionKindSchema = z.enum([
    "device-import",
    "gym-check",
    "manual-cardio",
    "live-cardio",
]);
const healthWriteStatusSchema = z.enum(["pending", "synced", "failed"]);
const cardioActivityTypeSchema = z.enum(["walking", "running"]);
const cardioEnvironmentSchema = z.enum(["outdoor", "indoor"]);

/**
 * =========================================================
 * Params / query
 * =========================================================
 */

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

export const backfillDayQuerySchema = z.object({
    mode: z.enum(["merge", "replace"]).optional(),
});

const fieldsSchema = z.preprocess((value: unknown) => {
    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return value;
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

export const attachSessionMediaQuerySchema = z.object({
    returnMode: z.enum(["day", "session"]).optional(),
});

/**
 * =========================================================
 * Shared small bodies
 * =========================================================
 */

const attachMediaItemSchema = z
    .object({
        publicId: z.string().min(1).max(300),
        url: z.string().url().max(2000),
        resourceType: z.enum(["image", "video"]),
        format: z.string().max(30).nullable().optional(),
        createdAt: z.string().min(10).nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict();

export const attachSessionMediaBodySchema = z
    .object({
        items: z.array(attachMediaItemSchema).min(1, "Expected at least 1 media item"),
    })
    .strict();

/**
 * =========================================================
 * Sleep
 * =========================================================
 */

const sleepSchema = z
    .object({
        timeAsleepMinutes: nonNegIntFromQuery.nullable().optional(),
        timeInBedMinutes: nonNegIntFromQuery.nullable().optional(),
        score: nonNegIntFromQuery
            .refine((value) => value <= 100, "Expected <= 100")
            .nullable()
            .optional(),

        awakeMinutes: nonNegIntFromQuery.nullable().optional(),
        remMinutes: nonNegIntFromQuery.nullable().optional(),
        coreMinutes: nonNegIntFromQuery.nullable().optional(),
        deepMinutes: nonNegIntFromQuery.nullable().optional(),

        source: workoutDataSourceSchema.nullable().optional(),
        sourceDevice: z.string().max(200).nullable().optional(),
        importedAt: z.string().max(60).nullable().optional(),
        lastSyncedAt: z.string().max(60).nullable().optional(),

        raw: rawHealthPayloadSchema.optional(),
    })
    .strict();

/**
 * =========================================================
 * Media / exercise
 * =========================================================
 */

const mediaItemSchema = z
    .object({
        publicId: z.string().min(1),
        url: z.string().url(),
        resourceType: z.enum(["image", "video"]),
        format: z.string().nullable().optional(),
        createdAt: z.string().nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict();

const setUnitSchema = z.enum(["lb", "kg"]);

const exerciseSetSchema = z
    .object({
        setIndex: intFromQuery.refine((value) => value >= 1, "Expected >= 1"),
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
        movementName: z.string().nullable().optional(),
        muscleGroup: z.string().nullable().optional(),
        equipment: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        sets: z
            .array(exerciseSetSchema)
            .min(1, "Expected at least 1 set")
            .superRefine((sets, ctx) => {
                const seen = new Set<number>();

                for (let index = 0; index < sets.length; index += 1) {
                    const setIndex = sets[index].setIndex;

                    if (seen.has(setIndex)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Duplicate setIndex: ${setIndex}`,
                            path: [index, "setIndex"],
                        });
                    }

                    seen.add(setIndex);
                }
            }),
        meta: recordUnknownNullable.optional(),
    })
    .strict();

/**
 * =========================================================
 * Cardio session helpers
 * =========================================================
 */

const workoutCardioMetricsSchema = z
    .object({
        distanceKm: nonNegNumFromQuery.nullable().optional(),
        steps: nonNegIntFromQuery.nullable().optional(),
        elevationGainM: nonNegNumFromQuery.nullable().optional(),

        paceSecPerKm: nonNegNumFromQuery.nullable().optional(),
        avgSpeedKmh: nonNegNumFromQuery.nullable().optional(),
        maxSpeedKmh: nonNegNumFromQuery.nullable().optional(),

        cadenceRpm: nonNegNumFromQuery.nullable().optional(),
        strideLengthM: nonNegNumFromQuery.nullable().optional(),
    })
    .strict();

const workoutRouteSummarySchema = z
    .object({
        pointCount: nonNegIntFromQuery,

        startLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
        startLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),

        endLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
        endLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),

        minLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),
        maxLatitude: z.coerce.number().min(-90).max(90).nullable().optional(),

        minLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),
        maxLongitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    })
    .strict();

const workoutRoutePointSchema = z
    .object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),

        altitudeM: z.coerce.number().nullable().optional(),
        accuracyM: nonNegNumFromQuery.nullable().optional(),
        speedMps: nonNegNumFromQuery.nullable().optional(),
        headingDeg: z.coerce.number().min(0).max(360).nullable().optional(),

        recordedAt: z.string().nullable().optional(),
    })
    .strict();

/**
 * =========================================================
 * Training
 * =========================================================
 */

const trainingSessionMetaSchema = z
    .object({
        /**
         * Existing GymCheck / FE flow fields.
         */
        sessionKey: z.string().max(120).nullable().optional(),
        trainingSource: z.string().max(120).nullable().optional(),
        dayEffortRpe: z.coerce.number().min(0).max(10).nullable().optional(),

        /**
         * Health-enriched metadata fields.
         */
        source: workoutSessionDataSourceSchema.nullable().optional(),
        sourceDevice: z.string().max(200).nullable().optional(),
        importedAt: z.string().max(60).nullable().optional(),
        lastSyncedAt: z.string().max(60).nullable().optional(),
        sessionKind: workoutSessionKindSchema.nullable().optional(),

        /**
         * OS health write metadata for app-created live cardio sessions.
         */
        healthWriteStatus: healthWriteStatusSchema.nullable().optional(),
        healthExternalId: z.string().max(200).nullable().optional(),
        healthWrittenAt: z.string().max(60).nullable().optional(),

        /**
         * Optional useful metadata helpers.
         */
        externalId: z.string().max(200).nullable().optional(),
        originalType: z.string().max(200).nullable().optional(),
        provider: z.string().max(120).nullable().optional(),
    })
    .strict();

const trainingSessionSchema = z
    .object({
        id: z.string().min(1).optional(),
        type: z.string().min(1),

        activityType: cardioActivityTypeSchema.nullable().optional(),
        cardioEnvironment: cardioEnvironmentSchema.nullable().optional(),

        startAt: z.string().nullable().optional(),
        endAt: z.string().nullable().optional(),

        durationSeconds: nonNegIntFromQuery.nullable().optional(),
        activeKcal: nonNegNumFromQuery.nullable().optional(),
        totalKcal: nonNegNumFromQuery.nullable().optional(),

        avgHr: nonNegIntFromQuery
            .refine((value) => value <= 300, "Expected <= 300")
            .nullable()
            .optional(),
        maxHr: nonNegIntFromQuery
            .refine((value) => value <= 300, "Expected <= 300")
            .nullable()
            .optional(),

        distanceKm: nonNegNumFromQuery.nullable().optional(),
        steps: nonNegIntFromQuery.nullable().optional(),
        elevationGainM: nonNegNumFromQuery.nullable().optional(),

        paceSecPerKm: nonNegNumFromQuery.nullable().optional(),
        cadenceRpm: nonNegNumFromQuery.nullable().optional(),

        hasRoute: z.coerce.boolean().optional(),
        cardioMetrics: workoutCardioMetricsSchema.nullable().optional(),
        routeSummary: workoutRouteSummarySchema.nullable().optional(),
        routePoints: z.array(workoutRoutePointSchema).nullable().optional(),

        effortRpe: numberFromQuery.min(0).max(10).nullable().optional(),

        notes: z.string().nullable().optional(),
        meta: trainingSessionMetaSchema.nullable().optional(),

        media: z.array(mediaItemSchema).nullable().optional(),
        exercises: z.array(exerciseSchema).nullable().optional(),
    })
    .strict();

const trainingSchema = z
    .object({
        sessions: z.array(trainingSessionSchema).nullable().optional(),
        source: workoutDataSourceSchema.nullable().optional(),
        dayEffortRpe: numberFromQuery.min(0).max(10).nullable().optional(),
        raw: rawHealthPayloadSchema.optional(),
    })
    .strict();

/**
 * =========================================================
 * Day upsert / backfill
 * =========================================================
 */

export const upsertDayBodySchema = z
    .object({
        sleep: sleepSchema.nullable().optional(),
        training: trainingSchema.nullable().optional(),
        plannedRoutine: z.unknown().nullable().optional(),
        plannedMeta: z.unknown().nullable().optional(),
        notes: z.string().nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict();

export const backfillRangeBodySchema = z
    .object({
        mode: z.enum(["merge", "replace"]).optional(),
        days: z
            .array(
                z
                    .object({
                        date: isoDateSchema,
                        payload: upsertDayBodySchema,
                    })
                    .strict()
            )
            .min(1, "Expected at least 1 backfill item")
            .max(366, "Expected at most 366 backfill items"),
    })
    .strict();