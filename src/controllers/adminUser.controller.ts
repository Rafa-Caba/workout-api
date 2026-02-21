// src/controllers/adminUser.controller.ts
import type { Request, Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { UserModel } from "../models/User.model";

import type {
    AdminCreateUserInput,
    AdminUpdateUserInput,
    AdminUpdatePasswordInput,
    AdminListUsersQuery,
} from "../validations/adminUser.schemas";

/**
 * Helpers
 */

function toStatus(e: any): number | null {
    return e?.statusCode ?? e?.status ?? e?.response?.status ?? null;
}

function parseIsActive(raw: unknown): boolean | undefined {
    if (raw === undefined) return undefined;
    if (raw === "true" || raw === true) return true;
    if (raw === "false" || raw === false) return false;
    return undefined;
}

function toObjectIdOrNull(v: unknown): mongoose.Types.ObjectId | null {
    if (v === null) return null;
    if (typeof v !== "string") return null;
    if (!/^[a-fA-F0-9]{24}$/.test(v)) return null;
    return new mongoose.Types.ObjectId(v);
}

async function assertTrainerExists(trainerId: mongoose.Types.ObjectId) {
    const trainer = await UserModel.findById(trainerId)
        .select("_id coachMode")
        .lean()
        .exec();

    if (!trainer) {
        throw {
            statusCode: 400,
            code: "ASSIGNED_TRAINER_NOT_FOUND",
            message: "Assigned trainer not found",
        };
    }

    // MVP rule: only allow assigning a user that is actually a TRAINER
    if ((trainer as any).coachMode !== "TRAINER") {
        throw {
            statusCode: 400,
            code: "ASSIGNED_TRAINER_INVALID",
            message: 'Assigned trainer must have coachMode "TRAINER"',
        };
    }
}

/**
 * GET /api/admin/users
 * Supports filters: q, role, isActive (manual parse), coachMode
 */
export async function listUsers(req: Request, res: Response) {
    const qv = ((req as any).validatedQuery ?? req.query) as AdminListUsersQuery;

    const page = Math.max(1, Number(qv.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(qv.limit ?? 20)));
    const skip = (page - 1) * limit;

    const isActive = parseIsActive((req.query as any).isActive);

    const filter: Record<string, any> = {};

    if (qv.role) filter.role = qv.role;
    if (qv.coachMode) filter.coachMode = qv.coachMode;
    if (isActive !== undefined) filter.isActive = isActive;

    if (qv.q) {
        const q = String(qv.q).trim();
        filter.$or = [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
        ];
    }

    const [items, total] = await Promise.all([
        UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
        UserModel.countDocuments(filter).exec(),
    ]);

    // console.log({ trainers: items.filter(trainer => trainer.coachMode === 'TRAINER') });

    return res.json({
        page,
        limit,
        total,
        items: items.map((d) => d.toJSON()),
    });
}

/**
 * POST /api/admin/users
 */
export async function createUser(req: Request, res: Response) {
    const body = (req as any).validatedBody as AdminCreateUserInput;

    const passwordHash = await bcrypt.hash(body.password, 10);

    const coachMode = body.coachMode ?? "NONE";

    // Normalize assignedTrainer to ObjectId/null
    const assignedTrainerId = body.assignedTrainer
        ? toObjectIdOrNull(body.assignedTrainer)
        : null;

    if (coachMode === "TRAINEE") {
        if (!assignedTrainerId) {
            throw {
                statusCode: 400,
                code: "INVALID_COACHING_STATE",
                message: 'assignedTrainer is required when coachMode is "TRAINEE"',
            };
        }
        await assertTrainerExists(assignedTrainerId);
    }

    // For NONE/TRAINER always force null, even if client tries to send something
    const normalizedAssignedTrainer =
        coachMode === "TRAINEE" ? assignedTrainerId : null;

    const doc = await UserModel.create({
        name: body.name,
        email: body.email,
        passwordHash,

        role: body.role ?? "user",
        sex: body.sex ?? null,
        isActive: body.isActive ?? true,

        profilePicUrl: body.profilePicUrl ?? null,

        heightCm: body.heightCm ?? null,
        currentWeightKg: body.currentWeightKg ?? null,
        units: body.units ?? null,

        birthDate: body.birthDate ?? null,
        activityGoal: body.activityGoal ?? null,
        timezone: body.timezone ?? null,

        coachMode,
        assignedTrainer: normalizedAssignedTrainer,
    });

    return res.status(201).json(doc.toJSON());
}

/**
 * GET /api/admin/users/:id
 */
export async function getUserById(req: Request, res: Response) {
    const id = String(req.params.id);

    const doc = await UserModel.findById(id).exec();
    if (!doc) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "User not found" };
    }

    return res.json(doc.toJSON());
}

/**
 * PATCH /api/admin/users/:id
 */
export async function updateUser(req: Request, res: Response) {
    const id = String(req.params.id);
    const body = (req as any).validatedBody as AdminUpdateUserInput;

    const doc = await UserModel.findById(id).exec();
    if (!doc) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "User not found" };
    }

    // Apply simple fields
    if (body.name !== undefined) doc.name = body.name;
    if (body.email !== undefined) doc.email = body.email;
    if (body.role !== undefined) doc.role = body.role;
    if (body.sex !== undefined) doc.sex = body.sex;
    if (body.isActive !== undefined) doc.isActive = body.isActive;

    if (body.profilePicUrl !== undefined) doc.profilePicUrl = body.profilePicUrl;

    if (body.heightCm !== undefined) doc.heightCm = body.heightCm;
    if (body.currentWeightKg !== undefined) doc.currentWeightKg = body.currentWeightKg;
    if (body.units !== undefined) doc.units = body.units;

    if (body.birthDate !== undefined) doc.birthDate = body.birthDate;
    if (body.activityGoal !== undefined) doc.activityGoal = body.activityGoal;
    if (body.timezone !== undefined) doc.timezone = body.timezone;

    /**
     * Coaching updates
     *
     * Important:
     * - If coachMode is being updated to NONE/TRAINER, we force assignedTrainer to null,
     *   unless the request explicitly sets it to null (either way it's null).
     * - If coachMode is being updated to TRAINEE, zod already enforces assignedTrainer presence,
     *   but we still validate the trainer exists and is TRAINER.
     */
    if (body.coachMode !== undefined) {
        doc.coachMode = body.coachMode;

        if (body.coachMode === "TRAINEE") {
            const assignedTrainerId = toObjectIdOrNull(body.assignedTrainer);
            if (!assignedTrainerId) {
                throw {
                    statusCode: 400,
                    code: "INVALID_COACHING_STATE",
                    message:
                        'assignedTrainer is required when setting coachMode to "TRAINEE"',
                };
            }

            await assertTrainerExists(assignedTrainerId);
            doc.assignedTrainer = assignedTrainerId as any;
        } else {
            // NONE or TRAINER
            doc.assignedTrainer = null as any;
        }
    } else if (body.assignedTrainer !== undefined) {
        /**
         * Optional: allow changing assignedTrainer without changing coachMode,
         * but only when the user is already TRAINEE.
         */
        if (doc.coachMode !== "TRAINEE") {
            throw {
                statusCode: 400,
                code: "INVALID_COACHING_STATE",
                message:
                    'assignedTrainer can only be set when user coachMode is "TRAINEE"',
            };
        }

        const assignedTrainerId = toObjectIdOrNull(body.assignedTrainer);
        if (!assignedTrainerId) {
            throw {
                statusCode: 400,
                code: "INVALID_ASSIGNED_TRAINER",
                message: "Invalid assignedTrainer",
            };
        }

        await assertTrainerExists(assignedTrainerId);
        doc.assignedTrainer = assignedTrainerId as any;
    }

    await doc.save();
    return res.json(doc.toJSON());
}

/**
 * PATCH /api/admin/users/:id/password
 */
export async function updateUserPassword(req: Request, res: Response) {
    const id = String(req.params.id);
    const body = (req as any).validatedBody as AdminUpdatePasswordInput;

    const doc = await UserModel.findById(id).exec();
    if (!doc) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "User not found" };
    }

    doc.passwordHash = await bcrypt.hash(body.password, 10);
    await doc.save();

    return res.json({ ok: true });
}

/**
 * DELETE /api/admin/users/:id
 * Soft delete (isActive false)
 */
export async function deleteUser(req: Request, res: Response) {
    const id = String(req.params.id);

    const doc = await UserModel.findById(id).exec();
    if (!doc) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "User not found" };
    }

    doc.isActive = false;
    await doc.save();

    return res.json({ ok: true });
}

/**
 * DELETE /api/admin/users/:id/purge
 * Hard delete + cascade (if you have cascade logic elsewhere)
 */
export async function purgeUser(req: Request, res: Response) {
    const id = String(req.params.id);

    const doc = await UserModel.findById(id).exec();
    if (!doc) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "User not found" };
    }

    await UserModel.deleteOne({ _id: doc._id }).exec();

    return res.json({ ok: true });
}