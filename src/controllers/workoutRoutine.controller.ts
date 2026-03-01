import type { Request, Response } from "express";
import {
    addRoutineAttachments,
    deleteRoutineAttachment,
    getRoutineWeek,
    initRoutineWeek,
    setRoutineArchived,
    upsertRoutineWeek,
    patchRoutineGymCheckDay,
    patchGymCheckDay,
    listRoutineWeeks
} from "../services/workoutRoutine.service";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

const normalizeMulterFiles = (req: Request): Express.Multer.File[] => {
    const out: Express.Multer.File[] = [];

    if ((req as any).file) out.push((req as any).file);

    const filesAny = (req as any).files;
    if (filesAny) {
        if (Array.isArray(filesAny)) out.push(...filesAny);
        else if (typeof filesAny === "object") {
            for (const arr of Object.values(filesAny) as any[]) {
                if (Array.isArray(arr)) out.push(...arr);
            }
        }
    }

    return out;
};

export const initWeekRoutine = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await initRoutineWeek(userId, weekKey, {
        title: q.title,
        split: q.split,
        unarchive: q.unarchive,
    });

    return res.status(200).json(out);
};

export const getWeekRoutine = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);

    const out = await getRoutineWeek(userId, weekKey);
    return res.status(200).json(out);
};

export const updateWeekRoutine = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);
    const payload = req.body as any;

    const out = await upsertRoutineWeek(userId, weekKey, payload);
    return res.status(200).json(out);
};

export const archiveWeekRoutine = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);

    const q: any = (req as any).validatedQuery ?? req.query;
    const archived = q.archived !== undefined ? Boolean(q.archived) : true;

    const out = await setRoutineArchived(userId, weekKey, archived);
    return res.status(200).json(out);
};

/**
 * =========================================================
 * Gym Check (sync checklist)
 * =========================================================
 */
export const patchGymCheckForDay = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);
    const dayKey = String(req.params.dayKey);

    // validate() middleware already parsed this
    const payload = (req as any).validatedBody ?? req.body;

    const out = await patchRoutineGymCheckDay(userId, weekKey, dayKey as any, payload);

    if (!out) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Routine week not found", details: { weekKey } },
        });
    }

    return res.status(200).json(out);
};

// =========================================================
// Attachments
// =========================================================

export const addWeekRoutineAttachments = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);

    const files = normalizeMulterFiles(req);
    const out = await addRoutineAttachments(userId, weekKey, files);

    if (!out) {
        return res
            .status(404)
            .json({ error: { code: "NOT_FOUND", message: "Routine week not found", details: { weekKey } } });
    }

    if ((out as any).error) {
        return res.status(400).json(out);
    }

    return res.status(200).json(out);
};

export const deleteWeekRoutineAttachment = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);

    const q: any = (req as any).validatedQuery ?? req.query;
    const publicId = String(q.publicId);
    const deleteCloudinary = q.deleteCloudinary !== undefined ? Boolean(q.deleteCloudinary) : true;

    const out = await deleteRoutineAttachment(userId, weekKey, publicId, deleteCloudinary);

    if (!out) {
        return res
            .status(404)
            .json({ error: { code: "NOT_FOUND", message: "Routine week not found", details: { weekKey } } });
    }

    return res.status(200).json(out);
};

export const patchWeekRoutineGymCheckDay = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const weekKey = String(req.params.weekKey);
    const dayKey = String(req.params.dayKey) as any;

    console.log({
        userId,
        weekKey,
        dayKey,
    });

    const payload = req.body as any;

    const out = await patchGymCheckDay(userId, weekKey, dayKey, payload);

    console.log({ out2: out });

    if (!out) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Routine week not found", details: { weekKey } } });
    }

    return res.status(200).json(out);
};

export const listWeeks = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = (req as any).validatedQuery ?? req.query;

    const out = await listRoutineWeeks(userId, {
        status: q.status,
        limit: q.limit,
    });

    return res.status(200).json(out);
};