import type { Request, Response } from "express";
import * as settingsService from "../services/settings.service";

function getUserIdFromReq(req: Request): string {
    return String((req as any).user?.id ?? "");
}

// GET /api/settings/me
export async function getMySettings(req: Request, res: Response) {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const out = await settingsService.getMySettings(userId);
    return res.json(out);
}

// PATCH /api/settings/me
export async function patchMySettings(req: Request, res: Response) {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // validateBody already guaranteed shape
    const out = await settingsService.patchMySettings(userId, req.body);
    return res.json(out);
}
