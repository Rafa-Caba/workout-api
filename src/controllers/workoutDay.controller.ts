import type { Request, Response } from "express";
import path from "path";
import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";
import {
    getDayByDate,
    getDaysInRange,
    getStatsInRange,
    getCalendarInRange,
    getWeekViewByKey,
    upsertWorkoutDay,
} from "../services/workoutDay.service";

/**
 * =========================================================
 * Helpers (controller-local)
 * =========================================================
 */

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const inferResourceType = (mimetype?: string | null): "image" | "video" => {
    const mt = (mimetype ?? "").toLowerCase();
    if (mt.startsWith("video/")) return "video";
    return "image";
};

const inferFormat = (filenameOrOriginal?: string | null): string | null => {
    if (!filenameOrOriginal) return null;
    const ext = path.extname(filenameOrOriginal).replace(".", "").toLowerCase();
    return ext || null;
};

const normalizeMulterFiles = (req: Request): Express.Multer.File[] => {
    const out: Express.Multer.File[] = [];

    // single
    if ((req as any).file) out.push((req as any).file);

    // fields() -> object map of arrays
    const filesAny = (req as any).files;
    if (filesAny) {
        if (Array.isArray(filesAny)) {
            // array() style
            out.push(...filesAny);
        } else if (typeof filesAny === "object") {
            // fields() style: { file?: File[], files?: File[] }
            for (const arr of Object.values(filesAny) as any[]) {
                if (Array.isArray(arr)) out.push(...arr);
            }
        }
    }

    return out;
};

const findSession = (dayDoc: any, sessionId: string) => {
    const sessions: any[] | null = dayDoc?.training?.sessions ?? null;
    if (!sessions || !Array.isArray(sessions)) return null;

    return sessions.find((s: any) => String(s._id) === sessionId || String(s.id) === sessionId) ?? null;
};

/**
 * =========================================================
 * Core endpoints
 * =========================================================
 */

export const upsertDay = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const mode = (req.query.mode as "merge" | "replace") ?? "merge";
    const payload = req.body as any;

    const updated = await upsertWorkoutDay({ userId, date, payload, mode });
    return res.status(200).json(updated);
};

export const getDay = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);

    const day = await getDayByDate(userId, date);
    return res.status(200).json(day);
};

export const getDaysRange = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const from = String(req.query.from);
    const to = String(req.query.to);

    const days = await getDaysInRange(userId, from, to);
    return res.status(200).json({ from, to, days });
};

export const getWeek = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);

    const q: any = (req as any).validatedQuery ?? req.query;
    const fields: string[] | null = q.fields ?? null;

    const opts = {
        fillMissingDays: Boolean(q.fillMissingDays),
        includeRollups: Boolean(q.includeRollups),

        includeSleep: q.includeSleep !== undefined ? Boolean(q.includeSleep) : true,
        includeTraining: q.includeTraining !== undefined ? Boolean(q.includeTraining) : true,
        includeSummaries: q.includeSummaries !== undefined ? Boolean(q.includeSummaries) : true,
        includeTotals: q.includeTotals !== undefined ? Boolean(q.includeTotals) : true,
        includeTypes: q.includeTypes !== undefined ? Boolean(q.includeTypes) : true,
        includeRaw: q.includeRaw !== undefined ? Boolean(q.includeRaw) : false,
    };

    const data = await getWeekViewByKey(userId, weekKey, fields, opts);
    return res.status(200).json(data);
};

export const getCalendar = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const from = String(req.query.from);
    const to = String(req.query.to);

    const q: any = (req as any).validatedQuery ?? req.query;
    const fields = q.fields ?? null;

    const opts = {
        fillMissingDays: Boolean(q.fillMissingDays),
        includeRollups: Boolean(q.includeRollups),

        includeSleep: q.includeSleep !== undefined ? Boolean(q.includeSleep) : true,
        includeTraining: q.includeTraining !== undefined ? Boolean(q.includeTraining) : true,
        includeSummaries: q.includeSummaries !== undefined ? Boolean(q.includeSummaries) : true,
        includeTotals: q.includeTotals !== undefined ? Boolean(q.includeTotals) : true,
        includeTypes: q.includeTypes !== undefined ? Boolean(q.includeTypes) : true,
        includeRaw: q.includeRaw !== undefined ? Boolean(q.includeRaw) : false,
    };

    const data = await getCalendarInRange(userId, from, to, fields, opts);
    return res.status(200).json(data);
};

export const getStats = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const from = String(req.query.from);
    const to = String(req.query.to);

    const stats = await getStatsInRange({ userId, from, to });
    return res.status(200).json(stats);
};

/**
 * =========================================================
 * Media endpoints (UPLOAD)
 * =========================================================
 */

export const addSessionMedia = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const sessionId = String(req.params.sessionId);

    const q: any = (req as any).validatedQuery ?? req.query;
    const returnMode: "day" | "session" = q?.returnMode === "session" ? "session" : "day";

    const files = normalizeMulterFiles(req);

    if (!files.length) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: 'No files uploaded. Expected multipart field: "file" or "files".',
                details: null,
            },
        });
    }

    const mediaItems = files.map((file: any) => {
        const publicId: string | null = file.filename ? String(file.filename) : null;
        const url: string | null = file.path ? String(file.path) : null;

        const resourceType = inferResourceType(file.mimetype);
        const format = inferFormat(file.originalname ?? file.filename);

        return {
            publicId,
            url,
            resourceType,
            format,
            createdAt: new Date().toISOString(),
            meta: {
                originalname: file.originalname ?? null,
                mimetype: file.mimetype ?? null,
                bytes: file.size ?? null,
            },
        };
    });

    const missing = mediaItems.find((m) => !m.publicId || !m.url);
    if (missing) {
        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Upload succeeded but file metadata missing (publicId/url).",
                details: {
                    gotCount: files.length,
                    missingPublicId: mediaItems.filter((m) => !m.publicId).length,
                    missingUrl: mediaItems.filter((m) => !m.url).length,
                },
            },
        });
    }

    const dayDoc = await WorkoutDayModel.findOne({
        userId: toObjectId(userId),
        date,
    });

    if (!dayDoc) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Workout day not found", details: { date } },
        });
    }

    const session = findSession(dayDoc as any, sessionId);
    if (!session) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Training session not found", details: { sessionId } },
        });
    }

    if (!Array.isArray(session.media)) session.media = [];
    for (const item of mediaItems) session.media.push(item);

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    if (returnMode === "session") {
        const outSession = outDay?.training?.sessions?.find((s: any) => String(s?.id) === sessionId) ?? null;

        return res.status(200).json({
            session: outSession,
            uploadedCount: mediaItems.length,
        });
    }

    return res.status(200).json(outDay);
};

export const deleteSessionMedia = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const sessionId = String(req.params.sessionId);

    const q: any = (req as any).validatedQuery ?? req.query;
    const publicId = typeof q.publicId === "string" ? q.publicId : null;

    const returnMode: "day" | "session" = q?.returnMode === "session" ? "session" : "day";

    if (!publicId) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Missing required query param: publicId",
                details: null,
            },
        });
    }

    const dayDoc = await WorkoutDayModel.findOne({
        userId: toObjectId(userId),
        date,
    });

    if (!dayDoc) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Workout day not found", details: { date } },
        });
    }

    const session = findSession(dayDoc as any, sessionId);
    if (!session) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Training session not found", details: { sessionId } },
        });
    }

    const mediaArr: any[] = Array.isArray(session.media) ? session.media : [];
    if (mediaArr.length === 0) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "This session has no media.", details: null },
        });
    }

    const found = mediaArr.find((m: any) => m?.publicId === publicId);
    if (!found) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Media not found on this session.", details: { publicId } },
        });
    }

    session.media = mediaArr.filter((m: any) => m?.publicId !== publicId);

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    const rt: "image" | "video" = found?.resourceType === "video" ? "video" : "image";
    await deleteFromCloudinary(publicId, { resourceType: rt });

    if (returnMode === "session") {
        const outSession = outDay?.training?.sessions?.find((s: any) => String(s?.id) === sessionId) ?? null;

        return res.status(200).json({
            session: outSession,
            cloudinary: { deleted: true, error: null },
        });
    }

    return res.status(200).json(outDay);
};

/**
 * =========================================================
 * Media endpoints (ATTACH existing Cloudinary assets)
 * - No upload, no Cloudinary mutation
 * =========================================================
 */

export const attachSessionMedia = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const date = String(req.params.date);
    const sessionId = String(req.params.sessionId);

    const q: any = (req as any).validatedQuery ?? req.query;
    const returnMode: "day" | "session" = q?.returnMode === "session" ? "session" : "day";

    // validate() middleware already parsed this
    const payload: any = (req as any).validatedBody ?? req.body;
    const items: any[] = Array.isArray(payload?.items) ? payload.items : [];

    if (!items.length) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: "Expected non-empty body.items array.", details: null },
        });
    }

    const dayDoc = await WorkoutDayModel.findOne({
        userId: toObjectId(userId),
        date,
    });

    if (!dayDoc) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Workout day not found", details: { date } },
        });
    }

    const session = findSession(dayDoc as any, sessionId);
    if (!session) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Training session not found", details: { sessionId } },
        });
    }

    if (!Array.isArray(session.media)) session.media = [];

    const existingIds = new Set<string>((session.media ?? []).map((m: any) => String(m?.publicId ?? "").trim()).filter(Boolean));

    let attachedCount = 0;
    for (const raw of items) {
        const publicId = String(raw?.publicId ?? "").trim();
        const url = String(raw?.url ?? "").trim();

        if (!publicId || !url) continue;
        if (existingIds.has(publicId)) continue;

        const resourceType: "image" | "video" = raw?.resourceType === "video" ? "video" : "image";
        const format = raw?.format === null || typeof raw?.format === "string" ? (raw.format ?? null) : null;

        const createdAt =
            raw?.createdAt === null || typeof raw?.createdAt === "string"
                ? (raw.createdAt ?? null)
                : null;

        session.media.push({
            publicId,
            url,
            resourceType,
            format,
            createdAt: createdAt && createdAt.trim() ? createdAt : new Date().toISOString(),
            meta: raw?.meta ?? null,
        });

        existingIds.add(publicId);
        attachedCount++;
    }

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    if (returnMode === "session") {
        const outSession = outDay?.training?.sessions?.find((s: any) => String(s?.id) === sessionId) ?? null;

        return res.status(200).json({
            session: outSession,
            attachedCount,
        });
    }

    return res.status(200).json({
        ...outDay,
        _attach: { attachedCount },
    });
};
