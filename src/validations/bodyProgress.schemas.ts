// src/validations/bodyProgress.schemas.ts
import { z } from "zod";
import { isoDateSchema } from "./workoutDay.schemas";
import {
    workoutProgressCompareToSchema,
    workoutProgressModeSchema,
} from "./workoutProgress.schemas";

export const bodyProgressOverviewQuerySchema = z
    .object({
        mode: workoutProgressModeSchema.default("last30"),
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
        compareTo: workoutProgressCompareToSchema.default("previous_period"),
    })
    .superRefine((query, ctx) => {
        if (query.mode === "customRange") {
            if (!query.from) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "from is required when mode=customRange",
                    path: ["from"],
                });
            }

            if (!query.to) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "to is required when mode=customRange",
                    path: ["to"],
                });
            }
        }

        if (query.mode !== "customRange") {
            if (query.from) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "from is only allowed when mode=customRange",
                    path: ["from"],
                });
            }

            if (query.to) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "to is only allowed when mode=customRange",
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

export type BodyProgressOverviewQueryInput = z.input<
    typeof bodyProgressOverviewQuerySchema
>;

export type BodyProgressOverviewQueryParsed = z.infer<
    typeof bodyProgressOverviewQuerySchema
>;