import mongoose from "mongoose";
import { MovementModel } from "../models/Movement.model";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

export const listMovements = async (args: {
    userId: string;
    activeOnly?: boolean;
    q?: string;
}) => {
    const { userId, activeOnly, q } = args;

    const filter: any = { userId: toObjectId(userId) };
    if (activeOnly === true) filter.isActive = true;

    if (q && q.trim()) {
        const qTrim = q.trim().toLowerCase();
        filter.$or = [
            { nameLower: { $regex: qTrim, $options: "i" } },
            { muscleGroup: { $regex: qTrim, $options: "i" } },
            { equipment: { $regex: qTrim, $options: "i" } },
        ];
    }

    const docs = await MovementModel.find(filter).sort({ nameLower: 1 }).lean();
    // lean() returns plain objects; toPublicJson transform won't run
    // so we return non-lean for consistent "id" output:
    const docs2 = await MovementModel.find(filter).sort({ nameLower: 1 });
    return docs2.map((d) => d.toJSON());
};

export const getMovementById = async (args: { userId: string; id: string }) => {
    const { userId, id } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const doc = await MovementModel.findOne({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    return doc ? doc.toJSON() : null;
};

export const createMovement = async (args: {
    userId: string;
    payload: {
        name: string;
        muscleGroup?: string | null;
        equipment?: string | null;
        isActive?: boolean;
    };
}) => {
    const { userId, payload } = args;

    try {
        const doc = await MovementModel.create({
            userId: toObjectId(userId),
            name: payload.name,
            muscleGroup: payload.muscleGroup ?? null,
            equipment: payload.equipment ?? null,
            isActive: payload.isActive ?? true,
        });

        return doc.toJSON();
    } catch (err: any) {
        // unique constraint
        if (err?.code === 11000) {
            throw {
                statusCode: 400,
                code: "VALIDATION_ERROR",
                message: "Invalid request body",
                details: {
                    formErrors: [],
                    fieldErrors: {
                        name: ["A movement with this name already exists for this user."],
                    },
                },
            };
        }
        throw err;
    }
};

export const updateMovement = async (args: {
    userId: string;
    id: string;
    payload: {
        name?: string;
        muscleGroup?: string | null;
        equipment?: string | null;
        isActive?: boolean;
    };
}) => {
    const { userId, id, payload } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const doc = await MovementModel.findOne({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    if (!doc) return null;

    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.muscleGroup !== undefined) doc.muscleGroup = payload.muscleGroup;
    if (payload.equipment !== undefined) doc.equipment = payload.equipment;
    if (payload.isActive !== undefined) doc.isActive = payload.isActive;

    try {
        await doc.save();
        return doc.toJSON();
    } catch (err: any) {
        if (err?.code === 11000) {
            throw {
                statusCode: 400,
                code: "VALIDATION_ERROR",
                message: "Invalid request body",
                details: {
                    formErrors: [],
                    fieldErrors: {
                        name: ["A movement with this name already exists for this user."],
                    },
                },
            };
        }
        throw err;
    }
};

export const deleteMovement = async (args: { userId: string; id: string }) => {
    const { userId, id } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const doc = await MovementModel.findOneAndDelete({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    return doc ? doc.toJSON() : null;
};

export const assertMovementsExist = async (args: {
    userId: string;
    movementIds: string[];
}) => {
    const { userId, movementIds } = args;

    const unique = Array.from(
        new Set(
            (movementIds ?? [])
                .filter(Boolean)
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    );

    if (unique.length === 0) return;

    const found = await MovementModel.find({
        _id: { $in: unique.map((x) => toObjectId(x)) },
        userId: toObjectId(userId),
    }).select({ _id: 1 });

    const foundSet = new Set(found.map((d) => String(d._id)));
    const missing = unique.filter((id) => !foundSet.has(id));

    if (missing.length > 0) {
        throw {
            statusCode: 400,
            code: "VALIDATION_ERROR",
            message: "Invalid request body",
            details: {
                formErrors: [],
                fieldErrors: {
                    training: missing.map((m) => `Invalid movementId (not found for this user): ${m}`),
                },
            },
        };
    }
};