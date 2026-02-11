import { z } from "zod";
import { isoDateSchema, weekKeySchema } from "./workoutDay.schemas";

const recordUnknownNullable = z.record(z.string(), z.unknown()).nullable();

const boolFromQuery = z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(s)) return true;
        if (["false", "0", "no", "off"].includes(s)) return false;
    }
    return v;
}, z.boolean());

export const routineWeekParamsSchema = z.object({
    weekKey: weekKeySchema,
});

export const routineInitQuerySchema = z.object({
    title: z.string().min(1).max(200).optional(),
    split: z.string().min(1).max(200).optional(),

    // If true and routine exists as archived, flip to active
    unarchive: boolFromQuery.optional(),
});

export const routineArchiveQuerySchema = z.object({
    archived: boolFromQuery.optional(),
});

export const routineDayKeySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

/**
 * =========================================================
 * Planned Exercise (CANONICAL for routine.days[].exercises[])
 * =========================================================
 * Supports exercise-level media linking via attachmentPublicIds.
 */
export const routineExerciseSchema = z
    .object({
        name: z.string().min(1).max(200),

        // Planned sets should be numeric (frontend can parse from UI strings before PUT)
        sets: z.number().int().min(0).max(99).nullable().optional(),

        reps: z.string().min(1).max(50).nullable().optional(),

        // Optional planned intensity
        rpe: z.number().min(0).max(10).nullable().optional(),

        // Planned load, kept separate from notes (UI-friendly and queryable)
        load: z.string().max(100).nullable().optional(),

        // Free notes for the planned exercise
        notes: z.string().max(1000).nullable().optional(),

        // ✅ Media linking: Cloudinary publicIds uploaded to routine week attachments
        attachmentPublicIds: z.array(z.string().min(1).max(300)).nullable().optional(),
    })
    .strict();

/**
 * =========================================================
 * Routine Day (CANONICAL planned routine storage)
 * - Used for bulk PUT days: [...]
 * - Also used for single PUT day: {...}
 * =========================================================
 */
export const routineDaySchema = z
    .object({
        dayKey: routineDayKeySchema,
        date: isoDateSchema.optional(),

        sessionType: z.string().max(200).nullable().optional(),
        focus: z.string().max(500).nullable().optional(),

        exercises: z.array(routineExerciseSchema).nullable().optional(),

        notes: z.string().max(5000).nullable().optional(),
        tags: z.array(z.string()).nullable().optional(),
    })
    .strict();

/**
 * =========================================================
 * Upsert Body (USED by PUT /routines/weeks/:weekKey)
 * Supports:
 * - title/split/plannedDays/meta
 * - single day update via "day"
 * - bulk update via "days"
 * =========================================================
 */
export const routineUpsertBodySchema = z
    .object({
        title: z.string().max(200).nullable().optional(),
        split: z.string().max(200).nullable().optional(),
        plannedDays: z.array(routineDayKeySchema).nullable().optional(),

        // Update a single day by dayKey
        day: routineDaySchema.optional(),

        days: z.array(routineDaySchema).optional(),

        meta: recordUnknownNullable.optional(),
    })
    .strict();

export const routineAttachmentDeleteQuerySchema = z.object({
    publicId: z.string().min(1),
    deleteCloudinary: boolFromQuery.optional(),
});

export const routineAttachmentUploadQuerySchema = z.object({
    returnMode: z.enum(["routine"]).optional().default("routine"),
});

/**
 * =========================================================
 * NOTE:
 * UpdateRoutineWeekBodySchema was previously present but unused.
 * To avoid confusion, we intentionally keep only routineUpsertBodySchema
 * as the canonical PUT schema.
 * =========================================================
 */
