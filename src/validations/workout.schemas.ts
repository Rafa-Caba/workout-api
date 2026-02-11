import { z } from "zod";

export const isoDateParamSchema = z.object({
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid ISO date. Must be YYYY-MM-DD"),
});

export const weekKeyParamSchema = z.object({
    weekKey: z
        .string()
        .regex(/^\d{4}-W\d{2}$/, "Invalid weekKey. Must be YYYY-W##")
        .refine((v) => {
            const week = Number(v.split("-W")[1]);
            return week >= 1 && week <= 53;
        }, "Invalid ISO week number. Must be 01..53"),
});

/**
 * params for media routes
 * - date stays validated as ISO date
 * - sessionId validated as a Mongo ObjectId string (24 hex)
 */
export const sessionIdParamSchema = z.object({
    date: isoDateParamSchema.shape.date,
    sessionId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid sessionId. Must be a Mongo ObjectId"),
});

/**
 * =========================================================
 * Body schemas
 * =========================================================
 */

export const upsertWorkoutDaySchema = z
    .object({
        sleep: z.any().optional().nullable(),
        training: z.any().optional().nullable(),
        notes: z.string().optional().nullable(),
        tags: z.array(z.string()).optional().nullable(),
        meta: z.record(z.string(), z.any()).optional().nullable(),
    })
    .strict();

/**
 * =========================================================
 * Query schemas
 * =========================================================
 */

export const daysRangeQuerySchema = z
    .object({
        from: isoDateParamSchema.shape.date,
        to: isoDateParamSchema.shape.date,
    })
    .strict();

export const upsertModeQuerySchema = z
    .object({
        mode: z.enum(["replace", "merge"]).optional().default("merge"),
    })
    .strict();

const fieldsAllowed = [
    "date",
    "weekKey",
    "hasSleep",
    "hasTraining",
    "sleep",
    "training",
    "notes",
    "tags",
    "meta",
    "sleepSummary",
    "trainingSummary",
    "trainingTotals",
    "trainingTypes",
] as const;

export const calendarQuerySchema = z
    .object({
        from: isoDateParamSchema.shape.date,
        to: isoDateParamSchema.shape.date,

        fields: z
            .union([
                z.array(z.enum(fieldsAllowed)),
                z
                    .string()
                    .transform((v) =>
                        v
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                    )
                    .pipe(z.array(z.enum(fieldsAllowed))),
            ])
            .optional()
            .nullable(),

        fillMissingDays: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false))
            .default(true),

        includeRollups: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false))
            .default(false),

        includeSleep: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false)),

        includeTraining: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false)),

        includeSummaries: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false)),

        includeTotals: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false)),

        includeTypes: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false)),

        includeRaw: z
            .union([z.boolean(), z.string()])
            .optional()
            .transform((v) => (v === true || v === "true" ? true : false)),
    })
    .strict();

export const weekQuerySchema = z
    .object({
        fields: calendarQuerySchema.shape.fields,
        fillMissingDays: calendarQuerySchema.shape.fillMissingDays,
        includeRollups: calendarQuerySchema.shape.includeRollups,
        includeSleep: calendarQuerySchema.shape.includeSleep,
        includeTraining: calendarQuerySchema.shape.includeTraining,
        includeSummaries: calendarQuerySchema.shape.includeSummaries,
        includeTotals: calendarQuerySchema.shape.includeTotals,
        includeTypes: calendarQuerySchema.shape.includeTypes,
        includeRaw: calendarQuerySchema.shape.includeRaw,
    })
    .strict();
