// src/services/workoutDayNotes.service.ts
// Atomic CRUD and concurrency-safe legacy migration for structured WorkoutDay notes.

import { createHash, randomUUID } from "crypto";
import mongoose, { type HydratedDocument } from "mongoose";

import {
    WorkoutDayModel,
    type WorkoutDayDocument,
} from "../models/WorkoutDay.model";
import type {
    WorkoutDayNote,
    WorkoutDayNoteDraft,
    WorkoutDayNoteType,
} from "../types/workoutDayNote.types";
import { getWeekKeyFromISODate } from "../utils/weekKey";

type JsonRecord = Record<string, unknown>;

type ServiceErrorCode = "WORKOUT_DAY_NOTE_NOT_FOUND";

class WorkoutDayNoteServiceError extends Error {
    readonly statusCode: number;
    readonly code: ServiceErrorCode;
    readonly details: Record<string, string>;

    constructor(args: {
        statusCode: number;
        code: ServiceErrorCode;
        message: string;
        details: Record<string, string>;
    }) {
        super(args.message);
        this.name = "WorkoutDayNoteServiceError";
        this.statusCode = args.statusCode;
        this.code = args.code;
        this.details = args.details;
    }
}

const NOTE_TYPES: readonly WorkoutDayNoteType[] = [
    "birthday",
    "appointment",
    "reminder",
    "health",
    "personal",
    "other",
];

function isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: JsonRecord, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
}

function cleanString(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}

function isWorkoutDayNoteType(value: unknown): value is WorkoutDayNoteType {
    return NOTE_TYPES.some((type) => type === value);
}

/**
 * Creates a deterministic id for legacy notes that were stored without one.
 * Determinism prevents duplicate notes if two clients trigger lazy migration
 * concurrently before the one-time deployment migration has run.
 */
function createLegacyFallbackId(args: {
    dayIdentity: string;
    index: number;
    type: WorkoutDayNoteType;
    title: string;
    description: string | null;
}): string {
    const digest = createHash("sha256")
        .update(
            [
                args.dayIdentity,
                String(args.index),
                args.type,
                args.title,
                args.description ?? "",
            ].join("|")
        )
        .digest("hex")
        .slice(0, 48);

    return `legacy-${digest}`;
}

function normalizeLegacyNote(args: {
    value: unknown;
    now: string;
    dayIdentity: string;
    index: number;
}): WorkoutDayNote | null {
    if (!isRecord(args.value)) return null;

    const type = args.value.type;
    const title = cleanString(args.value.title);

    if (!isWorkoutDayNoteType(type) || !title) return null;

    const createdAt = cleanString(args.value.createdAt) ?? args.now;
    const description = cleanString(args.value.description)?.slice(0, 2_000) ?? null;
    const id =
        cleanString(args.value.id) ??
        createLegacyFallbackId({
            dayIdentity: args.dayIdentity,
            index: args.index,
            type,
            title,
            description,
        });

    return {
        id,
        type,
        title: title.slice(0, 120),
        description,
        createdAt,
        updatedAt: cleanString(args.value.updatedAt) ?? createdAt,
    };
}

function normalizePersistedNote(value: unknown): WorkoutDayNote | null {
    if (!isRecord(value)) return null;

    const id = cleanString(value.id);
    const type = value.type;
    const title = cleanString(value.title);
    const createdAt = cleanString(value.createdAt);
    const updatedAt = cleanString(value.updatedAt);

    if (!id || !isWorkoutDayNoteType(type) || !title || !createdAt || !updatedAt) {
        return null;
    }

    return {
        id,
        type,
        title,
        description: cleanString(value.description),
        createdAt,
        updatedAt,
    };
}

function readLegacyNotes(meta: unknown, dayIdentity: string): WorkoutDayNote[] {
    if (!isRecord(meta) || !Array.isArray(meta.dayNotes)) return [];

    const now = new Date().toISOString();
    const uniqueNotes = new Map<string, WorkoutDayNote>();

    meta.dayNotes.forEach((rawNote, index) => {
        const note = normalizeLegacyNote({
            value: rawNote,
            now,
            dayIdentity,
            index,
        });

        if (note && !uniqueNotes.has(note.id)) {
            uniqueNotes.set(note.id, note);
        }
    });

    return Array.from(uniqueNotes.values());
}

function readPersistedNotes(value: unknown): WorkoutDayNote[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((note) => normalizePersistedNote(note))
        .filter((note): note is WorkoutDayNote => note !== null);
}

function createNote(draft: WorkoutDayNoteDraft): WorkoutDayNote {
    const now = new Date().toISOString();

    return {
        id: randomUUID(),
        type: draft.type,
        title: draft.title,
        description: draft.description,
        createdAt: now,
        updatedAt: now,
    };
}

function createMissingNoteError(
    date: string,
    noteId: string
): WorkoutDayNoteServiceError {
    return new WorkoutDayNoteServiceError({
        statusCode: 404,
        code: "WORKOUT_DAY_NOTE_NOT_FOUND",
        message: "Workout day note not found",
        details: { date, noteId },
    });
}

/**
 * Migrates one document without replacing the complete dayNotes array.
 * Each legacy note is appended atomically only when its id is absent; removing
 * meta.dayNotes is also atomic and preserves every other meta key.
 */
async function migrateLegacyNotesOnDocument(
    day: HydratedDocument<WorkoutDayDocument>
): Promise<{
    day: HydratedDocument<WorkoutDayDocument>;
    notesMoved: number;
}> {
    const meta = day.meta;

    if (!isRecord(meta) || !hasOwn(meta, "dayNotes")) {
        return { day, notesMoved: 0 };
    }

    const dayIdentity = `${String(day.userId)}:${day.date}`;
    const legacyNotes = readLegacyNotes(meta, dayIdentity);
    let notesMoved = 0;

    for (const note of legacyNotes) {
        const result = await WorkoutDayModel.updateOne(
            {
                _id: day._id,
                "dayNotes.id": { $ne: note.id },
            },
            {
                $push: { dayNotes: note },
            },
            { runValidators: true }
        );

        notesMoved += result.modifiedCount;
    }

    await WorkoutDayModel.updateOne(
        { _id: day._id },
        { $unset: { "meta.dayNotes": 1 } }
    );

    const migratedDay = await WorkoutDayModel.findById(day._id);

    if (!migratedDay) {
        throw new Error("Workout day disappeared during note migration");
    }

    return { day: migratedDay, notesMoved };
}

/**
 * Moves valid legacy meta.dayNotes into the typed top-level dayNotes field.
 * The operation is concurrency-safe and never replaces already persisted notes.
 */
export async function migrateLegacyWorkoutDayNotesForDate(
    userId: string,
    date: string
): Promise<HydratedDocument<WorkoutDayDocument> | null> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const day = await WorkoutDayModel.findOne({ userId: userObjectId, date });

    if (!day) return null;

    const result = await migrateLegacyNotesOnDocument(day);
    return result.day;
}

/**
 * Migrates every legacy note array in the database. Intended for the deployment
 * migration command; CRUD also performs lazy per-day migration as a safety net.
 */
export async function migrateAllLegacyWorkoutDayNotes(): Promise<{
    scanned: number;
    migrated: number;
    notesMoved: number;
}> {
    const days = await WorkoutDayModel.find({ "meta.dayNotes": { $exists: true } });

    let migrated = 0;
    let notesMoved = 0;

    for (const day of days) {
        const result = await migrateLegacyNotesOnDocument(day);
        notesMoved += result.notesMoved;
        migrated += 1;
    }

    return {
        scanned: days.length,
        migrated,
        notesMoved,
    };
}

export async function listWorkoutDayNotes(userId: string, date: string) {
    const migratedDay = await migrateLegacyWorkoutDayNotesForDate(userId, date);

    return {
        date,
        notes: migratedDay ? readPersistedNotes(migratedDay.dayNotes) : [],
    };
}

export async function createWorkoutDayNote(
    userId: string,
    date: string,
    draft: WorkoutDayNoteDraft
) {
    await migrateLegacyWorkoutDayNotesForDate(userId, date);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const note = createNote(draft);
    const updatedDay = await WorkoutDayModel.findOneAndUpdate(
        { userId: userObjectId, date },
        {
            $setOnInsert: {
                userId: userObjectId,
                date,
                weekKey: getWeekKeyFromISODate(date),
                sleep: null,
                training: null,
                plannedRoutine: null,
                plannedMeta: null,
                notes: null,
                tags: null,
                meta: null,
            },
            $push: { dayNotes: note },
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: false,
        }
    );

    if (!updatedDay) {
        throw new Error("Workout day could not be created for the note");
    }

    return {
        day: updatedDay.toJSON(),
        note,
    };
}

export async function updateWorkoutDayNote(
    userId: string,
    date: string,
    noteId: string,
    draft: WorkoutDayNoteDraft
) {
    await migrateLegacyWorkoutDayNotesForDate(userId, date);

    const updatedAt = new Date().toISOString();
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const updatedDay = await WorkoutDayModel.findOneAndUpdate(
        {
            userId: userObjectId,
            date,
            "dayNotes.id": noteId,
        },
        {
            $set: {
                "dayNotes.$.type": draft.type,
                "dayNotes.$.title": draft.title,
                "dayNotes.$.description": draft.description,
                "dayNotes.$.updatedAt": updatedAt,
            },
        },
        { new: true, runValidators: true }
    );

    if (!updatedDay) {
        throw createMissingNoteError(date, noteId);
    }

    const note = readPersistedNotes(updatedDay.dayNotes).find(
        (item) => item.id === noteId
    );

    if (!note) {
        throw createMissingNoteError(date, noteId);
    }

    return {
        day: updatedDay.toJSON(),
        note,
    };
}

export async function deleteWorkoutDayNote(
    userId: string,
    date: string,
    noteId: string
) {
    await migrateLegacyWorkoutDayNotesForDate(userId, date);

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const updatedDay = await WorkoutDayModel.findOneAndUpdate(
        {
            userId: userObjectId,
            date,
            "dayNotes.id": noteId,
        },
        { $pull: { dayNotes: { id: noteId } } },
        { new: true, runValidators: true }
    );

    if (!updatedDay) {
        throw createMissingNoteError(date, noteId);
    }

    return {
        day: updatedDay.toJSON(),
        deletedNoteId: noteId,
    };
}
