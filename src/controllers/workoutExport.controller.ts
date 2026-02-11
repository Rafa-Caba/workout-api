import type { Request, Response } from "express";
import { exportWorkoutData } from "../services/workoutExport.service";
import { WorkoutExportQuery } from "../validations/workoutExport.schemas";

const getUserIdFromReq = (req: Request): string => String((req as any).user?.id ?? "");

export const exportWorkout = async (req: Request, res: Response) => {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const q: WorkoutExportQuery = (req as any).validatedQuery ?? (req.query as any);

    try {
        const payload = await exportWorkoutData(userId, q.from, q.to, {
            format: q.format,
            scope: q.scope,
            includeRaw: q.includeRaw,
        });

        res.setHeader("Content-Type", payload.contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${payload.filename}"`);
        return res.status(200).send(payload.body);
    } catch (err: any) {
        const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
        return res.status(status).json({
            error: {
                code: status === 409 ? "NOT_AVAILABLE" : "INTERNAL_ERROR",
                message: err?.message ?? "Export failed",
                details: null,
            },
        });
    }
};
