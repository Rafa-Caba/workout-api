// src/controllers/workoutRoutine.controller.ts

import type { Request, RequestHandler, Response } from "express";

import {
    addRoutineAttachments,
    deleteRoutineAttachment,
    getRoutineWeek,
    initRoutineWeek,
    listRoutineWeeks,
    patchRoutineGymCheckDay,
    setRoutineArchived,
    upsertRoutineWeek,
} from "../services/workoutRoutine.service";

type AuthUser = {
    id?: string;
};

type RoutineParams = {
    weekKey?: string;
    dayKey?: string;
};

type RoutineInitQuery = {
    title?: string;
    split?: string;
    unarchive?: boolean;
};

type RoutineArchiveQuery = {
    archived?: boolean;
};

type RoutineListQuery = {
    status?: "active" | "archived";
    limit?: number;
};

type RoutineAttachmentDeleteQuery = {
    publicId?: string;
    deleteCloudinary?: boolean;
};

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type GymCheckExerciseSet = {
    setIndex: number;
    reps: number | null;
    weight: number | null;
    unit: "lb" | "kg";
    rpe: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    tempo: string | null;
    restSec: number | null;
    tags: string[] | null;
    meta: Record<string, unknown> | null;
};

type GymCheckExercisePatch = {
    done?: boolean | null;
    notes?: string | null;
    durationMin?: number | null;
    mediaPublicIds?: string[] | null;
    performedSets?: GymCheckExerciseSet[] | null;
};

type GymCheckMetricsPatch = {
    startAt?: string | null;
    endAt?: string | null;
    activeKcal?: number | null;
    totalKcal?: number | null;
    avgHr?: number | null;
    maxHr?: number | null;
    distanceKm?: number | null;
    steps?: number | null;
    elevationGainM?: number | null;
    paceSecPerKm?: number | null;
    cadenceRpm?: number | null;
    effortRpe?: number | null;
    trainingSource?: string | null;
    source?: "manual" | "healthkit" | "health-connect" | null;
    sourceDevice?: string | null;
    dayEffortRpe?: number | null;
};

type RoutineGymCheckPatchBody = {
    durationMin?: number | null;
    notes?: string | null;
    metrics?: GymCheckMetricsPatch | null;
    exercises?: Record<string, GymCheckExercisePatch> | null;
};

type RoutineExercise = {
    id: string;
    name: string;
    movementId?: string | null;
    movementName?: string | null;
    sets?: number | null;
    reps?: string | null;
    rpe?: number | null;
    load?: string | null;
    notes?: string | null;
    attachmentPublicIds?: string[] | null;
};

type RoutineDay = {
    dayKey: DayKey;
    date?: string;
    sessionType?: string | null;
    focus?: string | null;
    exercises?: RoutineExercise[] | null;
    notes?: string | null;
    tags?: string[] | null;
};

type RoutineUpsertBody = {
    title?: string | null;
    split?: string | null;
    plannedDays?: DayKey[] | null;
    meta?: Record<string, unknown> | null;
    day?: RoutineDay;
    days?: RoutineDay[];
};

type RequestWithAuth = Request & {
    user?: AuthUser;
};

type RequestWithValidatedQuery<TQuery> = RequestWithAuth & {
    validatedQuery?: TQuery;
};

type RequestWithValidatedBody<TBody> = RequestWithAuth & {
    validatedBody?: TBody;
};

type MulterFileFieldsMap = Record<string, Express.Multer.File[]>;

type RequestWithMulter = RequestWithAuth & {
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | MulterFileFieldsMap;
};

const getUserIdFromReq = (req: RequestWithAuth): string => String(req.user?.id ?? "");

const isMulterFileArrayMap = (value: unknown): value is MulterFileFieldsMap => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }

    return Object.values(value).every((entry) => Array.isArray(entry));
};

const normalizeMulterFiles = (req: RequestWithMulter): Express.Multer.File[] => {
    const out: Express.Multer.File[] = [];

    if (req.file) {
        out.push(req.file);
    }

    if (Array.isArray(req.files)) {
        out.push(...req.files);
    } else if (isMulterFileArrayMap(req.files)) {
        for (const group of Object.values(req.files)) {
            out.push(...group);
        }
    }

    return out;
};

const isDayKey = (value: string): value is DayKey => {
    return (
        value === "Mon" ||
        value === "Tue" ||
        value === "Wed" ||
        value === "Thu" ||
        value === "Fri" ||
        value === "Sat" ||
        value === "Sun"
    );
};

export const initWeekRoutine: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<RoutineInitQuery> & {
        params: RoutineParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");
    const query = typedReq.validatedQuery ?? {};

    const out = await initRoutineWeek(userId, weekKey, {
        title: query.title,
        split: query.split,
        unarchive: query.unarchive,
    });

    return res.status(200).json(out);
};

export const getWeekRoutine: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithAuth & { params: RoutineParams };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");

    const out = await getRoutineWeek(userId, weekKey);
    return res.status(200).json(out);
};

export const updateWeekRoutine: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedBody<RoutineUpsertBody> & {
        params: RoutineParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");
    const payload = typedReq.validatedBody ?? {};

    const out = await upsertRoutineWeek(userId, weekKey, payload);
    return res.status(200).json(out);
};

export const archiveWeekRoutine: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<RoutineArchiveQuery> & {
        params: RoutineParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");
    const archived =
        typedReq.validatedQuery?.archived !== undefined
            ? typedReq.validatedQuery.archived === true
            : true;

    const out = await setRoutineArchived(userId, weekKey, archived);
    return res.status(200).json(out);
};

export const patchGymCheckForDay: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedBody<RoutineGymCheckPatchBody> & {
        params: RoutineParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");
    const rawDayKey = String(typedReq.params.dayKey ?? "");

    if (!isDayKey(rawDayKey)) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid dayKey",
                details: { dayKey: rawDayKey },
            },
        });
    }

    const payload = typedReq.validatedBody ?? {};

    console.log({ payload });

    const out = await patchRoutineGymCheckDay(userId, weekKey, rawDayKey, payload);

    if (!out) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Routine week not found",
                details: { weekKey },
            },
        });
    }

    return res.status(200).json(out);
};

export const addWeekRoutineAttachments: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithMulter & { params: RoutineParams };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");

    const files = normalizeMulterFiles(typedReq);
    const out = await addRoutineAttachments(userId, weekKey, files);

    if (!out) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Routine week not found",
                details: { weekKey },
            },
        });
    }

    return res.status(200).json(out);
};

export const deleteWeekRoutineAttachment: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<RoutineAttachmentDeleteQuery> & {
        params: RoutineParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");
    const publicId = String(typedReq.validatedQuery?.publicId ?? "");
    const deleteCloudinary =
        typedReq.validatedQuery?.deleteCloudinary !== undefined
            ? typedReq.validatedQuery.deleteCloudinary === true
            : true;

    const out = await deleteRoutineAttachment(userId, weekKey, publicId, deleteCloudinary);

    if (!out) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Routine week not found",
                details: { weekKey },
            },
        });
    }

    return res.status(200).json(out);
};

export const listWeeks: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<RoutineListQuery>;

    const userId = getUserIdFromReq(typedReq);
    const query = typedReq.validatedQuery ?? {};

    const out = await listRoutineWeeks(userId, {
        status: query.status,
        limit: query.limit,
    });

    return res.status(200).json(out);
};