import type { Request, Response } from "express";
import * as trainerService from "../services/trainer.service";

function getAuthUser(req: Request) {
    return (req as any).user as { id: string; role: "admin" | "user" };
}

export const listTrainees = async (req: Request, res: Response) => {
    const trainer = getAuthUser(req);
    const out = await trainerService.listTrainees(trainer.id, trainer.role);
    return res.status(200).json({ items: out });
};

export const getTraineeDay = async (req: Request, res: Response) => {
    const traineeId = String(req.params.id);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await trainerService.getTraineeDayByDate(traineeId, String(q.date));
    return res.status(200).json(out);
};

export const getTraineeWeekSummary = async (req: Request, res: Response) => {
    const traineeId = String(req.params.id);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await trainerService.getTraineeWeekViewByKey(traineeId, String(q.weekKey), q);

    // console.log({ out: out.days });

    return res.status(200).json(out);
};

export const getTraineeRecovery = async (req: Request, res: Response) => {
    const traineeId = String(req.params.id);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await trainerService.getTraineeRecovery(traineeId, String(q.from), String(q.to));
    return res.status(200).json(out);
};

export const patchPlannedRoutine = async (req: Request, res: Response) => {
    const trainer = getAuthUser(req);
    const traineeId = String(req.params.id);
    const date = String(req.params.date);

    const body: any = (req as any).validatedBody ?? req.body;

    const out = await trainerService.patchTraineePlannedRoutine({
        trainerId: trainer.id,
        trainerRole: trainer.role,
        traineeId,
        date,
        plannedRoutine: body.plannedRoutine ?? null,
        plannedMeta: body.plannedMeta ?? null,
    });

    return res.status(200).json(out);
};

/**
 * POST /api/trainer/trainees/:id/weeks/:weekKey/assign
 */
export const assignWeekToTrainee = async (req: Request, res: Response) => {
    const trainer = getAuthUser(req);

    const traineeId = String(req.params.id);
    const weekKey = String(req.params.weekKey);

    const body: any = (req as any).validatedBody ?? req.body;

    const out = await trainerService.assignWeekToTrainee({
        trainerId: trainer.id,
        trainerRole: trainer.role,
        traineeId,
        weekKey,
        clearEmptyDays: body.clearEmptyDays !== undefined ? Boolean(body.clearEmptyDays) : true,
        plannedAt: typeof body.plannedAt === "string" ? body.plannedAt : null,
    });

    return res.status(200).json(out);
};