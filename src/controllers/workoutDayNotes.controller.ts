// src/controllers/workoutDayNotes.controller.ts
// HTTP handlers for dedicated structured WorkoutDay note CRUD endpoints.

import type { RequestHandler, Response } from "express";

import {
    createWorkoutDayNote,
    deleteWorkoutDayNote,
    listWorkoutDayNotes,
    updateWorkoutDayNote,
} from "../services/workoutDayNotes.service";
import {
    workoutDayNoteDateParamsSchema,
    workoutDayNoteDraftSchema,
    workoutDayNoteParamsSchema,
} from "../validations/workoutDayNote.schemas";

function getUserId(userId: string | undefined): string {
    return userId ?? "";
}

export const listNotes: RequestHandler = async (req, res: Response) => {
    const params = workoutDayNoteDateParamsSchema.parse(req.validatedParams);
    const result = await listWorkoutDayNotes(getUserId(req.user?.id), params.date);

    return res.status(200).json(result);
};

export const createNote: RequestHandler = async (req, res: Response) => {
    const params = workoutDayNoteDateParamsSchema.parse(req.validatedParams);
    const draft = workoutDayNoteDraftSchema.parse(req.validatedBody);
    const result = await createWorkoutDayNote(
        getUserId(req.user?.id),
        params.date,
        draft
    );

    return res.status(201).json(result);
};

export const updateNote: RequestHandler = async (req, res: Response) => {
    const params = workoutDayNoteParamsSchema.parse(req.validatedParams);
    const draft = workoutDayNoteDraftSchema.parse(req.validatedBody);
    const result = await updateWorkoutDayNote(
        getUserId(req.user?.id),
        params.date,
        params.noteId,
        draft
    );

    return res.status(200).json(result);
};

export const deleteNote: RequestHandler = async (req, res: Response) => {
    const params = workoutDayNoteParamsSchema.parse(req.validatedParams);
    const result = await deleteWorkoutDayNote(
        getUserId(req.user?.id),
        params.date,
        params.noteId
    );

    return res.status(200).json(result);
};
