// src/controllers/workoutDay.controller.ts

import type { Request, RequestHandler, Response } from "express";
import path from "path";
import mongoose from "mongoose";

import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";
import {
    backfillWorkoutDayByDate,
    backfillWorkoutDaysRange,
    getCalendarInRange,
    getDayByDate,
    getDaysInRange,
    getStatsInRange,
    getWeekViewByKey,
    upsertWorkoutDay,
} from "../services/workoutDay.service";

import type {
    BuildOpts,
    MediaItem,
    TrainingSession,
    UpsertArgs,
    WorkoutDayBackfillBody,
} from "../types/workoutDay.types";

type AuthUser = {
    id?: string;
};

type WorkoutDayParams = {
    date?: string;
    sessionId?: string;
    weekKey?: string;
};

type UpsertDayQuery = {
    mode?: "merge" | "replace";
};

type RangeQuery = {
    from?: string;
    to?: string;
};

type CalendarLikeQuery = {
    from?: string;
    to?: string;
    fields?: string[] | null;
    fillMissingDays?: boolean;
    includeRollups?: boolean;
    includeSleep?: boolean;
    includeTraining?: boolean;
    includeSummaries?: boolean;
    includeTotals?: boolean;
    includeTypes?: boolean;
    includeRaw?: boolean;
};

type MediaUploadQuery = {
    returnMode?: "day" | "session";
};

type MediaDeleteQuery = {
    publicId?: string;
    returnMode?: "day" | "session";
};

type AttachSessionMediaBody = {
    items?: MediaItem[];
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

type RequestWithValidated<TBody, TQuery> = RequestWithAuth & {
    validatedBody?: TBody;
    validatedQuery?: TQuery;
};

type MulterFileFieldsMap = Record<string, Express.Multer.File[]>;

type RequestWithMulter = RequestWithAuth & {
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | MulterFileFieldsMap;
};

type SessionLike = {
    _id?: mongoose.Types.ObjectId | string;
    id?: string;
    media?: MediaItem[] | null;
};

type TrainingLike = {
    sessions?: SessionLike[] | null;
};

type DayDocumentLike = {
    training?: TrainingLike | null;
    save: () => Promise<{ toJSON: () => unknown }>;
};

const getUserIdFromReq = (req: RequestWithAuth): string => String(req.user?.id ?? "");

const toObjectId = (id: string): mongoose.Types.ObjectId => new mongoose.Types.ObjectId(id);

const inferResourceType = (mimetype?: string | null): "image" | "video" => {
    const mt = (mimetype ?? "").toLowerCase();
    return mt.startsWith("video/") ? "video" : "image";
};

const inferFormat = (filenameOrOriginal?: string | null): string | null => {
    if (!filenameOrOriginal) return null;
    const ext = path.extname(filenameOrOriginal).replace(".", "").toLowerCase();
    return ext || null;
};

const isMulterFileArrayMap = (value: unknown): value is MulterFileFieldsMap => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }

    return Object.values(value).every((entry) => Array.isArray(entry));
};

const normalizeMulterFiles = (req: RequestWithMulter): Express.Multer.File[] => {
    const out: Express.Multer.File[] = [];

    if (req.file) out.push(req.file);

    if (Array.isArray(req.files)) {
        out.push(...req.files);
    } else if (isMulterFileArrayMap(req.files)) {
        for (const group of Object.values(req.files)) {
            out.push(...group);
        }
    }

    return out;
};

const findSession = (dayDoc: DayDocumentLike, sessionId: string): SessionLike | null => {
    const sessions = dayDoc.training?.sessions ?? null;
    if (!Array.isArray(sessions)) return null;

    return (
        sessions.find((session) => {
            const rawId =
                typeof session.id === "string"
                    ? session.id
                    : session._id instanceof mongoose.Types.ObjectId
                        ? session._id.toString()
                        : typeof session._id === "string"
                            ? session._id
                            : "";

            return rawId === sessionId;
        }) ?? null
    );
};

const getCalendarBuildOpts = (query: CalendarLikeQuery): Omit<BuildOpts, "fields"> => {
    return {
        fillMissingDays: query.fillMissingDays === true,
        includeRollups: query.includeRollups === true,
        includeSleep: query.includeSleep !== undefined ? query.includeSleep === true : true,
        includeTraining: query.includeTraining !== undefined ? query.includeTraining === true : true,
        includeSummaries: query.includeSummaries !== undefined ? query.includeSummaries === true : true,
        includeTotals: query.includeTotals !== undefined ? query.includeTotals === true : true,
        includeTypes: query.includeTypes !== undefined ? query.includeTypes === true : true,
        includeRaw: query.includeRaw !== undefined ? query.includeRaw === true : false,
    };
};

const isTrainingSession = (value: unknown): value is TrainingSession => {
    return typeof value === "object" && value !== null && "id" in value;
};

export const upsertDay: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidated<UpsertArgs["payload"], UpsertDayQuery> & {
        params: WorkoutDayParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const mode: "merge" | "replace" = typedReq.validatedQuery?.mode ?? "merge";
    const payload = typedReq.validatedBody ?? {};

    const updated = await upsertWorkoutDay({ userId, date, payload, mode });
    return res.status(200).json(updated);
};

export const backfillDay: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidated<UpsertArgs["payload"], UpsertDayQuery> & {
        params: WorkoutDayParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const mode: "merge" | "replace" = typedReq.validatedQuery?.mode ?? "merge";
    const payload = typedReq.validatedBody ?? {};

    const updated = await backfillWorkoutDayByDate({ userId, date, payload, mode });
    return res.status(200).json(updated);
};

export const backfillRange: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedBody<WorkoutDayBackfillBody>;

    const userId = getUserIdFromReq(typedReq);
    const body = typedReq.validatedBody ?? { mode: "merge" as const, days: [] };

    const result = await backfillWorkoutDaysRange(userId, {
        mode: body.mode ?? "merge",
        days: body.days ?? [],
    });

    return res.status(200).json(result);
};

export const getDay: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithAuth & { params: WorkoutDayParams };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");

    const day = await getDayByDate(userId, date);
    return res.status(200).json(day);
};

export const getDaysRange: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<RangeQuery>;

    const userId = getUserIdFromReq(typedReq);
    const from = String(typedReq.validatedQuery?.from ?? typedReq.query.from ?? "");
    const to = String(typedReq.validatedQuery?.to ?? typedReq.query.to ?? "");

    const days = await getDaysInRange(userId, from, to);
    return res.status(200).json({ from, to, days });
};

export const getWeek: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<CalendarLikeQuery> & {
        params: WorkoutDayParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const weekKey = String(typedReq.params.weekKey ?? "");
    const query = typedReq.validatedQuery ?? {};

    const fields = query.fields ?? null;
    const opts = getCalendarBuildOpts(query);

    const data = await getWeekViewByKey(userId, weekKey, fields, opts);
    return res.status(200).json(data);
};

export const getCalendar: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<CalendarLikeQuery>;

    const userId = getUserIdFromReq(typedReq);
    const query = typedReq.validatedQuery ?? {};

    const from = String(query.from ?? typedReq.query.from ?? "");
    const to = String(query.to ?? typedReq.query.to ?? "");
    const fields = query.fields ?? null;
    const opts = getCalendarBuildOpts(query);

    const data = await getCalendarInRange(userId, from, to, fields, opts);
    return res.status(200).json(data);
};

export const getStats: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<RangeQuery>;

    const userId = getUserIdFromReq(typedReq);
    const from = String(typedReq.validatedQuery?.from ?? typedReq.query.from ?? "");
    const to = String(typedReq.validatedQuery?.to ?? typedReq.query.to ?? "");

    const stats = await getStatsInRange({ userId, from, to });
    return res.status(200).json(stats);
};

export const addSessionMedia: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<MediaUploadQuery> &
        RequestWithMulter & { params: WorkoutDayParams };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const sessionId = String(typedReq.params.sessionId ?? "");
    const returnMode: "day" | "session" =
        typedReq.validatedQuery?.returnMode === "session" ? "session" : "day";

    const files = normalizeMulterFiles(typedReq);

    if (!files.length) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: 'No files uploaded. Expected multipart field: "file" or "files".',
                details: null,
            },
        });
    }

    const mediaItems: MediaItem[] = files.map((file) => ({
        publicId: String(file.filename ?? ""),
        url: String(file.path ?? ""),
        resourceType: inferResourceType(file.mimetype),
        format: inferFormat(file.originalname ?? file.filename),
        createdAt: new Date().toISOString(),
        meta: {
            originalname: file.originalname ?? null,
            mimetype: file.mimetype ?? null,
            bytes: typeof file.size === "number" ? file.size : null,
        },
    }));

    const missing = mediaItems.find((item) => !item.publicId || !item.url);
    if (missing) {
        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Upload succeeded but file metadata missing (publicId/url).",
                details: {
                    gotCount: files.length,
                    missingPublicId: mediaItems.filter((item) => !item.publicId).length,
                    missingUrl: mediaItems.filter((item) => !item.url).length,
                },
            },
        });
    }

    const dayDoc = (await WorkoutDayModel.findOne({
        userId: toObjectId(userId),
        date,
    })) as DayDocumentLike | null;

    if (!dayDoc) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Workout day not found",
                details: { date },
            },
        });
    }

    const session = findSession(dayDoc, sessionId);
    if (!session) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Training session not found",
                details: { sessionId },
            },
        });
    }

    if (!Array.isArray(session.media)) {
        session.media = [];
    }

    session.media.push(...mediaItems);

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    if (returnMode === "session") {
        const sessions = (outDay as { training?: { sessions?: unknown[] | null } })?.training?.sessions ?? [];
        const outSession = Array.isArray(sessions)
            ? sessions.find(
                (sessionItem) =>
                    isTrainingSession(sessionItem) && String(sessionItem.id) === sessionId
            ) ?? null
            : null;

        return res.status(200).json({
            session: outSession,
            uploadedCount: mediaItems.length,
        });
    }

    return res.status(200).json(outDay);
};

export const deleteSessionMedia: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidatedQuery<MediaDeleteQuery> & {
        params: WorkoutDayParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const sessionId = String(typedReq.params.sessionId ?? "");
    const publicId = typedReq.validatedQuery?.publicId ?? null;

    const returnMode: "day" | "session" =
        typedReq.validatedQuery?.returnMode === "session" ? "session" : "day";

    if (!publicId) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Missing required query param: publicId",
                details: null,
            },
        });
    }

    const dayDoc = (await WorkoutDayModel.findOne({
        userId: toObjectId(userId),
        date,
    })) as DayDocumentLike | null;

    if (!dayDoc) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Workout day not found",
                details: { date },
            },
        });
    }

    const session = findSession(dayDoc, sessionId);
    if (!session) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Training session not found",
                details: { sessionId },
            },
        });
    }

    const mediaArr = Array.isArray(session.media) ? session.media : [];
    if (mediaArr.length === 0) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "This session has no media.",
                details: null,
            },
        });
    }

    const found = mediaArr.find((item) => item.publicId === publicId) ?? null;
    if (!found) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Media not found on this session.",
                details: { publicId },
            },
        });
    }

    session.media = mediaArr.filter((item) => item.publicId !== publicId);

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    const resourceType: "image" | "video" = found.resourceType === "video" ? "video" : "image";
    await deleteFromCloudinary(publicId, { resourceType });

    if (returnMode === "session") {
        const sessions = (outDay as { training?: { sessions?: unknown[] | null } })?.training?.sessions ?? [];
        const outSession = Array.isArray(sessions)
            ? sessions.find(
                (sessionItem) =>
                    isTrainingSession(sessionItem) && String(sessionItem.id) === sessionId
            ) ?? null
            : null;

        return res.status(200).json({
            session: outSession,
            cloudinary: { deleted: true, error: null },
        });
    }

    return res.status(200).json(outDay);
};

export const attachSessionMedia: RequestHandler = async (req, res: Response) => {
    const typedReq = req as RequestWithValidated<AttachSessionMediaBody, MediaUploadQuery> & {
        params: WorkoutDayParams;
    };

    const userId = getUserIdFromReq(typedReq);
    const date = String(typedReq.params.date ?? "");
    const sessionId = String(typedReq.params.sessionId ?? "");
    const returnMode: "day" | "session" =
        typedReq.validatedQuery?.returnMode === "session" ? "session" : "day";

    const items = Array.isArray(typedReq.validatedBody?.items) ? typedReq.validatedBody.items : [];

    if (!items.length) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Expected non-empty body.items array.",
                details: null,
            },
        });
    }

    const dayDoc = (await WorkoutDayModel.findOne({
        userId: toObjectId(userId),
        date,
    })) as DayDocumentLike | null;

    if (!dayDoc) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Workout day not found",
                details: { date },
            },
        });
    }

    const session = findSession(dayDoc, sessionId);
    if (!session) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Training session not found",
                details: { sessionId },
            },
        });
    }

    if (!Array.isArray(session.media)) {
        session.media = [];
    }

    const existingIds = new Set(
        session.media
            .map((item) => String(item.publicId ?? "").trim())
            .filter((value) => value.length > 0)
    );

    let attachedCount = 0;

    for (const item of items) {
        const publicId = String(item.publicId ?? "").trim();
        const url = String(item.url ?? "").trim();

        if (!publicId || !url) continue;
        if (existingIds.has(publicId)) continue;

        session.media.push({
            publicId,
            url,
            resourceType: item.resourceType === "video" ? "video" : "image",
            format: item.format ?? null,
            createdAt:
                typeof item.createdAt === "string" && item.createdAt.trim().length > 0
                    ? item.createdAt
                    : new Date().toISOString(),
            meta: item.meta ?? null,
        });

        existingIds.add(publicId);
        attachedCount++;
    }

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    if (returnMode === "session") {
        const sessions = (outDay as { training?: { sessions?: unknown[] | null } })?.training?.sessions ?? [];
        const outSession = Array.isArray(sessions)
            ? sessions.find(
                (sessionItem) =>
                    isTrainingSession(sessionItem) && String(sessionItem.id) === sessionId
            ) ?? null
            : null;

        return res.status(200).json({
            session: outSession,
            attachedCount,
        });
    }

    return res.status(200).json({
        ...(outDay as Record<string, unknown>),
        _attach: { attachedCount },
    });
};