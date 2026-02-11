import type { Request, Response } from "express";
import { authService } from "../services/auth.service";

const readRefreshToken = (req: Request): string | null => {
    // Prefer body (your types), but also allow cookie for future
    const fromBody = (req.body?.refreshToken as string | undefined) ?? null;
    const fromCookie = (req.cookies?.refreshToken as string | undefined) ?? null;
    return fromBody || fromCookie;
};

export const authController = {
    async register(req: Request, res: Response) {
        const { name, email, password, sex } = req.body;
        const data = await authService.register({ name, email, password, sex }, req);
        res.status(201).json(data);
    },

    async login(req: Request, res: Response) {
        const { email, password } = req.body;
        const data = await authService.login({ email, password }, req);
        res.json(data);
    },

    async refresh(req: Request, res: Response) {
        const token = readRefreshToken(req);
        if (!token) {
            return res.status(400).json({
                error: { code: "MISSING_REFRESH", message: "Missing refresh token" },
            });
        }

        const tokens = await authService.refresh(token, req);
        res.json({ tokens });
    },

    async logout(req: Request, res: Response) {
        const token = readRefreshToken(req);
        if (!token) {
            // idempotent
            return res.json({ ok: true });
        }

        const out = await authService.logout(token);
        res.json(out);
    },
};
