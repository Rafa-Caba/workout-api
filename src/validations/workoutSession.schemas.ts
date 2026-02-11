import { z } from "zod";
import { isoDateSchema } from "./workoutDay.schemas";

const boolFromQuery = z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(s)) return true;
        if (["false", "0", "no", "off"].includes(s)) return false;
    }
    return v;
}, z.boolean());

const intFromCoerce = z.coerce
    .number()
    .refine((n) => Number.isFinite(n), "Expected a finite number")
    .refine((n) => Number.isInteger(n), "Expected an integer");

const nonNegInt = intFromCoerce.refine((n) => n >= 0, "Expected >= 0");

const nonNegNum = z.coerce
    .number()
    .refine((n) => Number.isFinite(n), "Expected a finite number")
    .refine((n) => n >= 0, "Expected >= 0");

const nullableString = z.string().nullable();
const recordUnknownNullable = z.record(z.string(), z.unknown()).nullable();

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
    deleteMedia: boolFromQuery.optional(), // only used by DELETE
});

/**
 * =========================================================
 * Body
 * =========================================================
 */

export const createSessionBodySchema = z
    .object({
        type: z.string().min(1).max(120),

        startAt: nullableString.optional(),
        endAt: nullableString.optional(),

        durationSeconds: nonNegInt.nullable().optional(),

        activeKcal: nonNegInt.nullable().optional(),
        totalKcal: nonNegInt.nullable().optional(),

        avgHr: nonNegInt.refine((n) => n <= 300, "Expected <= 300").nullable().optional(),
        maxHr: nonNegInt.refine((n) => n <= 300, "Expected <= 300").nullable().optional(),

        distanceKm: nonNegNum.nullable().optional(),
        steps: nonNegInt.nullable().optional(),
        elevationGainM: nonNegNum.nullable().optional(),

        paceSecPerKm: nonNegNum.nullable().optional(),
        cadenceRpm: nonNegNum.nullable().optional(),

        effortRpe: z.coerce.number().min(0).max(10).nullable().optional(),

        notes: z.string().max(5000).nullable().optional(),
        meta: recordUnknownNullable.optional(),
    })
    .strict();

/**
 * PATCH supports partial updates.
 * - Does NOT allow media updates here (media is handled via /media endpoints)
 */
export const patchSessionBodySchema = createSessionBodySchema.partial().strict();
