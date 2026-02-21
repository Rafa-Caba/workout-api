import type { Sex, Units, UserRole, CoachMode } from "./auth.types";
import type { ISODate } from "./workoutDay.types";

export type ActivityGoal =
    | "fat_loss"
    | "hypertrophy"
    | "strength"
    | "maintenance"
    | "other"
    | null;

export type UserProfileUpdateRequest = {
    name?: string;
    sex?: Sex;

    profilePicUrl?: string | null;

    heightCm?: number | null;
    currentWeightKg?: number | null;

    units?: Units | null;

    birthDate?: ISODate | null;
    activityGoal?: ActivityGoal;
    timezone?: string | null;

    /**
     * Coaching (may be controlled by dedicated endpoints later)
     */
    coachMode?: CoachMode;
    assignedTrainer?: string | null; // User id
};

export type AdminUserUpdateRequest = UserProfileUpdateRequest & {
    email?: string;
    role?: UserRole;
};

// =======================
// User Metrics
// =======================

export type UserMetricEntry = {
    id: string;
    userId: string;
    date: ISODate;

    weightKg: number | null;
    bodyFatPct: number | null;
    waistCm: number | null;

    customType: string | null;
    customValue: number | null;
    customUnit: string | null;

    notes: string | null;
    meta: Record<string, unknown> | null;

    createdAt?: string;
    updatedAt?: string;
};

export type AddUserMetricRequest = {
    date: ISODate;

    weightKg?: number | null;
    bodyFatPct?: number | null;
    waistCm?: number | null;

    customType?: string | null;
    customValue?: number | null;
    customUnit?: string | null;

    notes?: string | null;
    meta?: Record<string, unknown> | null;
};

export type GetUserMetricsResponse = {
    from: ISODate;
    to: ISODate;
    metrics: UserMetricEntry[];
};