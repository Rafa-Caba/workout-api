import mongoose from "mongoose";
import type { Express } from "express";
import { MovementModel } from "../models/Movement.model";

import { extractCloudinaryInfo } from "../utils/cloudinaryInfo";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORT_COLLATION = { locale: "en", strength: 2 }; // strength:2 => case-insensitive (A=a)

// Helper para convertir el file de Cloudinary en Movement.media
function buildMovementMediaFromFile(file: Express.Multer.File | null | undefined) {
    if (!file) return null;

    const info = extractCloudinaryInfo(file);
    if (!info) return null;

    return {
        publicId: info.publicId,
        url: info.url,
        resourceType: info.resourceType, // "image" | "video"
        format: info.format ?? null,
        createdAt: info.createdAt,
        originalName: info.originalName ?? null,
        meta: null,
    } as any; // el tipo exacto lo define el schema del modelo
}

export const listMovements = async (args: {
    userId: string;
    activeOnly?: boolean;
    q?: string;
}) => {
    const { userId, activeOnly, q } = args;

    const filter: any = { userId: toObjectId(userId) };
    if (activeOnly === true) filter.isActive = true;

    if (q && q.trim()) {
        const qTrim = q.trim();
        const rx = new RegExp(escapeRegExp(qTrim), "i");
        filter.$or = [
            { name: rx },
            { nameLower: rx },
            { muscleGroup: rx },
            { equipment: rx },
        ];
    }

    const docs = await MovementModel.find(filter)
        .collation(SORT_COLLATION)
        .sort({ nameLower: 1 });

    return docs.map((d) => d.toJSON());
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
        // NO esperamos media aquí desde body; viene como file
        media?: any;
    };
    mediaFile?: Express.Multer.File | null;
}) => {
    const { userId, payload, mediaFile } = args;

    const mediaFromFile = buildMovementMediaFromFile(mediaFile);
    const media = mediaFromFile ?? payload.media ?? null;

    try {
        const doc = await MovementModel.create({
            userId: toObjectId(userId),
            name: payload.name,
            muscleGroup: payload.muscleGroup ?? null,
            equipment: payload.equipment ?? null,
            isActive: payload.isActive ?? true,
            media,
        });

        return doc.toJSON();
    } catch (err: any) {
        if (err?.code === 11000) {
            const keyPattern = err.keyPattern || {};
            const isNameDup = !!keyPattern.nameLower || !!keyPattern.name;

            throw {
                statusCode: 400,
                code: "VALIDATION_ERROR",
                message: "Invalid request body",
                details: {
                    formErrors: [],
                    fieldErrors: isNameDup
                        ? {
                            name: [
                                "A movement with this name already exists for this user.",
                            ],
                        }
                        : {
                            general: ["Duplicate key error on movements collection."],
                        },
                },
            };
        }
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
        media?: any | null; // permite borrar media con null si lo decides
    };
    mediaFile?: Express.Multer.File | null;
}) => {
    const { userId, id, payload, mediaFile } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const doc = await MovementModel.findOne({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    if (!doc) return null;

    // Campos básicos
    if (payload.name !== undefined) doc.name = payload.name;
    if (payload.muscleGroup !== undefined) doc.muscleGroup = payload.muscleGroup;
    if (payload.equipment !== undefined) doc.equipment = payload.equipment;
    if (payload.isActive !== undefined) doc.isActive = payload.isActive;

    // Media:
    // 1) Si viene file, generamos nuevo media.
    // 2) Si NO hay file pero payload.media está definido, respetamos ese valor
    //    (por ejemplo, podrías usarlo para borrar media con null en el futuro).
    // 3) Si ni file ni payload.media definido -> dejamos doc.media como está.
    const mediaFromFile = buildMovementMediaFromFile(mediaFile);

    if (mediaFromFile) {
        (doc as any).media = mediaFromFile;
    } else if (payload.media !== undefined) {
        (doc as any).media = payload.media;
    }

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
                    movementId: missing.map(
                        (m) => `Invalid movementId (not found for this user): ${m}`
                    ),
                },
            },
        };
    }
};
