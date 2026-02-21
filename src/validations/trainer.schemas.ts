import { z } from "zod";

export const traineeIdParamsSchema = z.object({
    id: z.string().min(1),
});

export const traineeDayQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});

export const traineeWeekSummaryQuerySchema = z.object({
    weekKey: z.string().regex(/^\d{4}-W\d{2}$/, "Invalid weekKey format"),
    // Optional flags used by week builder (kept flexible)
    fields: z.any().optional(),
    fillMissingDays: z.any().optional(),
    includeRollups: z.any().optional(),
    includeSleep: z.any().optional(),
    includeTraining: z.any().optional(),
    includeSummaries: z.any().optional(),
    includeTotals: z.any().optional(),
    includeTypes: z.any().optional(),
    includeRaw: z.any().optional(),
});

export const traineeRecoveryQuerySchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid from"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid to"),
});

export const patchPlannedRoutineParamsSchema = z.object({
    id: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
});

export const patchPlannedRoutineBodySchema = z.object({
    plannedRoutine: z.any().nullable().optional(),
    plannedMeta: z
        .object({
            plannedAt: z.string().optional(),
            source: z.enum(["trainer", "template"]).optional(),
        })
        .nullable()
        .optional(),
});

/**
 * Weekly Assign
 * POST /api/trainer/trainees/:id/weeks/:weekKey/assign
 */
export const weeklyAssignParamsSchema = z.object({
    id: z.string().min(1),
    weekKey: z.string().regex(/^\d{4}-W\d{2}$/, "Invalid weekKey format"),
});

export const weeklyAssignBodySchema = z.object({
    /**
     * If true, days that have an "empty" planned day in the template
     * will clear the trainee's plannedRoutine (unless locked by training).
     * Default: true (predictable, mirrors template)
     */
    clearEmptyDays: z.boolean().optional(),

    /**
     * Optional timestamp (ISO) to stamp plannedMeta.
     * If omitted, server uses now().
     */
    plannedAt: z.string().optional(),
});