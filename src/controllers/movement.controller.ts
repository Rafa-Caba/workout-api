// /src/controllers/movement.controller.ts

import type { Request, Response } from "express";

import {
    createMovement,
    deleteMovement,
    getMovementById,
    listMovements,
    updateMovement,
} from "../services/movement.service";
import type {
    CreateMovementBody,
    UpdateMovementBody,
} from "../types/movement.types";

type MovementRouteParams = {
    id: string;
};

type MovementListQuery = {
    activeOnly?: boolean;
    q?: string;
};

type AuthenticatedUser = {
    id: string;
};

type RequestWithUser = Request & {
    user?: AuthenticatedUser;
};

type RequestWithValidatedBody<TBody> = RequestWithUser & {
    validatedBody?: TBody;
};

type RequestWithValidatedParams<TParams> = RequestWithUser & {
    validatedParams?: TParams;
};

type RequestWithValidatedQuery<TQuery> = RequestWithUser & {
    validatedQuery?: TQuery;
};

type RequestWithUploadedFile = Request & {
    file?: Express.Multer.File;
};

function getUserIdFromReq(req: Request): string {
    const request = req as RequestWithUser;
    return String(request.user?.id ?? "");
}

export const list = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const request = req as RequestWithValidatedQuery<MovementListQuery>;
    const query = request.validatedQuery;

    const activeOnly =
        typeof query?.activeOnly === "boolean" ? query.activeOnly : undefined;

    const q = typeof query?.q === "string" ? query.q : undefined;

    const movements = await listMovements({
        userId,
        activeOnly,
        q,
    });

    return res.status(200).json({ movements });
};

export const getById = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const request = req as RequestWithValidatedParams<MovementRouteParams>;
    const params = request.validatedParams ?? req.params;

    const movement = await getMovementById({
        userId,
        id: String(params.id),
    });

    if (!movement) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Movement not found",
                details: { id: params.id },
            },
        });
    }

    return res.status(200).json(movement);
};

export const create = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const request = req as RequestWithValidatedBody<CreateMovementBody> &
        RequestWithUploadedFile;

    const body = request.validatedBody ?? (req.body as CreateMovementBody);
    const mediaFile = request.file ?? null;

    const movement = await createMovement({
        userId,
        payload: body,
        mediaFile,
    });

    return res.status(201).json(movement);
};

export const update = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const request = req as RequestWithValidatedParams<MovementRouteParams> &
        RequestWithValidatedBody<UpdateMovementBody> &
        RequestWithUploadedFile;

    const params = request.validatedParams ?? req.params;
    const body = request.validatedBody ?? (req.body as UpdateMovementBody);
    const mediaFile = request.file ?? null;

    const movement = await updateMovement({
        userId,
        id: String(params.id),
        payload: body,
        mediaFile,
    });

    if (!movement) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Movement not found",
                details: { id: params.id },
            },
        });
    }

    return res.status(200).json(movement);
};

export const remove = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    const request = req as RequestWithValidatedParams<MovementRouteParams>;
    const params = request.validatedParams ?? req.params;

    const movement = await deleteMovement({
        userId,
        id: String(params.id),
    });

    if (!movement) {
        return res.status(404).json({
            error: {
                code: "NOT_FOUND",
                message: "Movement not found",
                details: { id: params.id },
            },
        });
    }

    return res.status(200).json({
        deleted: true,
        movement,
    });
};