import type { Request, Response } from "express";
import type {
    CreateTrainingSessionInput,
    PatchTrainingSessionInput,
} from "../types/workoutDay.types";
import {
    createTrainingSession,
    deleteTrainingSession,
    patchTrainingSession,
    type DeleteTrainingSessionResult,
    type SessionError,
    type UpsertTrainingSessionResult,
} from "../services/workoutSession.service";

type ValidatedRequest = Request & {
    user?: {
        id?: string;
    };
    validatedBody?: CreateTrainingSessionInput | PatchTrainingSessionInput;
    validatedQuery?: {
        returnMode?: "day" | "session";
        deleteMedia?: boolean;
    };
};

const getUserIdFromReq = (req: ValidatedRequest): string => String(req.user?.id ?? "");

const isErrorResult = (
    result: UpsertTrainingSessionResult | DeleteTrainingSessionResult
): result is SessionError => "error" in result;

export const createSession = async (req: Request, res: Response) => {
    const request = req as ValidatedRequest;

    const userId = getUserIdFromReq(request);
    const date = String(request.params.date);

    const returnMode: "day" | "session" =
        request.validatedQuery?.returnMode === "session" ? "session" : "day";

    const payload = request.validatedBody as CreateTrainingSessionInput;

    const out = await createTrainingSession(userId, date, payload, returnMode);

    if (isErrorResult(out)) {
        const status = out.error.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: out.error });
    }

    return res.status(201).json(out);
};

export const patchSession = async (req: Request, res: Response) => {
    const request = req as ValidatedRequest;

    const userId = getUserIdFromReq(request);
    const date = String(request.params.date);
    const sessionId = String(request.params.sessionId);

    const returnMode: "day" | "session" =
        request.validatedQuery?.returnMode === "session" ? "session" : "day";

    const payload = request.validatedBody as PatchTrainingSessionInput;

    const out = await patchTrainingSession(userId, date, sessionId, payload, returnMode);

    if (isErrorResult(out)) {
        const status = out.error.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: out.error });
    }

    return res.status(200).json(out);
};

export const deleteSession = async (req: Request, res: Response) => {
    const request = req as ValidatedRequest;

    const userId = getUserIdFromReq(request);
    const date = String(request.params.date);
    const sessionId = String(request.params.sessionId);

    const returnMode: "day" | "session" =
        request.validatedQuery?.returnMode === "session" ? "session" : "day";

    const deleteMedia = request.validatedQuery?.deleteMedia === true;

    const out = await deleteTrainingSession(userId, date, sessionId, returnMode, deleteMedia);

    if (isErrorResult(out)) {
        const status = out.error.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: out.error });
    }

    return res.status(200).json(out);
};