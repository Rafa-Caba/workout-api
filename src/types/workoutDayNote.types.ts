// src/types/workoutDayNote.types.ts
// Canonical typed contract for structured notes attached to a WorkoutDay.

import type { ISODate, ISODateTime, WorkoutDayDoc } from "./workoutDay.types";

/**
 * Supported visual/semantic categories for a day note.
 * Keep this union aligned with backend validation, web, and React Native.
 */
export type WorkoutDayNoteType =
    | "birthday"
    | "appointment"
    | "reminder"
    | "health"
    | "personal"
    | "other";

/**
 * Persisted structured note returned by the API.
 */
export type WorkoutDayNote = {
    id: string;
    type: WorkoutDayNoteType;
    title: string;
    description: string | null;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
};

/**
 * Shared create/update body. Updates intentionally receive the complete editable
 * note fields so backend, web, and RN always agree on the final note state.
 */
export type WorkoutDayNoteDraft = {
    type: WorkoutDayNoteType;
    title: string;
    description: string | null;
};

export type WorkoutDayNotesListResponse = {
    date: ISODate;
    notes: WorkoutDayNote[];
};

export type WorkoutDayNoteMutationResponse = {
    day: WorkoutDayDoc;
    note: WorkoutDayNote;
};

export type WorkoutDayNoteDeleteResponse = {
    day: WorkoutDayDoc;
    deletedNoteId: string;
};
