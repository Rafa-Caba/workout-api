import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    // Zod error fallback
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request",
                details: err.flatten(),
            },
        });
    }

    // Generic http-ish errors
    const statusCode =
        typeof err?.statusCode === "number" ? err.statusCode : 500;

    const rawCode = typeof err?.code === "string" ? err.code : null;

    // Normalize 400s to VALIDATION_ERROR if not set
    const code =
        statusCode === 400
            ? rawCode && rawCode !== "ERROR"
                ? rawCode
                : "VALIDATION_ERROR"
            : rawCode ?? "INTERNAL_ERROR";

    const message =
        typeof err?.message === "string"
            ? err.message
            : statusCode === 400
                ? "Invalid request"
                : "Internal server error";

    return res.status(statusCode).json({
        error: {
            code,
            message,
            details: err?.details ?? null,
        },
    });
};
