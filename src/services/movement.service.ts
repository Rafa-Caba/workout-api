// /src/services/movement.service.ts

import mongoose from "mongoose";
import type { Express } from "express";

import { MovementModel } from "../models/Movement.model";
import type {
    CreateMovementBody,
    Movement,
    MovementMedia,
    UpdateMovementBody,
} from "../types/movement.types";
import { extractCloudinaryInfo } from "../utils/cloudinaryInfo";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SORT_COLLATION = { locale: "en", strength: 2 } as const;

type ValidationFieldErrors = Record<string, string[]>;

type ValidationServiceError = {
    statusCode: number;
    code: "VALIDATION_ERROR";
    message: string;
    details: {
        formErrors: string[];
        fieldErrors: ValidationFieldErrors;
    };
};

function createValidationError(fieldErrors: ValidationFieldErrors): ValidationServiceError {
    return {
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: {
            formErrors: [],
            fieldErrors,
        },
    };
}

/**
 * Normalizes a raw unknown input into a clean unique string array.
 */
function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalizedValues = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return Array.from(new Set(normalizedValues));
}

/**
 * Converts an uploaded Cloudinary file into the public Movement.media shape.
 */
function buildMovementMediaFromFile(
    file: Express.Multer.File | null | undefined
): MovementMedia | null {
    if (!file) {
        return null;
    }

    const info = extractCloudinaryInfo(file);
    if (!info) {
        return null;
    }

    return {
        publicId: info.publicId,
        url: info.url,
        resourceType: info.resourceType,
        format: info.format ?? null,
        createdAt: info.createdAt,
        originalName: info.originalName ?? null,
        meta: null,
    };
}

/**
 * Normalizes any model/json output into the exact public Movement contract.
 * This avoids unsafe direct casts from Mongoose shapes to API types.
 */
function toMovement(dto: unknown): Movement {
    const raw = dto as {
        id?: unknown;
        _id?: unknown;
        userId?: unknown;
        name?: unknown;
        nameLower?: unknown;
        muscleGroup?: unknown;
        equipment?: unknown;
        isActive?: unknown;
        media?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
    };

    const rawMedia = raw.media as
        | {
            publicId?: unknown;
            url?: unknown;
            resourceType?: unknown;
            format?: unknown;
            createdAt?: unknown;
            originalName?: unknown;
            meta?: unknown;
        }
        | null
        | undefined;

    const media: MovementMedia | null =
        rawMedia && typeof rawMedia === "object"
            ? {
                publicId: String(rawMedia.publicId ?? ""),
                url: String(rawMedia.url ?? ""),
                resourceType:
                    rawMedia.resourceType === "video" ? "video" : "image",
                format:
                    typeof rawMedia.format === "string" ? rawMedia.format : null,
                createdAt: String(rawMedia.createdAt ?? ""),
                originalName:
                    typeof rawMedia.originalName === "string"
                        ? rawMedia.originalName
                        : null,
                meta:
                    rawMedia.meta !== undefined &&
                        rawMedia.meta !== null &&
                        typeof rawMedia.meta === "object"
                        ? (rawMedia.meta as Record<string, unknown>)
                        : null,
            }
            : null;

    return {
        id: String(raw.id ?? raw._id ?? ""),
        userId: String(raw.userId ?? ""),
        name: String(raw.name ?? ""),
        nameLower: String(raw.nameLower ?? ""),
        muscleGroup: normalizeStringArray(raw.muscleGroup),
        equipment: normalizeStringArray(raw.equipment),
        isActive: Boolean(raw.isActive),
        media,
        createdAt: String(raw.createdAt ?? ""),
        updatedAt: String(raw.updatedAt ?? ""),
    };
}

export const listMovements = async (args: {
    userId: string;
    activeOnly?: boolean;
    q?: string;
}): Promise<Movement[]> => {
    const { userId, activeOnly, q } = args;

    const filter: {
        userId: mongoose.Types.ObjectId;
        isActive?: boolean;
        $or?:
        | Array<
            | { name: RegExp }
            | { nameLower: RegExp }
            | { muscleGroup: RegExp }
            | { equipment: RegExp }
        >
        | undefined;
    } = {
        userId: toObjectId(userId),
    };

    if (activeOnly === true) {
        filter.isActive = true;
    }

    if (q && q.trim()) {
        const qTrim = q.trim();
        const rx = new RegExp(escapeRegExp(qTrim), "i");

        filter.$or = [{ name: rx }, { nameLower: rx }, { muscleGroup: rx }, { equipment: rx }];
    }

    const docs = await MovementModel.find(filter)
        .collation(SORT_COLLATION)
        .sort({ nameLower: 1 });

    return docs.map((doc) => toMovement(doc.toJSON()));
};

export const getMovementById = async (args: {
    userId: string;
    id: string;
}): Promise<Movement | null> => {
    const { userId, id } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const doc = await MovementModel.findOne({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    return doc ? toMovement(doc.toJSON()) : null;
};

export const createMovement = async (args: {
    userId: string;
    payload: CreateMovementBody;
    mediaFile?: Express.Multer.File | null;
}): Promise<Movement> => {
    const { userId, payload, mediaFile } = args;

    const media = buildMovementMediaFromFile(mediaFile);

    try {
        const doc = await MovementModel.create({
            userId: toObjectId(userId),
            name: payload.name,
            muscleGroup: normalizeStringArray(payload.muscleGroup),
            equipment: normalizeStringArray(payload.equipment),
            isActive: payload.isActive ?? true,
            media,
        });

        return toMovement(doc.toJSON());
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {
            const keyPattern =
                "keyPattern" in error &&
                    typeof error.keyPattern === "object" &&
                    error.keyPattern !== null
                    ? error.keyPattern
                    : null;

            const isNameDuplicate =
                keyPattern !== null &&
                ("nameLower" in keyPattern || "name" in keyPattern);

            throw createValidationError(
                isNameDuplicate
                    ? {
                        name: ["A movement with this name already exists for this user."],
                    }
                    : {
                        general: ["Duplicate key error on movements collection."],
                    }
            );
        }

        throw error;
    }
};

export const updateMovement = async (args: {
    userId: string;
    id: string;
    payload: UpdateMovementBody;
    mediaFile?: Express.Multer.File | null;
}): Promise<Movement | null> => {
    const { userId, id, payload, mediaFile } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const doc = await MovementModel.findOne({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    if (!doc) {
        return null;
    }

    if (payload.name !== undefined) {
        doc.name = payload.name;
    }

    if (payload.muscleGroup !== undefined) {
        doc.muscleGroup = normalizeStringArray(payload.muscleGroup);
    }

    if (payload.equipment !== undefined) {
        doc.equipment = normalizeStringArray(payload.equipment);
    }

    if (payload.isActive !== undefined) {
        doc.isActive = payload.isActive;
    }

    const mediaFromFile = buildMovementMediaFromFile(mediaFile);
    if (mediaFromFile) {
        doc.media = mediaFromFile;
    }

    try {
        await doc.save();
        return toMovement(doc.toJSON());
    } catch (error: unknown) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {
            throw createValidationError({
                name: ["A movement with this name already exists for this user."],
            });
        }

        throw error;
    }
};

export const deleteMovement = async (args: {
    userId: string;
    id: string;
}): Promise<Movement | null> => {
    const { userId, id } = args;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
    }

    const doc = await MovementModel.findOneAndDelete({
        _id: toObjectId(id),
        userId: toObjectId(userId),
    });

    return doc ? toMovement(doc.toJSON()) : null;
};

export const assertMovementsExist = async (args: {
    userId: string;
    movementIds: string[];
}): Promise<void> => {
    const { userId, movementIds } = args;

    const unique = Array.from(
        new Set(
            movementIds
                .filter((id) => Boolean(id))
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    );

    if (unique.length === 0) {
        return;
    }

    const found = await MovementModel.find({
        _id: { $in: unique.map((value) => toObjectId(value)) },
        userId: toObjectId(userId),
    }).select({ _id: 1 });

    const foundSet = new Set(found.map((doc) => String(doc._id)));
    const missing = unique.filter((movementId) => !foundSet.has(movementId));

    if (missing.length > 0) {
        throw createValidationError({
            movementId: missing.map(
                (movementId) => `Invalid movementId (not found for this user): ${movementId}`
            ),
        });
    }
};