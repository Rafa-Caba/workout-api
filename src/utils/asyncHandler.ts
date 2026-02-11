import type { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
        (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch((err) => {
                console.error("🔥 asyncHandler caught error:", err);
                next(err);
            });
        };
