// src/validations/userMetric.schemas.ts
import { z } from "zod";
import { isoDateSchema } from "./workoutDay.schemas";

const nullableStringMax = (max: number) => z.string().max(max).nullable().optional();

export const userMetricCustomMetricSchema = z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    value: z.number(),
    unit: z.string().trim().min(1).max(20),
});

export const upsertUserMetricBodySchema = z.object({
    weightKg: z.number().min(0).max(500).nullable().optional(),
    bodyFatPct: z.number().min(0).max(100).nullable().optional(),
    waistCm: z.number().min(0).max(300).nullable().optional(),

    customMetrics: z.array(userMetricCustomMetricSchema).max(50).optional(),

    notes: nullableStringMax(5000),

    source: z.enum(["manual", "profile", "device", "import", "coach"]).optional(),
    sourceDevice: nullableStringMax(120),
    importedAt: z.string().datetime().nullable().optional(),

    meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const userMetricDateParamsSchema = z.object({
    date: isoDateSchema,
});

export const userMetricListQuerySchema = z
    .object({
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
    })
    .superRefine((query, ctx) => {
        const hasFrom = Boolean(query.from);
        const hasTo = Boolean(query.to);

        if (hasFrom !== hasTo) {
            if (!hasFrom) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "from is required when to is provided",
                    path: ["from"],
                });
            }

            if (!hasTo) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "to is required when from is provided",
                    path: ["to"],
                });
            }
        }

        if (query.from && query.to && query.from > query.to) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "from must be <= to",
                path: ["from"],
            });
        }
    });

export type UpsertUserMetricBodyInput = z.input<typeof upsertUserMetricBodySchema>;
export type UpsertUserMetricBodyParsed = z.infer<typeof upsertUserMetricBodySchema>;

export type UserMetricDateParamsInput = z.input<typeof userMetricDateParamsSchema>;
export type UserMetricDateParamsParsed = z.infer<typeof userMetricDateParamsSchema>;

export type UserMetricListQueryInput = z.input<typeof userMetricListQuerySchema>;
export type UserMetricListQueryParsed = z.infer<typeof userMetricListQuerySchema>;