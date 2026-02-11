import { z } from "zod";
import { isoDateSchema } from "./workoutDay.schemas";

const isoToday = () => new Date().toISOString().slice(0, 10);

export const streaksQuerySchema = z.object({
    asOf: isoDateSchema.optional().default(isoToday()),
    mode: z.enum(["training", "sleep", "both"]).default("training"),
    gapDays: z.coerce.number().int().min(0).max(30).default(0),
});

export const insightsRangeQuerySchema = z.object({
    from: isoDateSchema,
    to: isoDateSchema,
});

export const prQuerySchema = insightsRangeQuerySchema.extend({
    metrics: z.string().optional(),
});

export const recoveryQuerySchema = insightsRangeQuerySchema;

export const recoveryPointSchema = z.object({
    date: z.string(),
    weekKey: z.string(),

    sleepScore: z.number().nullable(),
    deepMinutes: z.number().nullable(),
    totalSleepMinutes: z.number().nullable(),

    trainingLoad: z.number(),

    recoveryScore: z.number().nullable(),

    level: z.enum(["green", "yellow", "red", "unknown"]),
});

export const recoveryResponseSchema = z.object({
    range: z.object({
        from: z.string(),
        to: z.string(),
    }),
    points: z.array(recoveryPointSchema),
});

export const StreaksQuerySchema = z.object({
    asOf: z.string().trim().min(10).max(10).optional(),
    from: z.string().trim().min(10).max(10).optional(),
    to: z.string().trim().min(10).max(10).optional(),
});
