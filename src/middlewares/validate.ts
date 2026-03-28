// /src/middlewares/validate.ts

import type { NextFunction, Request, Response } from "express";
import type { ZodError, ZodTypeAny } from "zod";

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

type ValidationErrorPayload = {
    error: {
        code: "VALIDATION_ERROR";
        message: string;
        details: {
            formErrors: string[];
            fieldErrors: Record<string, string[]>;
        };
    };
};

const MULTIPART_ARRAY_FIELD_NAMES = new Set<string>([
    "muscleGroup",
    "equipment",
]);

const issuePathToKey = (path: PropertyKey[]): string => {
    if (path.length === 0) {
        return "_form";
    }

    return path
        .map((segment) => {
            if (typeof segment === "string") return segment;
            if (typeof segment === "number") return String(segment);
            return String(segment);
        })
        .join(".");
};

const formatZodError = (error: ZodError) => {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];

    for (const issue of error.issues) {
        const key = issuePathToKey(issue.path);

        if (key === "_form") {
            formErrors.push(issue.message);
            continue;
        }

        if (!fieldErrors[key]) {
            fieldErrors[key] = [];
        }

        fieldErrors[key].push(issue.message);
    }

    return { formErrors, fieldErrors };
};

const sendValidationError = (
    res: Response,
    message: string,
    error: ZodError
): Response<ValidationErrorPayload> => {
    return res.status(400).json({
        error: {
            code: "VALIDATION_ERROR",
            message,
            details: formatZodError(error),
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
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        return input;
    }

    const rawBody = input as Record<string, unknown>;
    const normalizedBody: Record<string, unknown> = {};

    for (const [key, rawValue] of Object.entries(rawBody)) {
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
                    return sendValidationError(res, "Invalid route params", parsed.error);
                }

                req.validatedParams = parsed.data;
            }

            if (schemas.query) {
                const parsed = schemas.query.safeParse(req.query);
                if (!parsed.success) {
                    return sendValidationError(res, "Invalid query params", parsed.error);
                }

                req.validatedQuery = parsed.data;
            }

            if (schemas.body) {
                const normalizedBody = normalizeMultipartBody(req.body);
                const parsed = schemas.body.safeParse(normalizedBody);

                if (!parsed.success) {
                    return sendValidationError(res, "Invalid request body", parsed.error);
                }

                req.validatedBody = parsed.data;
                req.body = parsed.data;
            }

            next();
        };

// Overloads
export function validate(
    segment: Segment,
    schema: ZodTypeAny
): (req: Request, res: Response, next: NextFunction) => void | Response<ValidationErrorPayload>;

export function validate(
    schemas: ValidateSchemas
): (req: Request, res: Response, next: NextFunction) => void | Response<ValidationErrorPayload>;

export function validate(arg1: Segment | ValidateSchemas, arg2?: ZodTypeAny) {
    if (typeof arg1 === "string") {
        if (!arg2) {
            throw new Error(`Missing schema for validate("${arg1}", schema)`);
        }

        return buildValidator({ [arg1]: arg2 });
    }

    return buildValidator(arg1);
}