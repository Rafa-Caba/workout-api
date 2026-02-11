export type InsightMetric =
    | "activeKcal"
    | "durationSeconds"
    | "avgHr"
    | "maxHr"
    | "distanceKm"
    | "steps"
    | "paceSecPerKm";

export type PrRecord = {
    metric: InsightMetric;
    mode: "max" | "min";
    value: number;
    date: string; // YYYY-MM-DD
    weekKey: string; // YYYY-W##
    sessionId: string;
    sessionType: string;
};

export type PrsResponse = {
    range: { from: string; to: string };
    prs: PrRecord[];
};

export type RecoveryLevel = "green" | "yellow" | "red" | "unknown";

export type RecoveryPoint = {
    date: string;
    weekKey: string;

    sleepScore: number | null;
    deepMinutes: number | null;
    totalSleepMinutes: number | null;

    trainingLoad: number;

    recoveryScore: number | null;

    level: RecoveryLevel;
};

export type RecoveryResponse = {
    range: { from: string; to: string };
    points: RecoveryPoint[];
};

export type StreakMode = "training" | "sleep" | "both";

export type StreaksResponse = {
    asOf: string;
    mode: StreakMode;

    gapDays: number;

    currentStreakDays: number;
    longestStreakDays: number;

    lastQualifiedDate: string | null;
};