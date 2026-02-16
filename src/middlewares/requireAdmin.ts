import type { Request, Response, NextFunction } from "express";

/**
 * Ensure the authenticated user is an admin.
 * Must be used AFTER requireAuth.
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user || user.role !== "admin") {
        return next({
            statusCode: 403,
            code: "FORBIDDEN",
            message: "Admin only",
        });
    }

    return next();
};
