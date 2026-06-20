// /src/middlewares/validate.ts
// Middleware central de validación con Zod.
// Mantiene el patrón del backend usando validatedParams, validatedQuery y validatedBody.
// Normaliza multipart/form-data antes de validar y registra detalles claros de validación
// para debugging en logs de Railway sin romper el contrato actual del backend.

import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodIssue, ZodTypeAny } from "zod";

declare global {
    namespace Express {
        interface Request {
            validatedParams?: unknown;
            validatedQuery?: unknown;
            validatedBody?: unknown;
        }
    }
}

type Segment = "params" | "query" | "body";

type ValidateSchemas = Partial<Record<Segment, ZodTypeAny>>;

type ValidationDetails = {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
};

type ValidationErrorPayload = {
    error: {
        code: "VALIDATION_ERROR";
        message: string;
        details: ValidationDetails;
    };
};

const MULTIPART_ARRAY_FIELD_NAMES = new Set<string>([
    "muscleGroup",
    "equipment",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

const issuePathToKey = (path: ZodIssue["path"]): string => {
    if (path.length === 0) {
        return "_form";
    }

    return path.map((segment) => String(segment)).join(".");
};

const formatZodError = (error: ZodError): ValidationDetails => {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];

    for (const issue of error.issues) {
        const key = issuePathToKey(issue.path);

        if (key === "_form") {
            formErrors.push(issue.message);
            continue;
        }

        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }

    return { formErrors, fieldErrors };
};

const logValidationError = (
    req: Request,
    segment: Segment,
    message: string,
    error: ZodError
): void => {
    const details = formatZodError(error);

    console.warn("[VALIDATION_ERROR]", {
        method: req.method,
        path: req.originalUrl,
        segment,
        message,
        details,
    });
};

const sendValidationError = (
    req: Request,
    res: Response,
    segment: Segment,
    message: string,
    error: ZodError
): Response<ValidationErrorPayload> => {
    const details = formatZodError(error);

    logValidationError(req, segment, message, error);

    return res.status(400).json({
        error: {
            code: "VALIDATION_ERROR",
            message,
            details,
        },
    });
};

function parseJsonLikeString(value: string): unknown {
    const trimmed = value.trim();

    if (!trimmed) {
        return value;
    }

    const looksLikeJson =
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}"));

    if (!looksLikeJson) {
        return value;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

/**
 * Normalizes multipart/form-data body values in a safe, generic way.
 *
 * Why this exists:
 * - multipart can send one selected value as string instead of string[]
 * - some clients send JSON arrays as strings
 *
 * We keep it conservative:
 * - parse JSON-like strings
 * - only wrap known multi-select fields into arrays
 */
function normalizeMultipartBody(input: unknown): unknown {
    if (!isRecord(input)) {
        return input;
    }

    const normalizedBody: Record<string, unknown> = {};

    for (const [key, rawValue] of Object.entries(input)) {
        if (typeof rawValue === "string") {
            const parsed = parseJsonLikeString(rawValue);

            if (Array.isArray(parsed)) {
                normalizedBody[key] = parsed;
                continue;
            }

            if (MULTIPART_ARRAY_FIELD_NAMES.has(key)) {
                normalizedBody[key] = rawValue.trim() ? [rawValue] : [];
                continue;
            }

            normalizedBody[key] = parsed;
            continue;
        }

        normalizedBody[key] = rawValue;
    }

    return normalizedBody;
}

const buildValidator =
    (schemas: ValidateSchemas) =>
        (
            req: Request,
            res: Response,
            next: NextFunction
        ): void | Response<ValidationErrorPayload> => {
            if (schemas.params) {
                const parsed = schemas.params.safeParse(req.params);

                if (!parsed.success) {
                    return sendValidationError(
                        req,
                        res,
                        "params",
                        "Invalid route params",
                        parsed.error
                    );
                }

                req.validatedParams = parsed.data;
            }

            if (schemas.query) {
                const parsed = schemas.query.safeParse(req.query);

                if (!parsed.success) {
                    return sendValidationError(
                        req,
                        res,
                        "query",
                        "Invalid query params",
                        parsed.error
                    );
                }

                req.validatedQuery = parsed.data;
            }

            if (schemas.body) {
                const normalizedBody = normalizeMultipartBody(req.body);
                const parsed = schemas.body.safeParse(normalizedBody);

                if (!parsed.success) {
                    return sendValidationError(
                        req,
                        res,
                        "body",
                        "Invalid request body",
                        parsed.error
                    );
                }

                req.validatedBody = parsed.data;
                req.body = parsed.data;
            }

            next();
        };

export function validate(
    segment: Segment,
    schema: ZodTypeAny
): (req: Request, res: Response, next: NextFunction) => void | Response<ValidationErrorPayload>;

export function validate(
    schemas: ValidateSchemas
): (req: Request, res: Response, next: NextFunction) => void | Response<ValidationErrorPayload>;

export function validate(
    arg1: Segment | ValidateSchemas,
    arg2?: ZodTypeAny
): (req: Request, res: Response, next: NextFunction) => void | Response<ValidationErrorPayload> {
    if (typeof arg1 === "string") {
        if (!arg2) {
            throw new Error(`Missing schema for validate("${arg1}", schema)`);
        }

        return buildValidator({ [arg1]: arg2 });
    }

    return buildValidator(arg1);
}