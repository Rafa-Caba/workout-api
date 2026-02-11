import type { NextFunction, Request, Response } from "express";
import { getRecovery, getSessionPrs, getStreaks } from "../services/workoutInsights.service";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

const pickValidatedQuery = (req: Request) => {
    const anyReq = req as any;
    return anyReq.validatedQuery ?? anyReq.validated?.query ?? req.query;
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const getStreaksController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = getUserIdFromReq(req);
        const q = pickValidatedQuery(req) as any;

        const asOf = String(q.asOf ?? todayIsoDate());
        const mode = (q.mode ?? "training") as "training" | "sleep" | "both";
        const gapDays = typeof q.gapDays === "number" ? q.gapDays : Number(q.gapDays ?? 0);

        const out = await getStreaks(userId, asOf, mode, gapDays);
        return res.status(200).json(out);
    } catch (err) {
        return next(err);
    }
};

export const getPrsController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = pickValidatedQuery(req);

    const out = await getSessionPrs(userId, String(q.from), String(q.to), q.metrics);
    return res.status(200).json(out);
};

export const getRecoveryController = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = pickValidatedQuery(req);

    const out = await getRecovery(userId, String(q.from), String(q.to));
    return res.status(200).json(out);
};
