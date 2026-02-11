import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny, ZodError, ZodIssue } from "zod";

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

/**
 * Convert Zod issues into dot/bracket notation paths
 * e.g. training.sessions[0].exercises[1].sets[0].weight
 */
const issuePathToKey = (path: PropertyKey[]): string => {
    if (!path || path.length === 0) return "_form";

    return path
        .map((seg) => {
            if (typeof seg === "string") return seg;
            if (typeof seg === "number") return String(seg);
            return seg.toString();
        })
        .join(".");
};

const formatZodError = (err: ZodError) => {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];

    for (const issue of err.issues) {
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
    err: ZodError
): Response<ValidationErrorPayload> => {
    return res.status(400).json({
        error: {
            code: "VALIDATION_ERROR",
            message,
            details: formatZodError(err),
        },
    });
};

// Overloads
export function validate(
    segment: Segment,
    schema: ZodTypeAny
): (req: Request, res: Response, next: NextFunction) => void;

export function validate(
    schemas: ValidateSchemas
): (req: Request, res: Response, next: NextFunction) => void;

export function validate(
    a: Segment | ValidateSchemas,
    b?: ZodTypeAny
) {
    const schemas: ValidateSchemas =
        typeof a === "string"
            ? { [a]: b as ZodTypeAny }
            : (a as ValidateSchemas);

    return (req: Request, res: Response, next: NextFunction) => {
        if (schemas.params) {
            const parsed = schemas.params.safeParse(req.params);
            if (!parsed.success) {
                return sendValidationError(res, "Invalid route params", parsed.error);
            }
            (req as any).validatedParams = parsed.data;
        }

        if (schemas.query) {
            const parsed = schemas.query.safeParse(req.query);
            if (!parsed.success) {
                return sendValidationError(res, "Invalid query params", parsed.error);
            }
            (req as any).validatedQuery = parsed.data;
        }

        if (schemas.body) {
            const parsed = schemas.body.safeParse(req.body);
            if (!parsed.success) {
                return sendValidationError(res, "Invalid request body", parsed.error);
            }
            (req as any).validatedBody = parsed.data;
            req.body = parsed.data;
        }

        next();
    };
}
