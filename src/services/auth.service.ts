import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import type { Request } from "express";
import env from "../config/env";
import { UserModel } from "../models/User.model";
import { RefreshTokenModel } from "../models/RefreshToken.model";
import { parseDurationToMs } from "../utils/duration";
import { randomToken, sha256 } from "../utils/crypto";

type Role = "admin" | "user";

type PublicUser = {
    id: string;
    name: string;
    email: string;
    sex: "male" | "female" | "other" | null;
    role: Role;

    profilePicUrl: string | null;

    heightCm: number | null;
    currentWeightKg: number | null;
    units: { weight: "kg" | "lb"; distance: "km" | "mi" } | null;

    birthDate: string | null;
    activityGoal: "fat_loss" | "hypertrophy" | "strength" | "maintenance" | "other" | null;
    timezone: string | null;

    createdAt?: string;
    updatedAt?: string;
};

type Tokens = { accessToken: string; refreshToken: string };

const toPublicUser = (user: any): PublicUser => {
    // user.toJSON() already strips passwordHash & maps id
    return user.toJSON();
};

const signAccessToken = (userId: string, role: Role): string => {
    const options: SignOptions = {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    };

    return jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, options);
};

const buildRefreshExpiryDate = (): Date => {
    const ms = parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN);
    return new Date(Date.now() + ms);
};

const getClientIp = (req: Request): string | null => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim() || null;
    if (Array.isArray(forwarded)) return forwarded[0] || null;
    return req.socket.remoteAddress || null;
};

export const authService = {
    async register(input: { name: string; email: string; password: string; sex?: any }, req: Request) {
        const email = input.email.toLowerCase();

        const existing = await UserModel.findOne({ email });
        if (existing) {
            throw { status: 409, code: "EMAIL_IN_USE", message: "Email is already registered" };
        }

        const passwordHash = await bcrypt.hash(input.password, 10);

        // First user can be admin if you want (optional). Keeping default role=user.
        const user = await UserModel.create({
            name: input.name,
            email,
            passwordHash,
            sex: input.sex ?? null,
            role: "user",
            isActive: true,
        });

        const tokens = await this.issueTokens(user.id, user.role, req);

        return { user: toPublicUser(user), tokens };
    },

    async login(input: { email: string; password: string }, req: Request) {
        const email = input.email.toLowerCase();

        const user = await UserModel.findOne({ email });
        if (!user || !user.isActive) {
            throw { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" };
        }

        const ok = await bcrypt.compare(input.password, user.passwordHash);
        if (!ok) {
            throw { status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" };
        }

        user.lastLoginAt = new Date();
        await user.save();

        const tokens = await this.issueTokens(user.id, user.role, req);
        return { user: toPublicUser(user), tokens };
    },

    async refresh(refreshToken: string, req: Request) {
        const tokenHash = sha256(refreshToken);

        const stored = await RefreshTokenModel.findOne({ tokenHash });
        if (!stored) {
            throw { status: 401, code: "INVALID_REFRESH", message: "Invalid refresh token" };
        }

        if (stored.revokedAt) {
            throw { status: 401, code: "REVOKED_REFRESH", message: "Refresh token revoked" };
        }

        if (stored.expiresAt.getTime() <= Date.now()) {
            throw { status: 401, code: "EXPIRED_REFRESH", message: "Refresh token expired" };
        }

        const user = await UserModel.findById(stored.userId);
        if (!user || !user.isActive) {
            throw { status: 401, code: "UNAUTHORIZED", message: "User not found or inactive" };
        }

        // Rotate: revoke old + create new
        const newRefreshToken = randomToken(64);
        const newHash = sha256(newRefreshToken);

        stored.revokedAt = new Date();
        stored.replacedByTokenHash = newHash;
        await stored.save();

        await RefreshTokenModel.create({
            userId: user._id,
            tokenHash: newHash,
            expiresAt: buildRefreshExpiryDate(),
            userAgent: req.headers["user-agent"] ?? null,
            ip: getClientIp(req),
        });

        const accessToken = signAccessToken(user.id, user.role);

        return { accessToken, refreshToken: newRefreshToken };
    },

    async logout(refreshToken: string) {
        const tokenHash = sha256(refreshToken);

        const stored = await RefreshTokenModel.findOne({ tokenHash });
        if (!stored) {
            // logout should be idempotent
            return { ok: true as const };
        }

        if (!stored.revokedAt) {
            stored.revokedAt = new Date();
            await stored.save();
        }

        return { ok: true as const };
    },

    async issueTokens(userId: string, role: Role, req: Request): Promise<Tokens> {
        const accessToken = signAccessToken(userId, role);

        const refreshToken = randomToken(64);
        const tokenHash = sha256(refreshToken);

        await RefreshTokenModel.create({
            userId,
            tokenHash,
            expiresAt: buildRefreshExpiryDate(),
            userAgent: req.headers["user-agent"] ?? null,
            ip: getClientIp(req),
        });

        return { accessToken, refreshToken };
    },
};
