import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.model";
import type { UserDocument } from "../models/User.model";
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
 * If you want hard delete, you can swap implementation.
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
