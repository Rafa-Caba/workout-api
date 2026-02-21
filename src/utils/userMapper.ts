import type { CoachMode, PublicUser } from "../types/auth.types";

// Minimal shape we need from the Mongoose doc JSON
type UserJSON = {
    id: string;
    name: string;
    email: string;
    sex?: PublicUser["sex"];
    role: PublicUser["role"];

    profilePicUrl?: string | null;

    heightCm?: number | null;
    currentWeightKg?: number | null;
    units?: PublicUser["units"];

    birthDate?: string | null;
    activityGoal?: PublicUser["activityGoal"];
    timezone?: string | null;

    coachMode: CoachMode;
    assignedTrainer: string | null;

    createdAt?: Date | string;
    updatedAt?: Date | string;
};

const toIsoString = (value: Date | string | undefined): string => {
    if (!value) return new Date().toISOString();
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

export const toPublicUser = (u: UserJSON): PublicUser => {
    return {
        id: u.id,
        name: u.name,
        email: u.email,

        sex: u.sex ?? null,
        role: u.role,

        profilePicUrl: u.profilePicUrl ?? null,

        heightCm: u.heightCm ?? null,
        currentWeightKg: u.currentWeightKg ?? null,
        units: u.units ?? null,

        birthDate: u.birthDate ?? null,
        activityGoal: u.activityGoal ?? null,
        timezone: u.timezone ?? null,

        coachMode: u.coachMode ?? null,
        assignedTrainer: u.assignedTrainer ?? null,

        createdAt: toIsoString(u.createdAt),
        updatedAt: toIsoString(u.updatedAt),
    };
};
