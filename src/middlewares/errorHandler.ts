// /src/middlewares/errorHandler.ts

import mongoose from "mongoose";
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

type ErrorWithOptionalFields = {
    statusCode?: number;
    code?: string;
    message?: string;
    details?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getErrorFieldMap(
    errors: Record<string, mongoose.Error.ValidatorError | mongoose.Error.CastError>
): Record<string, string> {
    const out: Record<string, string> = {};

    for (const [path, issue] of Object.entries(errors)) {
        out[path] = issue.message;
    }

    return out;
}

export const errorHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request",
                details: err.flatten(),
            },
        });
    }

    if (err instanceof mongoose.Error.ValidationError) {
        return res.status(400).json({
            error: {
                code: "MONGOOSE_VALIDATION_ERROR",
                message: "Document validation failed",
                details: {
                    formErrors: ["One or more persisted fields failed validation."],
                    fieldErrors: getErrorFieldMap(err.errors),
                },
            },
        });
    }

    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({
            error: {
                code: "MONGOOSE_CAST_ERROR",
                message: "Invalid value for persisted field",
                details: {
                    path: err.path,
                    value: err.value,
                    kind: err.kind,
                    stringValue: err.stringValue,
                },
            },
        });
    }

    const safeErr: ErrorWithOptionalFields = isObject(err) ? (err as ErrorWithOptionalFields) : {};

    const statusCode =
        typeof safeErr.statusCode === "number" ? safeErr.statusCode : 500;

    const rawCode = typeof safeErr.code === "string" ? safeErr.code : null;

    const code =
        statusCode === 400
            ? rawCode && rawCode !== "ERROR"
                ? rawCode
                : "VALIDATION_ERROR"
            : rawCode ?? "INTERNAL_ERROR";

    const message =
        typeof safeErr.message === "string"
            ? safeErr.message
            : statusCode === 400
                ? "Invalid request"
                : "Internal server error";

    return res.status(statusCode).json({
        error: {
            code,
            message,
            details: safeErr.details ?? null,
        },
    });
};