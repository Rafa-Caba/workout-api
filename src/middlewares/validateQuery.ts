import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

const formatZodError = (err: ZodError) => {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];

    for (const issue of err.issues) {
        const path = issue.path.join(".") || "form";
        if (path === "form") formErrors.push(issue.message);
        else {
            fieldErrors[path] = fieldErrors[path] ?? [];
            fieldErrors[path].push(issue.message);
        }
    }

    return { formErrors, fieldErrors };
};

export const validateQuery =
    (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed = schema.parse(req.query);

            (req as any).validatedQuery = parsed;

            (req as any).query = parsed;

            return next();
        } catch (err) {
            if (err instanceof ZodError) {
                return res.status(400).json({
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid query parameters",
                        details: formatZodError(err),
                    },
                });
            }

            return res.status(500).json({
                error: {
                    code: "INTERNAL_ERROR",
                    message: "Internal server error",
                    details: null,
                },
            });
        }
    };
