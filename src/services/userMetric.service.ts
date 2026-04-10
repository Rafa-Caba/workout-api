// src/services/userMetric.service.ts
import mongoose from "mongoose";
import { UserMetricModel } from "../models/UserMetric.model";
import { UserModel } from "../models/User.model";
import type {
    UpsertUserMetricRequest,
    UserMetricEntry,
    UserMetricLatestResponse,
    UserMetricListQuery,
    UserMetricListResponse,
    UserMetricSource,
} from "../types/userMetric.types";

type SerializedUserMetricCustomMetric = {
    key: string;
    label: string;
    value: number;
    unit: string;
};

type SerializedUserMetric = {
    id: string;
    userId: string;
    date: string;

    weightKg?: number | null;
    bodyFatPct?: number | null;
    waistCm?: number | null;

    customMetrics?: SerializedUserMetricCustomMetric[];

    notes?: string | null;

    source?: UserMetricSource;
    sourceDevice?: string | null;
    importedAt?: Date | string | null;
    createdFromProfile?: boolean;

    meta?: Record<string, unknown> | null;

    createdAt?: Date | string;
    updatedAt?: Date | string;
};

const toObjectId = (id: string): mongoose.Types.ObjectId =>
    new mongoose.Types.ObjectId(id);

const toIsoString = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const toNullableNumber = (value: unknown): number | null => {
    return typeof value === "number" ? value : null;
};

const toNullableString = (value: unknown): string | null => {
    return typeof value === "string" ? value : null;
};

const normalizeSource = (source: unknown): UserMetricSource => {
    if (
        source === "profile" ||
        source === "device" ||
        source === "import" ||
        source === "coach"
    ) {
        return source;
    }

    return "manual";
};

const parseCustomMetrics = (value: unknown): SerializedUserMetricCustomMetric[] => {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item: unknown) => {
        if (!isPlainRecord(item)) return [];

        const key = toNullableString(item.key);
        const label = toNullableString(item.label);
        const rawValue = item.value;
        const unit = toNullableString(item.unit);

        if (
            key === null ||
            label === null ||
            typeof rawValue !== "number" ||
            unit === null
        ) {
            return [];
        }

        return [
            {
                key,
                label,
                value: rawValue,
                unit,
            },
        ];
    });
};

const serializeUserMetricDoc = (value: unknown): SerializedUserMetric => {
    if (!isPlainRecord(value)) {
        throw new Error("Invalid serialized user metric document");
    }

    const id =
        toNullableString(value.id) ??
        (value._id instanceof mongoose.Types.ObjectId ? String(value._id) : null);

    const userIdRaw = value.userId;
    const userId =
        typeof userIdRaw === "string"
            ? userIdRaw
            : userIdRaw instanceof mongoose.Types.ObjectId
                ? String(userIdRaw)
                : null;

    const date = toNullableString(value.date);

    if (!id || !userId || !date) {
        throw new Error("Serialized user metric document is missing required fields");
    }

    const meta = isPlainRecord(value.meta) ? value.meta : null;

    return {
        id,
        userId,
        date,

        weightKg: toNullableNumber(value.weightKg),
        bodyFatPct: toNullableNumber(value.bodyFatPct),
        waistCm: toNullableNumber(value.waistCm),

        customMetrics: parseCustomMetrics(value.customMetrics),

        notes: toNullableString(value.notes),

        source: normalizeSource(value.source),
        sourceDevice: toNullableString(value.sourceDevice),
        importedAt:
            value.importedAt instanceof Date || typeof value.importedAt === "string"
                ? value.importedAt
                : null,
        createdFromProfile: Boolean(value.createdFromProfile),

        meta,

        createdAt:
            value.createdAt instanceof Date || typeof value.createdAt === "string"
                ? value.createdAt
                : undefined,
        updatedAt:
            value.updatedAt instanceof Date || typeof value.updatedAt === "string"
                ? value.updatedAt
                : undefined,
    };
};

const toUserMetricEntry = (json: SerializedUserMetric): UserMetricEntry => {
    return {
        id: json.id,
        userId: json.userId,
        date: json.date,

        weightKg: json.weightKg ?? null,
        bodyFatPct: json.bodyFatPct ?? null,
        waistCm: json.waistCm ?? null,

        customMetrics: json.customMetrics ?? [],

        notes: json.notes ?? null,

        source: normalizeSource(json.source),

        sourceDevice: json.sourceDevice ?? null,

        importedAt: toIsoString(json.importedAt),
        createdFromProfile: Boolean(json.createdFromProfile),

        meta: json.meta ?? null,

        createdAt: toIsoString(json.createdAt) ?? new Date().toISOString(),
        updatedAt: toIsoString(json.updatedAt) ?? new Date().toISOString(),
    };
};

const syncUserCurrentWeightFromLatestMetric = async (
    userId: string
): Promise<void> => {
    const latestMetricWithWeight = await UserMetricModel.findOne({
        userId: toObjectId(userId),
        weightKg: { $ne: null },
    }).sort({ date: -1, updatedAt: -1 });

    const user = await UserModel.findById(userId);

    if (!user) {
        throw {
            status: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }

    user.currentWeightKg =
        latestMetricWithWeight && typeof latestMetricWithWeight.weightKg === "number"
            ? latestMetricWithWeight.weightKg
            : null;

    await user.save();
};

export const listMyUserMetrics = async (
    userId: string,
    query: UserMetricListQuery
): Promise<UserMetricListResponse> => {
    const filter: Record<string, unknown> = {
        userId: toObjectId(userId),
    };

    if (query.from && query.to) {
        filter.date = {
            $gte: query.from,
            $lte: query.to,
        };
    }

    const docs = await UserMetricModel.find(filter).sort({ date: 1, createdAt: 1 });

    return {
        from: query.from ?? null,
        to: query.to ?? null,
        metrics: docs.map((doc) =>
            toUserMetricEntry(serializeUserMetricDoc(doc.toJSON()))
        ),
    };
};

export const getLatestUserMetric = async (
    userId: string
): Promise<UserMetricLatestResponse> => {
    const latest = await UserMetricModel.findOne({
        userId: toObjectId(userId),
    }).sort({ date: -1, updatedAt: -1 });

    return {
        latest: latest
            ? toUserMetricEntry(serializeUserMetricDoc(latest.toJSON()))
            : null,
    };
};

export const upsertMyUserMetricByDate = async (
    userId: string,
    date: string,
    payload: UpsertUserMetricRequest
): Promise<UserMetricEntry> => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw {
            status: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }

    const update: Record<string, unknown> = {};

    if (payload.weightKg !== undefined) update.weightKg = payload.weightKg;
    if (payload.bodyFatPct !== undefined) update.bodyFatPct = payload.bodyFatPct;
    if (payload.waistCm !== undefined) update.waistCm = payload.waistCm;
    if (payload.customMetrics !== undefined) update.customMetrics = payload.customMetrics;
    if (payload.notes !== undefined) update.notes = payload.notes;
    if (payload.source !== undefined) update.source = payload.source;
    if (payload.sourceDevice !== undefined) update.sourceDevice = payload.sourceDevice;
    if (payload.importedAt !== undefined) {
        update.importedAt = payload.importedAt ? new Date(payload.importedAt) : null;
    }
    if (payload.meta !== undefined) update.meta = payload.meta;

    const setOnInsert: Record<string, unknown> = {
        userId: toObjectId(userId),
        date,
        createdFromProfile: false,
    };

    if (payload.source === undefined) {
        setOnInsert.source = "manual";
    }

    const doc = await UserMetricModel.findOneAndUpdate(
        {
            userId: toObjectId(userId),
            date,
        },
        {
            $set: update,
            $setOnInsert: setOnInsert,
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
        }
    );

    if (!doc) {
        throw {
            status: 500,
            code: "USER_METRIC_UPSERT_FAILED",
            message: "Failed to save user metric",
        };
    }

    if (payload.weightKg !== undefined) {
        await syncUserCurrentWeightFromLatestMetric(userId);
    }

    return toUserMetricEntry(serializeUserMetricDoc(doc.toJSON()));
};

export const deleteMyUserMetricByDate = async (
    userId: string,
    date: string
): Promise<{ ok: true }> => {
    await UserMetricModel.findOneAndDelete({
        userId: toObjectId(userId),
        date,
    });

    await syncUserCurrentWeightFromLatestMetric(userId);

    return { ok: true };
};

export const recordUserWeightMetricFromProfile = async (
    userId: string,
    input: {
        date: string;
        weightKg: number;
    }
): Promise<void> => {
    await UserMetricModel.findOneAndUpdate(
        {
            userId: toObjectId(userId),
            date: input.date,
        },
        {
            $set: {
                weightKg: input.weightKg,
                createdFromProfile: true,
            },
            $setOnInsert: {
                userId: toObjectId(userId),
                date: input.date,
                source: "profile",
                customMetrics: [],
            },
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
        }
    );
};