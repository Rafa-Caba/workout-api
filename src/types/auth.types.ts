export type Units = {
    weight: "kg" | "lb";
    distance: "km" | "mi";
};

export type UserRole = "admin" | "user";
export type Sex = "male" | "female" | "other" | null;

/**
 * Coaching
 */
export type CoachMode = "NONE" | "TRAINER" | "TRAINEE";

export type PublicUser = {
    id: string;
    name: string;
    email: string;
    sex: Sex;
    role: UserRole;

    profilePicUrl: string | null;

    heightCm: number | null;
    currentWeightKg: number | null;

    units: Units | null;

    birthDate: string | null; // YYYY-MM-DD
    activityGoal:
    | "fat_loss"
    | "hypertrophy"
    | "strength"
    | "maintenance"
    | "other"
    | null;
    timezone: string | null;

    coachMode: CoachMode;
    assignedTrainer: string | null; // User id (ObjectId as string)

    createdAt: string;
    updatedAt: string;
};

export type AuthTokens = {
    accessToken: string;
    refreshToken: string;
};

export type RegisterRequest = {
    name: string;
    email: string;
    password: string;
    sex?: Sex;
};

export type LoginRequest = {
    email: string;
    password: string;
};

export type AuthResponse = {
    user: PublicUser;
    tokens: AuthTokens;
};