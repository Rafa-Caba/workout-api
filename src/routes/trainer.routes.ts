import { Router } from "express";

import { requireAuth } from "../middlewares/requireAuth";
import { requireTrainer } from "../middlewares/requireTrainer";
import { requireTrainerAccessToTrainee } from "../middlewares/requireTrainerAccessToTrainee";
import { validate } from "../middlewares/validate";

import * as trainerController from "../controllers/trainer.controller";
import {
    traineeIdParamsSchema,
    traineeDayQuerySchema,
    traineeWeekSummaryQuerySchema,
    traineeRecoveryQuerySchema,
    patchPlannedRoutineParamsSchema,
    patchPlannedRoutineBodySchema,
    weeklyAssignParamsSchema,
    weeklyAssignBodySchema,
    coachProfileParamsSchema,
    upsertCoachProfileBodySchema,
} from "../validations/trainer.schemas";

const router = Router();

/**
 * =========================================================
 * Trainer module (MVP)
 * =========================================================
 */
router.use(requireAuth, requireTrainer);

router.get("/trainees", trainerController.listTrainees);

router.get(
    "/trainees/:id/day",
    validate("params", traineeIdParamsSchema),
    validate("query", traineeDayQuerySchema),
    requireTrainerAccessToTrainee,
    trainerController.getTraineeDay
);

router.get(
    "/trainees/:id/summary/week",
    validate("params", traineeIdParamsSchema),
    validate("query", traineeWeekSummaryQuerySchema),
    requireTrainerAccessToTrainee,
    trainerController.getTraineeWeekSummary
);

router.get(
    "/trainees/:id/recovery",
    validate("params", traineeIdParamsSchema),
    validate("query", traineeRecoveryQuerySchema),
    requireTrainerAccessToTrainee,
    trainerController.getTraineeRecovery
);

router.patch(
    "/trainees/:id/days/:date/plannedRoutine",
    validate("params", patchPlannedRoutineParamsSchema),
    validate("body", patchPlannedRoutineBodySchema),
    requireTrainerAccessToTrainee,
    trainerController.patchPlannedRoutine
);

/**
 * Weekly Assign (MVP)
 * POST /api/trainer/trainees/:id/weeks/:weekKey/assign
 */
router.post(
    "/trainees/:id/weeks/:weekKey/assign",
    validate("params", weeklyAssignParamsSchema),
    validate("body", weeklyAssignBodySchema),
    requireTrainerAccessToTrainee,
    trainerController.assignWeekToTrainee
);

/**
 * Coach ↔ Trainee Profile (coach-owned)
 * GET /api/trainer/trainees/:id/profile
 * PUT /api/trainer/trainees/:id/profile
 */
router.get(
    "/trainees/:id/profile",
    validate("params", coachProfileParamsSchema),
    requireTrainerAccessToTrainee,
    trainerController.getTraineeCoachProfile
);

router.put(
    "/trainees/:id/profile",
    validate("params", coachProfileParamsSchema),
    validate("body", upsertCoachProfileBodySchema),
    requireTrainerAccessToTrainee,
    trainerController.upsertTraineeCoachProfile
);

export default router;