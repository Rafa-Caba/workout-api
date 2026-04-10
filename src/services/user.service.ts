// src/services/user.service.ts
import { UserModel } from "../models/User.model";
import type { PublicUser } from "../types/auth.types";
import { toPublicUser } from "../utils/userMapper";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";
import { recordUserWeightMetricFromProfile } from "./userMetric.service";

export type UpdateMePayload = {
    name?: string;
    sex?: "male" | "female" | "other" | null;

    heightCm?: number | null;
    currentWeightKg?: number | null;

    units?: { weight: "kg" | "lb"; distance: "km" | "mi" } | null;

    birthDate?: string | null; // YYYY-MM-DD
    activityGoal?:
    | "fat_loss"
    | "hypertrophy"
    | "strength"
    | "maintenance"
    | "other"
    | null;
    timezone?: string | null;

    trainingLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
    healthNotes?: string | null;
};

const getTodayIsoDate = (): string => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const getUserById = async (userId: string): Promise<PublicUser> => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw {
            status: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }

    return toPublicUser(user.toJSON());
};

export const updateMe = async (
    userId: string,
    payload: UpdateMePayload
): Promise<PublicUser> => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw {
            status: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }

    if (payload.name !== undefined) user.name = payload.name;
    if (payload.sex !== undefined) user.sex = payload.sex;

    if (payload.heightCm !== undefined) user.heightCm = payload.heightCm;
    if (payload.currentWeightKg !== undefined) {
        user.currentWeightKg = payload.currentWeightKg;
    }

    if (payload.units !== undefined) user.units = payload.units;

    if (payload.birthDate !== undefined) user.birthDate = payload.birthDate;
    if (payload.activityGoal !== undefined) user.activityGoal = payload.activityGoal;
    if (payload.timezone !== undefined) user.timezone = payload.timezone;

    if (payload.trainingLevel !== undefined) {
        user.trainingLevel = payload.trainingLevel;
    }

    if (payload.healthNotes !== undefined) {
        user.healthNotes = payload.healthNotes;
    }

    await user.save();

    if (
        payload.currentWeightKg !== undefined &&
        payload.currentWeightKg !== null
    ) {
        await recordUserWeightMetricFromProfile(userId, {
            date: getTodayIsoDate(),
            weightKg: payload.currentWeightKg,
        });
    }

    return toPublicUser(user.toJSON());
};

export const setMyProfilePic = async (
    userId: string,
    input: { url: string; publicId: string }
): Promise<PublicUser> => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw {
            status: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }

    const prevPublicId = user.profilePicPublicId;

    user.profilePicUrl = input.url;
    user.profilePicPublicId = input.publicId;

    await user.save();

    if (prevPublicId && prevPublicId !== input.publicId) {
        await deleteFromCloudinary(prevPublicId, { resourceType: "image" });
    }

    return toPublicUser(user.toJSON());
};

export const removeMyProfilePic = async (
    userId: string
): Promise<PublicUser> => {
    const user = await UserModel.findById(userId);

    if (!user) {
        throw {
            status: 404,
            code: "USER_NOT_FOUND",
            message: "User not found",
        };
    }

    const prevPublicId = user.profilePicPublicId;

    user.profilePicUrl = null;
    user.profilePicPublicId = null;

    await user.save();

    if (prevPublicId) {
        await deleteFromCloudinary(prevPublicId, { resourceType: "image" });
    }

    return toPublicUser(user.toJSON());
};