// src/controllers/workoutSession.controller.ts

import type { Request, RequestHandler, Response } from "express";

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

type AuthUser = {
    id?: string;
};

type SessionParams = {
    date?: string;
    sessionId?: string;
};

type SessionQuery = {
    returnMode?: "day" | "session";
    deleteMedia?: boolean;
};

type RequestWithAuth = Request & {
    user?: AuthUser;
};

type RequestWithValidatedBody<TBody> = RequestWithAuth & {
    validatedBody?: TBody;
};

type RequestWithValidatedQuery<TQuery> = RequestWithAuth & {
    validatedQuery?: TQuery;
};

type RequestWithValidated<TBody, TQuery> = RequestWithAuth & {
    validatedBody?: TBody;
    validatedQuery?: TQuery;
};

const getUserIdFromReq = (req: RequestWithAuth): string => String(req.user?.id ?? "");

const isErrorResult = (
    result: UpsertTrainingSessionResult | DeleteTrainingSessionResult
): result is SessionError => "error" in result;

export const createSession: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidated<
        CreateTrainingSessionInput,
        Pick<SessionQuery, "returnMode">
    > & {
        params: SessionParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");

    const returnMode: "day" | "session" =
        typedReq.validatedQuery?.returnMode === "session" ? "session" : "day";

    const payload: CreateTrainingSessionInput = typedReq.validatedBody ?? {
        type: "",
        startAt: null,
        endAt: null,
        durationSeconds: null,
        activeKcal: null,
        totalKcal: null,
        avgHr: null,
        maxHr: null,
        distanceKm: null,
        steps: null,
        elevationGainM: null,
        paceSecPerKm: null,
        cadenceRpm: null,
        effortRpe: null,
        notes: null,
        meta: null,
        exercises: null,
    };

    const out = await createTrainingSession(userId, date, payload, returnMode);

    if (isErrorResult(out)) {
        const status = out.error.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: out.error });
    }

    return res.status(201).json(out);
};

export const patchSession: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidated<
        PatchTrainingSessionInput,
        Pick<SessionQuery, "returnMode">
    > & {
        params: SessionParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const sessionId = String(typedReq.params.sessionId ?? "");

    const returnMode: "day" | "session" =
        typedReq.validatedQuery?.returnMode === "session" ? "session" : "day";

    const payload = typedReq.validatedBody ?? {};

    const out = await patchTrainingSession(userId, date, sessionId, payload, returnMode);

    if (isErrorResult(out)) {
        const status = out.error.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: out.error });
    }

    return res.status(200).json(out);
};

export const deleteSession: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<SessionQuery> & {
        params: SessionParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const sessionId = String(typedReq.params.sessionId ?? "");

    const returnMode: "day" | "session" =
        typedReq.validatedQuery?.returnMode === "session" ? "session" : "day";

    const deleteMedia = typedReq.validatedQuery?.deleteMedia === true;

    const out = await deleteTrainingSession(userId, date, sessionId, returnMode, deleteMedia);

    if (isErrorResult(out)) {
        const status = out.error.code === "NOT_FOUND" ? 404 : 400;
        return res.status(status).json({ error: out.error });
    }

    return res.status(200).json(out);
};