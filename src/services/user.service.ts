import { UserModel } from "../models/User.model";
import type { PublicUser } from "../types/auth.types";
import { toPublicUser } from "../utils/userMapper";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";

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

    /**
     * Baseline training profile (user-owned)
     */
    trainingLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
    healthNotes?: string | null;
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

    const json = user.toJSON();
    return toPublicUser(json);
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

    // Only update fields provided (undefined means "leave as is")
    if (payload.name !== undefined) user.name = payload.name;
    if (payload.sex !== undefined) user.sex = payload.sex as any;

    if (payload.heightCm !== undefined) user.heightCm = payload.heightCm;
    if (payload.currentWeightKg !== undefined)
        user.currentWeightKg = payload.currentWeightKg;

    if (payload.units !== undefined) user.units = payload.units as any;

    if (payload.birthDate !== undefined) user.birthDate = payload.birthDate;
    if (payload.activityGoal !== undefined)
        user.activityGoal = payload.activityGoal as any;
    if (payload.timezone !== undefined) user.timezone = payload.timezone;

    // New fields
    if (payload.trainingLevel !== undefined)
        (user as any).trainingLevel = payload.trainingLevel;
    if (payload.healthNotes !== undefined)
        (user as any).healthNotes = payload.healthNotes;

    await user.save();

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

    // Best-effort delete old image (avoid leaking storage)
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