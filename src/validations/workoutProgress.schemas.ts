// src/validations/workoutProgress.schemas.ts
// Zod schemas for the Workout Progress overview endpoint query params.

import { z } from "zod";
import { isoDateSchema, weekKeySchema } from "./workoutDay.schemas";

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

export const workoutProgressModeSchema = z.enum([
    "last7",
    "last30",
    "currentMonth",
    "customRange",
]);

export const workoutProgressCompareToSchema = z.enum([
    "previous_period",
    "previous_month",
    "none",
]);

export const workoutProgressOverviewQuerySchema = z
    .object({
        mode: workoutProgressModeSchema.default("last30"),
        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
        compareTo: workoutProgressCompareToSchema.default("previous_period"),
        weekKey: weekKeySchema.optional(),
        includeExerciseProgress: boolFromQuery.default(true),
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

export type WorkoutProgressOverviewQueryInput = z.input<
    typeof workoutProgressOverviewQuerySchema
>;

export type WorkoutProgressOverviewQueryParsed = z.infer<
    typeof workoutProgressOverviewQuerySchema
>;