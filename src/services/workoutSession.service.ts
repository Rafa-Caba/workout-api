import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";

type ReturnMode = "day" | "session";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const findSessionIndex = (dayDoc: any, sessionId: string): number => {
    const sessions: any[] | null = dayDoc?.training?.sessions ?? null;
    if (!sessions || !Array.isArray(sessions)) return -1;

    return sessions.findIndex(
        (s: any) => String(s?._id) === sessionId || String(s?.id) === sessionId
    );
};

const sessionToJson = (dayJson: any, sessionId: string) => {
    const sessions: any[] | null = dayJson?.training?.sessions ?? null;
    if (!sessions || !Array.isArray(sessions)) return null;
    return sessions.find((s: any) => String(s?.id) === sessionId) ?? null;
};

export const createTrainingSession = async (
    userId: string,
    date: string,
    payload: any,
    returnMode: ReturnMode
) => {
    const userObjectId = toObjectId(userId);

    const dayDoc = await WorkoutDayModel.findOne({ userId: userObjectId, date });
    if (!dayDoc) {
        return { error: { code: "NOT_FOUND", message: "Workout day not found", details: { date } } };
    }

    // Ensure training block exists
    if (!dayDoc.training) {
        dayDoc.training = { sessions: null, source: null, dayEffortRpe: null, raw: null } as any;
    }

    if (!Array.isArray((dayDoc as any).training.sessions)) {
        (dayDoc as any).training.sessions = [];
    }

    (dayDoc as any).training.sessions.push({
        ...payload,
        media: null, // keep your “no block” semantics
    });

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    const createdSessionId = String(
        (saved as any).training?.sessions?.[(saved as any).training.sessions.length - 1]?._id
    );

    if (returnMode === "session") {
        return { session: sessionToJson(outDay, createdSessionId) };
    }

    return outDay;
};

export const patchTrainingSession = async (
    userId: string,
    date: string,
    sessionId: string,
    payload: any,
    returnMode: ReturnMode
) => {
    const userObjectId = toObjectId(userId);

    const dayDoc = await WorkoutDayModel.findOne({ userId: userObjectId, date });
    if (!dayDoc) {
        return { error: { code: "NOT_FOUND", message: "Workout day not found", details: { date } } };
    }

    const idx = findSessionIndex(dayDoc as any, sessionId);
    if (idx < 0) {
        return { error: { code: "NOT_FOUND", message: "Training session not found", details: { sessionId } } };
    }

    const session = (dayDoc as any).training.sessions[idx];

    // Prevent media edits here (must use /media endpoints)
    if (Object.prototype.hasOwnProperty.call(payload, "media")) {
        delete payload.media;
    }

    for (const [k, v] of Object.entries(payload)) {
        (session as any)[k] = v;
    }

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    if (returnMode === "session") {
        return { session: sessionToJson(outDay, sessionId) };
    }

    return outDay;
};

export const deleteTrainingSession = async (
    userId: string,
    date: string,
    sessionId: string,
    returnMode: ReturnMode,
    deleteMedia: boolean
) => {
    const userObjectId = toObjectId(userId);

    const dayDoc = await WorkoutDayModel.findOne({ userId: userObjectId, date });
    if (!dayDoc) {
        return { error: { code: "NOT_FOUND", message: "Workout day not found", details: { date } } };
    }

    const idx = findSessionIndex(dayDoc as any, sessionId);
    if (idx < 0) {
        return { error: { code: "NOT_FOUND", message: "Training session not found", details: { sessionId } } };
    }

    const session = (dayDoc as any).training.sessions[idx];
    const mediaArr: any[] = Array.isArray(session?.media) ? session.media : [];

    // Remove from DB first
    (dayDoc as any).training.sessions.splice(idx, 1);

    const saved = await dayDoc.save();
    const outDay = saved.toJSON();

    // Default: preserve media (for Media tab)
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

    // Explicit deletion requested
    const cloudinaryResults: Array<{ publicId: string; deleted: boolean; error: string | null }> = [];

    for (const m of mediaArr) {
        const publicId = m?.publicId ? String(m.publicId) : null;
        if (!publicId) continue;

        const rt: "image" | "video" = m?.resourceType === "video" ? "video" : "image";

        try {
            await deleteFromCloudinary(publicId, { resourceType: rt });
            cloudinaryResults.push({ publicId, deleted: true, error: null });
        } catch (err: any) {
            cloudinaryResults.push({ publicId, deleted: false, error: String(err?.message ?? err) });
        }
    }

    if (returnMode === "session") {
        return { deleted: true, sessionId, mediaPreserved: false, cloudinary: cloudinaryResults };
    }

    return { ...outDay, mediaPreserved: false, cloudinary: cloudinaryResults };
};
