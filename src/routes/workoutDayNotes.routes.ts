// src/routes/workoutDayNotes.routes.ts
// Dedicated atomic CRUD routes for structured WorkoutDay notes.

import { Router } from "express";

import * as workoutDayNotesController from "../controllers/workoutDayNotes.controller";
import { requireAuth } from "../middlewares/requireAuth";
import { validate } from "../middlewares/validate";
import {
    workoutDayNoteDateParamsSchema,
    workoutDayNoteDraftSchema,
    workoutDayNoteParamsSchema,
} from "../validations/workoutDayNote.schemas";

const router = Router();

router.get(
    "/days/:date/notes",
    requireAuth,
    validate("params", workoutDayNoteDateParamsSchema),
    workoutDayNotesController.listNotes
);

router.post(
    "/days/:date/notes",
    requireAuth,
    validate("params", workoutDayNoteDateParamsSchema),
    validate("body", workoutDayNoteDraftSchema),
    workoutDayNotesController.createNote
);

router.patch(
    "/days/:date/notes/:noteId",
    requireAuth,
    validate("params", workoutDayNoteParamsSchema),
    validate("body", workoutDayNoteDraftSchema),
    workoutDayNotesController.updateNote
);

router.delete(
    "/days/:date/notes/:noteId",
    requireAuth,
    validate("params", workoutDayNoteParamsSchema),
    workoutDayNotesController.deleteNote
);

export default router;
