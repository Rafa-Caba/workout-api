// /src/controllers/workoutExport.controller.ts
// Streams legacy text exports and complete XLSX/PDF workout report files.

import type { Request, Response } from "express";

import { exportWorkoutData } from "../services/workoutExport.service";
import { createWorkoutReportFile } from "../services/workoutExport/workoutExportFile.service";
import {
    workoutExportQuerySchema,
    workoutReportRequestSchema,
} from "../validations/workoutExport.schemas";

function getUserId(req: Request): string {
    return req.user?.id ?? "";
}

function requireUserId(req: Request): string {
    const userId = getUserId(req);

    if (!userId) {
        throw Object.assign(new Error("Unauthorized"), {
            statusCode: 401,
            code: "UNAUTHORIZED",
        });
    }

    return userId;
}

/**
 * Legacy GET /api/workout/export endpoint for JSON and CSV.
 *
 * The middleware has already validated the query, but parsing the stored
 * unknown value here keeps the controller strongly typed without assertions.
 */
export const exportWorkout = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = requireUserId(req);
    const query = workoutExportQuerySchema.parse(req.validatedQuery);
    const payload = await exportWorkoutData(userId, query.from, query.to, {
        format: query.format,
        scope: query.scope,
        includeRaw: query.includeRaw,
    });

    res.setHeader("Content-Type", payload.contentType);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${payload.filename}"`,
    );
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).send(payload.body);
};

/**
 * POST /api/workout/export endpoint for complete XLSX and PDF files.
 *
 * The request body is parsed from validatedBody to preserve a precise
 * controller-to-service contract without trusting an unknown value.
 */
export const exportWorkoutFile = async (
    req: Request,
    res: Response,
): Promise<Response> => {
    const userId = requireUserId(req);
    const request = workoutReportRequestSchema.parse(req.validatedBody);
    const file = await createWorkoutReportFile(userId, request);

    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
        "Content-Disposition",
        `attachment; filename="${file.filename}"`,
    );
    res.setHeader("Content-Length", String(file.buffer.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.status(200).send(file.buffer);
};
