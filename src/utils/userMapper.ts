import type { PublicUser, TrainingLevel } from "../types/auth.types";

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

    /**
     * Baseline training profile (user-owned)
     */
    trainingLevel?: TrainingLevel;
    healthNotes?: string | null;

    lastLoginAt?: Date | string | null;

    // Trainer/Trainee
    coachMode?: PublicUser["coachMode"];
    assignedTrainer?: unknown; // ObjectId | string | null | undefined

    createdAt?: Date | string;
    updatedAt?: Date | string;
};

const toIsoStringOrNull = (value: Date | string | null | undefined): string | null => {
    if (value == null) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const toIsoString = (value: Date | string | undefined): string => {
    if (!value) return new Date().toISOString();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

function toIdStringOrNull(v: unknown): string | null {
    if (v == null) return null;

    if (typeof v === "string") {
        const s = v.trim();
        return s.length ? s : null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyV: any = v as any;
    if (typeof anyV?.toString === "function") {
        const s = String(anyV.toString()).trim();
        return s.length ? s : null;
    }

    return null;
}

const normalizeTrainingLevel = (v: unknown): TrainingLevel => {
    if (v === "BEGINNER" || v === "INTERMEDIATE" || v === "ADVANCED") return v;
    return null;
};

export const toPublicUser = (u: UserJSON): PublicUser => {
    const coachMode: PublicUser["coachMode"] = u.coachMode ?? "NONE";
    const assignedTrainer = toIdStringOrNull(u.assignedTrainer);

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

        trainingLevel: normalizeTrainingLevel(u.trainingLevel),
        healthNotes: u.healthNotes ?? null,

        lastLoginAt: toIsoStringOrNull(u.lastLoginAt),

        coachMode,
        assignedTrainer: coachMode === "TRAINEE" ? assignedTrainer : null,

        createdAt: toIsoString(u.createdAt),
        updatedAt: toIsoString(u.updatedAt),
    };
};