// /src/validations/workoutExport.schemas.ts
// Validation contracts for legacy JSON/CSV and complete XLSX/PDF workout exports.

import { z } from "zod";
import { isoDateSchema } from "./workoutDay.schemas";

const boolFromQuery = z.preprocess((value: unknown) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }
    return value;
}, z.boolean());

export const workoutExportQuerySchema = z.object({
    from: isoDateSchema,
    to: isoDateSchema,
    format: z.enum(["json", "csv"]).optional().default("json"),
    scope: z.enum(["day", "session", "exercise"]).optional().default("day"),
    includeRaw: boolFromQuery.optional().default(false),
});

const workoutReportSelectionSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("day"),
        date: isoDateSchema,
    }),
    z.object({
        kind: z.literal("week"),
        date: isoDateSchema,
    }),
    z.object({
        kind: z.literal("month"),
        date: isoDateSchema,
    }),
    z.object({
        kind: z.literal("range"),
        from: isoDateSchema,
        to: isoDateSchema,
    }),
]);

export const workoutReportRequestSchema = z.object({
    selection: workoutReportSelectionSchema,
    format: z.enum(["xlsx", "pdf"]),
    includeEmptyDays: z.boolean().optional().default(false),
    includeMediaLinks: z.boolean().optional().default(true),
    includeGpsPoints: z.boolean().optional().default(false),
    includeTechnicalMetadata: z.boolean().optional().default(false),
});

export type WorkoutExportQuery = z.infer<typeof workoutExportQuerySchema>;
export type WorkoutReportRequestInput = z.infer<typeof workoutReportRequestSchema>;
