// src/validations/workoutSession.schemas.ts

import { z } from "zod";
import type {
    CreateExerciseInput,
    CreateTrainingSessionInput,
    PatchTrainingSessionInput,
    TrainingSessionMeta,
} from "../types/workoutDay.types";
import { isoDateSchema } from "./workoutDay.schemas";

const boolFromQuery = z.preprocess((value: unknown) => {
    if (typeof value === "boolean") return value;

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

const intFromCoerce = z.coerce
    .number()
    .refine((value) => Number.isFinite(value), "Expected a finite number")
    .refine((value) => Number.isInteger(value), "Expected an integer");

const nonNegInt = intFromCoerce.refine((value) => value >= 0, "Expected >= 0");

const nonNegNum = z.coerce
    .number()
    .refine((value) => Number.isFinite(value), "Expected a finite number")
    .refine((value) => value >= 0, "Expected >= 0");

const nullableString = z.string().nullable();
const recordUnknownNullable = z.record(z.string(), z.unknown()).nullable();

const trainingSessionMetaSchema = z
    .object({
        /**
         * Existing GymCheck / FE flow fields
         */
        sessionKey: z.string().max(120).nullable().optional(),
        trainingSource: z.string().max(120).nullable().optional(),
        dayEffortRpe: z.coerce.number().min(0).max(10).nullable().optional(),

        /**
         * Health-enriched metadata fields
         */
        source: z.enum(["manual", "healthkit", "health-connect"]).nullable().optional(),
        sourceDevice: z.string().max(200).nullable().optional(),
        importedAt: z.string().max(60).nullable().optional(),
        lastSyncedAt: z.string().max(60).nullable().optional(),
        sessionKind: z.enum(["device-import", "gym-check"]).nullable().optional(),

        /**
         * Optional useful metadata helpers
         */
        externalId: z.string().max(200).nullable().optional(),
        originalType: z.string().max(200).nullable().optional(),
        provider: z.string().max(120).nullable().optional(),
    })
    .strict()
    .transform(
        (value): TrainingSessionMeta => ({
            sessionKey: value.sessionKey ?? null,
            trainingSource: value.trainingSource ?? null,
            dayEffortRpe: value.dayEffortRpe ?? null,

            source: value.source ?? null,
            sourceDevice: value.sourceDevice ?? null,
            importedAt: value.importedAt ?? null,
            lastSyncedAt: value.lastSyncedAt ?? null,
            sessionKind: value.sessionKind ?? null,

            externalId: value.externalId ?? null,
            originalType: value.originalType ?? null,
            provider: value.provider ?? null,
        })
    );

const exerciseSetSchema = z
    .object({
        setIndex: z.coerce.number().int().min(1).max(999),

        reps: nonNegInt.nullable().optional(),
        weight: nonNegNum.nullable().optional(),
        unit: z.enum(["lb", "kg"]),

        rpe: z.coerce.number().min(0).max(10).nullable().optional(),

        isWarmup: z.boolean().optional(),
        isDropSet: z.boolean().optional(),

        tempo: z.string().max(50).nullable().optional(),
        restSec: nonNegInt.max(36000).nullable().optional(),

        tags: z.array(z.string().min(1)).nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict()
    .transform((value) => ({
        setIndex: value.setIndex,
        reps: value.reps ?? null,
        weight: value.weight ?? null,
        unit: value.unit,
        rpe: value.rpe ?? null,
        isWarmup: value.isWarmup ?? false,
        isDropSet: value.isDropSet ?? false,
        tempo: value.tempo ?? null,
        restSec: value.restSec ?? null,
        tags: value.tags ?? null,
        meta: value.meta ?? null,
    }));

const createExerciseSchema = z
    .object({
        name: z.string().min(1).max(200),

        movementId: z.string().max(120).nullable().optional(),
        movementName: z.string().max(200).nullable().optional(),

        notes: z.string().max(5000).nullable().optional(),
        sets: z.array(exerciseSetSchema).nullable().optional(),

        meta: recordUnknownNullable.optional(),
    })
    .strict()
    .transform(
        (value): CreateExerciseInput => ({
            name: value.name,
            movementId: value.movementId ?? null,
            movementName: value.movementName ?? null,
            notes: value.notes ?? null,
            sets: value.sets ?? null,
            meta: value.meta ?? null,
        })
    );

const createSessionBodyBaseSchema = z.object({
    type: z.string().min(1).max(120),

    startAt: nullableString.optional(),
    endAt: nullableString.optional(),

    durationSeconds: nonNegInt.nullable().optional(),

    activeKcal: nonNegInt.nullable().optional(),
    totalKcal: nonNegInt.nullable().optional(),

    avgHr: nonNegInt.max(300).nullable().optional(),
    maxHr: nonNegInt.max(300).nullable().optional(),

    distanceKm: nonNegNum.nullable().optional(),
    steps: nonNegInt.nullable().optional(),
    elevationGainM: nonNegNum.nullable().optional(),

    paceSecPerKm: nonNegNum.nullable().optional(),
    cadenceRpm: nonNegNum.nullable().optional(),

    effortRpe: z.coerce.number().min(0).max(10).nullable().optional(),

    notes: z.string().max(5000).nullable().optional(),
    exercises: z.array(createExerciseSchema).nullable().optional(),

    meta: trainingSessionMetaSchema.nullable().optional(),
});

/**
 * =========================================================
 * Params
 * =========================================================
 */

export const sessionCrudParamsSchema = z.object({
    date: isoDateSchema,
    sessionId: z.string().min(1),
});

export const dayParamsOnlySchema = z.object({
    date: isoDateSchema,
});

/**
 * =========================================================
 * Query
 * =========================================================
 */

export const sessionCrudQuerySchema = z.object({
    returnMode: z.enum(["day", "session"]).optional(),
    deleteMedia: boolFromQuery.optional(),
});

/**
 * =========================================================
 * Body
 * =========================================================
 */

export const createSessionBodySchema = createSessionBodyBaseSchema
    .strict()
    .transform(
        (value): CreateTrainingSessionInput => ({
            type: value.type,

            startAt: value.startAt ?? null,
            endAt: value.endAt ?? null,

            durationSeconds: value.durationSeconds ?? null,

            activeKcal: value.activeKcal ?? null,
            totalKcal: value.totalKcal ?? null,

            avgHr: value.avgHr ?? null,
            maxHr: value.maxHr ?? null,

            distanceKm: value.distanceKm ?? null,
            steps: value.steps ?? null,
            elevationGainM: value.elevationGainM ?? null,

            paceSecPerKm: value.paceSecPerKm ?? null,
            cadenceRpm: value.cadenceRpm ?? null,

            effortRpe: value.effortRpe ?? null,

            notes: value.notes ?? null,
            exercises: value.exercises ?? null,
            meta: value.meta ?? null,
        })
    );

/**
 * PATCH supports partial updates.
 * - Does NOT allow media updates here (media is handled via /media endpoints)
 */
export const patchSessionBodySchema = createSessionBodyBaseSchema
    .partial()
    .strict()
    .transform(
        (value): PatchTrainingSessionInput => ({
            ...(value.type !== undefined ? { type: value.type } : {}),
            ...(value.startAt !== undefined ? { startAt: value.startAt } : {}),
            ...(value.endAt !== undefined ? { endAt: value.endAt } : {}),
            ...(value.durationSeconds !== undefined
                ? { durationSeconds: value.durationSeconds }
                : {}),
            ...(value.activeKcal !== undefined ? { activeKcal: value.activeKcal } : {}),
            ...(value.totalKcal !== undefined ? { totalKcal: value.totalKcal } : {}),
            ...(value.avgHr !== undefined ? { avgHr: value.avgHr } : {}),
            ...(value.maxHr !== undefined ? { maxHr: value.maxHr } : {}),
            ...(value.distanceKm !== undefined ? { distanceKm: value.distanceKm } : {}),
            ...(value.steps !== undefined ? { steps: value.steps } : {}),
            ...(value.elevationGainM !== undefined
                ? { elevationGainM: value.elevationGainM }
                : {}),
            ...(value.paceSecPerKm !== undefined
                ? { paceSecPerKm: value.paceSecPerKm }
                : {}),
            ...(value.cadenceRpm !== undefined ? { cadenceRpm: value.cadenceRpm } : {}),
            ...(value.effortRpe !== undefined ? { effortRpe: value.effortRpe } : {}),
            ...(value.notes !== undefined ? { notes: value.notes } : {}),
            ...(value.exercises !== undefined ? { exercises: value.exercises } : {}),
            ...(value.meta !== undefined ? { meta: value.meta } : {}),
        })
    );

export type SessionCrudParams = z.infer<typeof sessionCrudParamsSchema>;
export type DayParamsOnly = z.infer<typeof dayParamsOnlySchema>;
export type SessionCrudQuery = z.infer<typeof sessionCrudQuerySchema>;