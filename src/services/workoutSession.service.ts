// src/services/workoutSession.service.ts

import mongoose from "mongoose";
import type { HydratedDocument } from "mongoose";
import { WorkoutDayModel, type WorkoutDayDocument } from "../models/WorkoutDay.model";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";
import type {
    CreateTrainingSessionInput,
    MediaItem,
    PatchTrainingSessionInput,
    TrainingSession,
    WorkoutDayDoc,
} from "../types/workoutDay.types";

type ReturnMode = "day" | "session";

export type SessionError = {
    error: {
        code: "NOT_FOUND";
        message: string;
        details: {
            date?: string;
            sessionId?: string;
        };
    };
};

type CloudinaryDeleteResult = {
    publicId: string;
    deleted: boolean;
    error: string | null;
};

type DeleteSessionModeResponse = {
    deleted: true;
    sessionId: string;
    mediaPreserved: boolean;
    cloudinary: CloudinaryDeleteResult[] | null;
};

export type UpsertTrainingSessionResult =
    | WorkoutDayDoc
    | { session: TrainingSession | null }
    | SessionError;

export type DeleteTrainingSessionResult =
    | (WorkoutDayDoc & {
        mediaPreserved: boolean;
        cloudinary?: CloudinaryDeleteResult[];
    })
    | DeleteSessionModeResponse
    | SessionError;

type WorkoutDayHydrated = HydratedDocument<WorkoutDayDocument>;

type WorkoutDayJsonRaw = Omit<WorkoutDayDoc, "userId" | "createdAt" | "updatedAt"> & {
    userId: string | mongoose.Types.ObjectId;
    createdAt: string | Date;
    updatedAt: string | Date;
};

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const toIsoString = (value: string | Date): string => {
    return value instanceof Date ? value.toISOString() : value;
};

const toWorkoutDayJson = (dayDoc: WorkoutDayHydrated): WorkoutDayDoc => {
    const raw = dayDoc.toJSON() as unknown as WorkoutDayJsonRaw;

    return {
        ...raw,
        userId: String(raw.userId),
        createdAt: toIsoString(raw.createdAt),
        updatedAt: toIsoString(raw.updatedAt),
    };
};

const getSessions = (dayDoc: WorkoutDayHydrated) => {
    const sessions = dayDoc.training?.sessions;
    return Array.isArray(sessions) ? sessions : null;
};

const findSessionIndex = (dayDoc: WorkoutDayHydrated, sessionId: string): number => {
    const sessions = getSessions(dayDoc);
    if (!sessions) return -1;

    return sessions.findIndex((session) => String(session._id) === sessionId);
};

const sessionToJson = (dayJson: WorkoutDayDoc, sessionId: string): TrainingSession | null => {
    const sessions = dayJson.training?.sessions;
    if (!sessions || !Array.isArray(sessions)) return null;

    return sessions.find((session) => session.id === sessionId) ?? null;
};

const buildDayNotFoundError = (date: string): SessionError => ({
    error: {
        code: "NOT_FOUND",
        message: "Workout day not found",
        details: { date },
    },
});

const buildSessionNotFoundError = (sessionId: string): SessionError => ({
    error: {
        code: "NOT_FOUND",
        message: "Training session not found",
        details: { sessionId },
    },
});

const ensureTrainingBlock = (dayDoc: WorkoutDayHydrated): void => {
    if (!dayDoc.training) {
        dayDoc.set("training", {
            sessions: [],
            source: null,
            dayEffortRpe: null,
            raw: null,
        });
        return;
    }

    if (!Array.isArray(dayDoc.training.sessions)) {
        dayDoc.set("training.sessions", []);
    }
};

/**
 * Create payload should always be canonical so old gym/manual sessions
 * do not depend on undefined values for the new outdoor fields.
 */
const withCreateSessionDefaults = (
    payload: CreateTrainingSessionInput
): CreateTrainingSessionInput => {
    return {
        ...payload,
        activityType: payload.activityType ?? null,
        hasRoute: payload.hasRoute ?? false,
        outdoorMetrics: payload.outdoorMetrics ?? null,
        routeSummary: payload.routeSummary ?? null,
    };
};

export const createTrainingSession = async (
    userId: string,
    date: string,
    payload: CreateTrainingSessionInput,
    returnMode: ReturnMode
): Promise<UpsertTrainingSessionResult> => {
    const userObjectId = toObjectId(userId);

    const dayDoc = await WorkoutDayModel.findOne({
        userId: userObjectId,
        date,
    });

    if (!dayDoc) {
        return buildDayNotFoundError(date);
    }

    ensureTrainingBlock(dayDoc);

    const sessionPayload = withCreateSessionDefaults(payload);

    dayDoc.training?.sessions?.push({
        ...sessionPayload,
        media: null,
    });

    const saved = await dayDoc.save();

    const outDay = toWorkoutDayJson(saved);

    console.log({ outDay });
    console.log({ outDay: outDay.training?.sessions });

    const savedSessions = getSessions(saved);
    const createdSessionId =
        savedSessions && savedSessions.length > 0
            ? String(savedSessions[savedSessions.length - 1]._id)
            : "";

    if (returnMode === "session") {
        return {
            session: sessionToJson(outDay, createdSessionId),
        };
    }

    return outDay;
};

export const patchTrainingSession = async (
    userId: string,
    date: string,
    sessionId: string,
    payload: PatchTrainingSessionInput,
    returnMode: ReturnMode
): Promise<UpsertTrainingSessionResult> => {
    const userObjectId = toObjectId(userId);

    const dayDoc = await WorkoutDayModel.findOne({
        userId: userObjectId,
        date,
    });

    if (!dayDoc) {
        return buildDayNotFoundError(date);
    }

    const idx = findSessionIndex(dayDoc, sessionId);
    if (idx < 0) {
        return buildSessionNotFoundError(sessionId);
    }

    const sessions = getSessions(dayDoc);
    const session = sessions?.[idx] ?? null;

    if (!session) {
        return buildSessionNotFoundError(sessionId);
    }

    for (const [key, value] of Object.entries(payload) as Array<
        [keyof PatchTrainingSessionInput, PatchTrainingSessionInput[keyof PatchTrainingSessionInput]]
    >) {
        if (value !== undefined) {
            session.set(String(key), value);
        }
    }

    const saved = await dayDoc.save();
    const outDay = toWorkoutDayJson(saved);

    if (returnMode === "session") {
        return {
            session: sessionToJson(outDay, sessionId),
        };
    }

    return outDay;
};

export const deleteTrainingSession = async (
    userId: string,
    date: string,
    sessionId: string,
    returnMode: ReturnMode,
    deleteMedia: boolean
): Promise<DeleteTrainingSessionResult> => {
    const userObjectId = toObjectId(userId);

    const dayDoc = await WorkoutDayModel.findOne({
        userId: userObjectId,
        date,
    });

    if (!dayDoc) {
        return buildDayNotFoundError(date);
    }

    const idx = findSessionIndex(dayDoc, sessionId);
    if (idx < 0) {
        return buildSessionNotFoundError(sessionId);
    }

    const sessions = getSessions(dayDoc);
    const session = sessions?.[idx] ?? null;

    if (!session) {
        return buildSessionNotFoundError(sessionId);
    }

    const mediaArr: MediaItem[] = Array.isArray(session.media)
        ? session.media.map((media) => ({
            publicId: media.publicId,
            url: media.url,
            resourceType: media.resourceType,
            format: media.format ?? null,
            createdAt: media.createdAt,
            meta: media.meta ?? null,
        }))
        : [];

    sessions?.splice(idx, 1);

    const saved = await dayDoc.save();
    const outDay = toWorkoutDayJson(saved);

    if (!deleteMedia) {
        if (returnMode === "session") {
            return {
                deleted: true,
                sessionId,
                mediaPreserved: true,
                cloudinary: null,
            };
        }

        return {
            ...outDay,
            mediaPreserved: true,
        };
    }

    const cloudinaryResults: CloudinaryDeleteResult[] = [];

    for (const media of mediaArr) {
        const resourceType: "image" | "video" =
            media.resourceType === "video" ? "video" : "image";

        try {
            await deleteFromCloudinary(media.publicId, { resourceType });
            cloudinaryResults.push({
                publicId: media.publicId,
                deleted: true,
                error: null,
            });
        } catch (error) {
            cloudinaryResults.push({
                publicId: media.publicId,
                deleted: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    if (returnMode === "session") {
        return {
            deleted: true,
            sessionId,
            mediaPreserved: false,
            cloudinary: cloudinaryResults,
        };
    }

    return {
        ...outDay,
        mediaPreserved: false,
        cloudinary: cloudinaryResults,
    };
};