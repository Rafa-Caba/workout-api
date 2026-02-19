import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.model";
import type { UserDocument } from "../models/User.model";

import { AppSettingsModel } from "../models/AppSettings.model";
import { MovementModel } from "../models/Movement.model";
import { RefreshTokenModel } from "../models/RefreshToken.model";
import { UserMetricModel } from "../models/UserMetric.model";
import { UserSettingsModel } from "../models/UserSettings.model";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";

import {
    adminListUsersQuerySchema,
    type AdminListUsersQuery,
    type AdminCreateUserInput,
    type AdminUpdateUserInput,
    type AdminUpdatePasswordInput,
} from "../validations/adminUser.schemas";

import type {
    AdminUserListResponse,
    AdminUserListItem,
} from "../types/adminUser.types";

/**
 * Helper: map UserDocument to the public shape used in admin list.
 * Relies on Mongoose toJSON + toPublicJson to hide sensitive fields.
 */
function toAdminUserListItem(doc: UserDocument): AdminUserListItem {
    const json = doc.toJSON() as any;

    return {
        id: json.id,
        name: json.name,
        email: json.email,
        role: json.role,
        sex: json.sex,
        isActive: json.isActive,
        lastLoginAt: json.lastLoginAt ?? null,
        createdAt: json.createdAt,
        updatedAt: json.updatedAt,
        profilePicUrl: json.profilePicUrl ?? null,
    };
}

/**
 * GET /api/admin/users
 * List users with optional filters and pagination.
 */
export async function listUsers(req: Request, res: Response) {
    const base = adminListUsersQuerySchema.parse(req.query);

    const isActiveStr =
        typeof req.query.isActive === "string"
            ? (req.query.isActive as string)
            : undefined;
    const isActive =
        isActiveStr === "true"
            ? true
            : isActiveStr === "false"
                ? false
                : undefined;

    const query: AdminListUsersQuery = {
        ...base,
        isActive,
    };

    const page =
        Number.isFinite(query.page) && query.page > 0 ? query.page : 1;
    const limit =
        Number.isFinite(query.limit) &&
            query.limit > 0 &&
            query.limit <= 100
            ? query.limit
            : 20;

    const filter: Record<string, any> = {};

    if (query.role) {
        filter.role = query.role;
    }

    if (typeof query.isActive === "boolean") {
        filter.isActive = query.isActive;
    }

    if (query.q) {
        const regex = new RegExp(query.q, "i");
        filter.$or = [{ name: regex }, { email: regex }];
    }

    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
        UserModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec(),
        UserModel.countDocuments(filter).exec(),
    ]);

    const items: AdminUserListItem[] = docs.map(toAdminUserListItem);

    const payload: AdminUserListResponse = {
        items,
        page,
        limit,
        total,
    };

    return res.json(payload);
}

/**
 * Helper: ensure a user exists or throw 404.
 */
async function findUserOrThrow(id: string): Promise<UserDocument> {
    const user = await UserModel.findById(id).exec();
    if (!user) {
        throw {
            statusCode: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }
    return user;
}

/**
 * GET /api/admin/users/:id
 */
export async function getUserById(req: Request, res: Response) {
    const { id } = req.params;

    const user = await findUserOrThrow(id);
    return res.json(user.toJSON());
}

/**
 * POST /api/admin/users
 * Create user with admin privileges.
 */
export async function createUser(req: Request, res: Response) {
    const body = req.body as AdminCreateUserInput;

    const existing = await UserModel.findOne({ email: body.email })
        .lean()
        .exec();
    if (existing) {
        throw {
            statusCode: 400,
            code: "EMAIL_TAKEN",
            message: "A user with this email already exists.",
        };
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = await UserModel.create({
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role ?? "user",
        sex: body.sex ?? null,
        isActive: body.isActive ?? true,
        heightCm: body.heightCm ?? null,
        currentWeightKg: body.currentWeightKg ?? null,
        units: body.units ?? null,
        birthDate: body.birthDate ?? null,
        activityGoal: body.activityGoal ?? null,
        timezone: body.timezone ?? null,
    });

    return res.status(201).json(user.toJSON());
}

/**
 * PATCH /api/admin/users/:id
 * Update editable user fields (not password).
 */
export async function updateUser(req: Request, res: Response) {
    const { id } = req.params;
    const body = req.body as AdminUpdateUserInput;

    const user = await findUserOrThrow(id);

    // if email is changing, ensure uniqueness
    if (body.email && body.email !== user.email) {
        const emailExists = await UserModel.findOne({
            email: body.email,
            _id: { $ne: id },
        })
            .lean()
            .exec();

        if (emailExists) {
            throw {
                statusCode: 400,
                code: "EMAIL_TAKEN",
                message: "A user with this email already exists.",
            };
        }
    }

    if (typeof body.name === "string") user.name = body.name;
    if (typeof body.email === "string") user.email = body.email;
    if (typeof body.role === "string") user.role = body.role;
    if (typeof body.isActive === "boolean") user.isActive = body.isActive;

    if (body.sex !== undefined) user.sex = body.sex ?? null;

    if (body.heightCm !== undefined) user.heightCm = body.heightCm ?? null;
    if (body.currentWeightKg !== undefined)
        user.currentWeightKg = body.currentWeightKg ?? null;

    if (body.units !== undefined) user.units = body.units ?? null;

    if (body.birthDate !== undefined) user.birthDate = body.birthDate ?? null;
    if (body.activityGoal !== undefined)
        user.activityGoal = body.activityGoal ?? null;
    if (body.timezone !== undefined) user.timezone = body.timezone ?? null;

    await user.save();

    return res.json(user.toJSON());
}

/**
 * PATCH /api/admin/users/:id/password
 * Update user password (admin reset).
 */
export async function updateUserPassword(req: Request, res: Response) {
    const { id } = req.params;
    const body = req.body as AdminUpdatePasswordInput;

    const user = await findUserOrThrow(id);

    const passwordHash = await bcrypt.hash(body.password, 10);
    user.passwordHash = passwordHash;

    await user.save();

    return res.json({
        id: user.id,
        message: "Password updated successfully",
    });
}

/**
 * DELETE /api/admin/users/:id
 * Soft delete by default: set isActive = false.
 */
export async function deleteUser(req: Request, res: Response) {
    const { id } = req.params;

    const user = await findUserOrThrow(id);

    // Soft delete: deactivate the user
    user.isActive = false;
    await user.save();

    return res.json({
        id: user.id,
        message: "User deactivated",
    });
}

/**
 * DELETE /api/admin/users/:id/purge
 * Hard delete + cascade cleanup for user-owned data.
 *
 * Returns a cleanup report so FE can show what was removed.
 */
export async function purgeUser(req: Request, res: Response) {
    const { id } = req.params;

    // Ensure user exists first (404 if missing)
    const user = await findUserOrThrow(id);

    // Safety rail: prevent purging yourself (requires verifyToken setting req.user)
    const requesterId = (req as any)?.user?.id as string | undefined;
    if (requesterId && requesterId === user.id) {
        throw {
            statusCode: 400,
            code: "CANNOT_PURGE_SELF",
            message: "No puedes purgar tu propio usuario.",
        };
    }

    type CleanupItem = { model: string; deletedCount: number };
    const cleanup: CleanupItem[] = [];

    /**
     * Helper: deleteMany using the first matching user reference field.
     * This avoids losing functionality if different models use different fields.
     */
    async function deleteByUserRef(
        modelName: string,
        model: any,
        userId: string,
        candidateFields: string[]
    ) {
        // Find the first field that exists in the schema
        const schemaPaths = model?.schema?.paths ? Object.keys(model.schema.paths) : [];
        const field = candidateFields.find((f) => schemaPaths.includes(f));

        if (!field) {
            // Model doesn't have a known user ref field; do nothing safely.
            cleanup.push({ model: modelName, deletedCount: 0 });
            return;
        }

        const result = await model.deleteMany({ [field]: userId }).exec();
        cleanup.push({
            model: modelName,
            deletedCount: typeof result?.deletedCount === "number" ? result.deletedCount : 0,
        });
    }

    // These are the most common names; keep this list conservative and safe.
    const userRefFields = ["userId", "user", "ownerId", "createdBy", "authorId"];

    // 1) Tokens / settings / metrics
    await deleteByUserRef("RefreshToken", RefreshTokenModel, user.id, userRefFields);
    await deleteByUserRef("UserMetric", UserMetricModel, user.id, userRefFields);
    await deleteByUserRef("UserSettings", UserSettingsModel, user.id, userRefFields);

    // 2) Workout data
    await deleteByUserRef("WorkoutDay", WorkoutDayModel, user.id, userRefFields);
    await deleteByUserRef("WorkoutRoutineWeek", WorkoutRoutineWeekModel, user.id, userRefFields);

    /**
     * 3) AppSettings y Movement:
     * - OJO: si AppSettings es GLOBAL (una sola config para toda la app), NO debe borrarse aquí.
     * - Lo dejo en modo "seguro": solo borra si el esquema tiene un campo userRef conocido.
     */
    cleanup.push({ model: "AppSettings", deletedCount: 0 });

    /**
     * Movement:
     * - Si Movement es catálogo global, no se borra (al no tener user ref no hará nada).
     * - Si Movement es por usuario, se borrará con el campo correcto.
     */
    await deleteByUserRef("Movement", MovementModel, user.id, userRefFields);

    // 4) Finally, delete user (hard delete)
    const userDel = await UserModel.deleteOne({ _id: user._id }).exec();
    cleanup.push({
        model: "User",
        deletedCount: typeof userDel?.deletedCount === "number" ? userDel.deletedCount : 0,
    });

    const totalDeleted = cleanup.reduce((sum, i) => sum + i.deletedCount, 0);

    return res.json({
        id: user.id,
        message: "User purged successfully",
        cleanup: {
            items: cleanup,
            totalDeleted,
        },
    });
}
