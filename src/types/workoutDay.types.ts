export type ISODate = string; // "YYYY-MM-DD"
export type WeekKey = string; // "YYYY-W##"

export type ResourceType = "image" | "video";

export type MediaItem = {
    publicId: string;
    url: string;
    resourceType: ResourceType;
    format: string | null;
    createdAt: string; // ISO datetime
    meta: Record<string, unknown> | null;
};

export type SleepBlock = {
    timeAsleepMinutes: number | null;
    score: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;
    source: string | null;
    raw: unknown | null;
};

export type ExerciseSetUnit = "lb" | "kg";

export type ExerciseSet = {
    setIndex: number;

    reps: number | null;
    weight: number | null;
    unit: ExerciseSetUnit;

    rpe: number | null;

    isWarmup: boolean;
    isDropSet: boolean;

    tempo: string | null;
    restSec: number | null;

    tags: string[] | null;
    meta: Record<string, unknown> | null;
};

export type Exercise = {
    id: string;

    name: string;
    movementId: string | null;
    movementName: string | null;

    notes: string | null;

    sets: ExerciseSet[] | null;

    meta: Record<string, unknown> | null;
};

export type TrainingSession = {
    id: string;
    type: string;

    startAt: string | null;
    endAt: string | null;

    durationSeconds: number | null;

    activeKcal: number | null;
    totalKcal: number | null;

    avgHr: number | null;
    maxHr: number | null;

    distanceKm: number | null;
    steps: number | null;
    elevationGainM: number | null;

    paceSecPerKm: number | null;
    cadenceRpm: number | null;

    effortRpe: number | null;

    notes: string | null;
    meta: Record<string, unknown> | null;

    media: MediaItem[];

    exercises: Exercise[] | null;
};

export type TrainingBlock = {
    sessions: TrainingSession[] | null;
    source: string | null;
    dayEffortRpe: number | null;
    raw: unknown | null;
};

export type WorkoutDayDoc = {
    id: string;
    userId: string;

    date: ISODate;
    weekKey: WeekKey;

    sleep: SleepBlock | null;
    training: TrainingBlock | null;

    notes: string | null;
    tags: string[] | null;
    meta: Record<string, unknown> | null;

    createdAt: string;
    updatedAt: string;
};

/**
 * =========================================================
 * Builders outputs
 * =========================================================
 */

export type CalendarTotals = {
    totalSessions: number;

    totalDurationSeconds: number | null;
    totalActiveKcal: number | null;
    totalKcal: number | null;

    totalDistanceKm: number | null;
    totalSteps: number | null;
    totalElevationGainM: number | null;

    avgHr: number | null;
    maxHr: number | null;

    avgPaceSecPerKm: number | null;
    avgCadenceRpm: number | null;
};

export type TrainingTypeTotals = {
    type: string;
    sessions: number;

    totalDurationSeconds: number | null;
    totalActiveKcal: number | null;
    totalKcal: number | null;

    totalDistanceKm: number | null;
    totalSteps: number | null;
    totalElevationGainM: number | null;

    avgHr: number | null;
    maxHr: number | null;

    avgPaceSecPerKm: number | null;
    avgCadenceRpm: number | null;
};

export type SleepSummary = {
    timeAsleepMinutes: number | null;
    score: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;
};

export type TrainingSummary = {
    source: string | null;
    dayEffortRpe: number | null;
    sessionsCount: number;
};

export type CalendarDayFull = {
    date?: ISODate;
    weekKey?: WeekKey;

    hasSleep?: boolean;
    hasTraining?: boolean;

    sleep?: SleepBlock | null;
    training?: TrainingBlock | null;

    notes?: string | null;
    tags?: string[] | null;
    meta?: Record<string, unknown> | null;

    sleepSummary?: SleepSummary | null;
    trainingSummary?: TrainingSummary | null;

    trainingTotals?: CalendarTotals;
    trainingTypes?: TrainingTypeTotals[];
};

export type BuildOpts = {
    fields?: string[] | null;

    fillMissingDays: boolean;
    includeRollups: boolean;

    includeSleep: boolean;
    includeTraining: boolean;

    includeSummaries: boolean;
    includeTotals: boolean;
    includeTypes: boolean;

    includeRaw: boolean;
};

export type WeekRange = {
    from: ISODate;
    to: ISODate;
};

export type WeekRollups = {
    trainingTotals: CalendarTotals;
    trainingTypes: TrainingTypeTotals[];
    sleepAverages: {
        daysWithSleep: number;
        avgTimeAsleepMinutes: number | null;
        avgScore: number | null;
        avgAwakeMinutes: number | null;
        avgRemMinutes: number | null;
        avgCoreMinutes: number | null;
        avgDeepMinutes: number | null;
    };
};

export type WeekViewResponse = {
    weekKey: WeekKey;
    range: WeekRange;

    fields: string[] | null;
    fillMissingDays: boolean;

    days: CalendarDayFull[];

    rollups?: WeekRollups;
};

/**
 * =========================================================
 * Service args
 * =========================================================
 */

export type StatsRangeArgs = {
    userId: string;
    from: ISODate;
    to: ISODate;
};

export type UpsertMode = "merge" | "replace";

export type UpsertArgs = {
    userId: string;
    date: ISODate;
    payload: any;
    mode: UpsertMode;
};
