import type { Request, Response } from "express";
import {
    createTrainingSession,
    patchTrainingSession,
    deleteTrainingSession,
} from "../services/workoutSession.service";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

export const createSession = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);

    const q: any = (req as any).validatedQuery ?? req.query;
    const returnMode: "day" | "session" = q?.returnMode === "session" ? "session" : "day";

    const payload = (req as any).validatedBody ?? req.body;

    const out = await createTrainingSession(userId, date, payload, returnMode);

    if ((out as any)?.error) {
        const err = (out as any).error;
        const status = err.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: err });
    }

    return res.status(201).json(out);
};

export const patchSession = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const sessionId = String(req.params.sessionId);

    const q: any = (req as any).validatedQuery ?? req.query;
    const returnMode: "day" | "session" = q?.returnMode === "session" ? "session" : "day";

    const payload = (req as any).validatedBody ?? req.body;

    const out = await patchTrainingSession(userId, date, sessionId, payload, returnMode);

    if ((out as any)?.error) {
        const err = (out as any).error;
        const status = err.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: err });
    }

    return res.status(200).json(out);
};

export const deleteSession = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const sessionId = String(req.params.sessionId);

    const q: any = (req as any).validatedQuery ?? req.query;
    const returnMode: "day" | "session" = q?.returnMode === "session" ? "session" : "day";
    const deleteMedia: boolean = q?.deleteMedia === true;

    const out = await deleteTrainingSession(userId, date, sessionId, returnMode, deleteMedia);

    if ((out as any)?.error) {
        const err = (out as any).error;
        const status = err.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: err });
    }

    return res.status(200).json(out);
};
