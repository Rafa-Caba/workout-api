import { z } from "zod";
import { isoDateSchema, weekKeySchema } from "./workoutDay.schemas";

export const daySummaryParamsSchema = z.object({
    date: isoDateSchema,
});

export const weekSummaryParamsSchema = z.object({
    weekKey: weekKeySchema,
});

export const rangeSummaryQuerySchema = z
    .object({
        from: isoDateSchema,
        to: isoDateSchema,
    })
    .superRefine((q, ctx) => {
        if (q.from > q.to) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "from must be <= to",
                path: ["from"],
            });
        }
    });


export const weeksTrendQuerySchema = z
    .object({
        fromWeek: weekKeySchema,
        toWeek: weekKeySchema.optional(),
    })
    .transform((q) => ({
        ...q,
        toWeek: q.toWeek ?? q.fromWeek,
    }))
    .superRefine((q, ctx) => {
        if (q.fromWeek > q.toWeek) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "fromWeek must be <= toWeek",
                path: ["fromWeek"],
            });
        }
    });

export const mediaStatsQuerySchema = rangeSummaryQuerySchema.extend({
    source: z.enum(["day", "routine", "all"]).optional(),
});

export const TrendsWeeksQuerySchema = z.object({
    fromWeek: z.string().trim().min(6).max(10).optional(),
    toWeek: z.string().trim().min(6).max(10).optional(),
    limitWeeks: z.coerce.number().int().min(1).max(52).optional(),
});
