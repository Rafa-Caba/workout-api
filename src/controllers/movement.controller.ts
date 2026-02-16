import type { Request, Response } from "express";
import {
    createMovement,
    deleteMovement,
    getMovementById,
    listMovements,
    updateMovement,
} from "../services/movement.service";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

export const list = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const q: any = (req as any).validatedQuery ?? req.query;

    const movements = await listMovements({
        userId,
        activeOnly: q.activeOnly,
        q: q.q,
    });

    return res.status(200).json({ movements });
};

export const getById = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const params: any = (req as any).validatedParams ?? req.params;

    const movement = await getMovementById({ userId, id: String(params.id) });
    if (!movement) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Movement not found", details: { id: params.id } },
        });
    }

    return res.status(200).json(movement);
};

export const create = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const body: any = (req as any).validatedBody ?? req.body;

    // Archivo subido por uploadMovementMedia.single("media")
    const mediaFile = (req as any).file as Express.Multer.File | undefined | null;

    const movement = await createMovement({
        userId,
        payload: body,
        mediaFile: mediaFile ?? null,
    });

    return res.status(201).json(movement);
};

export const update = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const params: any = (req as any).validatedParams ?? req.params;
    const body: any = (req as any).validatedBody ?? req.body;

    // Archivo subido por uploadMovementMedia.single("media")
    const mediaFile = (req as any).file as Express.Multer.File | undefined | null;

    const movement = await updateMovement({
        userId,
        id: String(params.id),
        payload: body,
        mediaFile: mediaFile ?? null,
    });

    if (!movement) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Movement not found", details: { id: params.id } },
        });
    }

    return res.status(200).json(movement);
};

export const remove = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const params: any = (req as any).validatedParams ?? req.params;

    const movement = await deleteMovement({ userId, id: String(params.id) });
    if (!movement) {
        return res.status(404).json({
            error: { code: "NOT_FOUND", message: "Movement not found", details: { id: params.id } },
        });
    }

    return res.status(200).json({ deleted: true, movement });
};
