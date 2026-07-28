// src/validations/workoutDayNote.schemas.ts
// Validation schemas for dedicated WorkoutDay note CRUD endpoints.

import { z } from "zod";

import { isoDateSchema } from "./workoutDay.schemas";

export const workoutDayNoteTypeSchema = z.enum([
    "birthday",
    "appointment",
    "reminder",
    "health",
    "personal",
    "other",
]);

const normalizedRequiredText = (fieldLabel: string, maxLength: number) =>
    z
        .string()
        .trim()
        .min(1, `${fieldLabel} is required`)
        .max(maxLength, `${fieldLabel} must be ${maxLength} characters or fewer`);

const normalizedNullableDescription = z
    .union([z.string(), z.null()])
    .transform((value) => {
        if (value === null) return null;

        const normalized = value.trim();
        return normalized.length > 0 ? normalized : null;
    })
    .refine(
        (value) => value === null || value.length <= 2_000,
        "Description must be 2000 characters or fewer"
    );

export const workoutDayNoteDraftSchema = z
    .object({
        type: workoutDayNoteTypeSchema,
        title: normalizedRequiredText("Title", 120),
        description: normalizedNullableDescription,
    })
    .strict();

export const workoutDayNoteDateParamsSchema = z
    .object({
        date: isoDateSchema,
    })
    .strict();

export const workoutDayNoteParamsSchema = z
    .object({
        date: isoDateSchema,
        noteId: z.string().trim().min(1).max(120),
    })
    .strict();
