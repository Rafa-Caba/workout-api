import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

type AnySchema = ZodSchema<any>;

type ValidationTarget = "params" | "query" | "body";

export type ValidationErrorPayload = {
    code: "VALIDATION_ERROR";
    message: string;
    details: any;
};

class HttpError extends Error {
    public statusCode: number;
    public code: string;
    public details?: any;

    constructor(statusCode: number, code: string, message: string, details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

const toZodDetails = (err: ZodError) => err.flatten();

const validate =
    (target: ValidationTarget, schema: AnySchema) =>
        (req: Request, _res: Response, next: NextFunction) => {
            try {
                const parsed = schema.parse((req as any)[target]);

                // Store validated versions so controllers can prefer them.
                if (target === "query") (req as any).validatedQuery = parsed;
                if (target === "params") (req as any).validatedParams = parsed;
                if (target === "body") (req as any).validatedBody = parsed;

                return next();
            } catch (e) {
                if (e instanceof ZodError) {
                    const details = toZodDetails(e);

                    // CRITICAL: return 400 VALIDATION_ERROR (not 500)
                    return next(
                        new HttpError(
                            400,
                            "VALIDATION_ERROR",
                            `Invalid ${target} parameters`,
                            details
                        )
                    );
                }

                return next(e);
            }
        };

export const validateParams = (schema: AnySchema) => validate("params", schema);
export const validateQuery = (schema: AnySchema) => validate("query", schema);
export const validateBody = (schema: AnySchema) => validate("body", schema);

export { HttpError };
