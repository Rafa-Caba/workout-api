import type { Request, Response } from "express";
import { deleteMediaByPublicId, getMediaFeed, getMediaGrouped } from "../services/workoutMedia.service";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

export const getMedia = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await getMediaFeed({
        userId,

        source: q.source,

        from: q.from,
        to: q.to,
        date: q.date,
        weekKey: q.weekKey,
        sessionId: q.sessionId,
        resourceType: q.resourceType,
        limit: q.limit,
        cursor: q.cursor ?? null,
    });

    return res.status(200).json(out);
};

export const getMediaGroupedView = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await getMediaGrouped({
        userId,

        source: q.source,

        groupBy: q.groupBy ?? "day",
        from: q.from,
        to: q.to,
        date: q.date,
        weekKey: q.weekKey,
        sessionId: q.sessionId,
        resourceType: q.resourceType,
        limit: q.limit,
        cursor: q.cursor ?? null,
        perGroupLimit: 50,
    });

    return res.status(200).json(out);
};

export const deleteMedia = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = (req as any).validatedQuery ?? req.query;

    const publicId = String(q.publicId);
    const deleteCloudinary = q.deleteCloudinary !== undefined ? Boolean(q.deleteCloudinary) : true;

    const out = await deleteMediaByPublicId(userId, publicId, deleteCloudinary);
    return res.status(200).json(out);
};
