// /src/types/workoutDay.types.ts
// Core domain types for workout days, sleep tracking, training sessions,
// planned routines, calendar rollups, upsert payloads, and historical backfill.

import type {
    CardioEnvironment,
    CardioActivityType,
    WorkoutHealthWriteStatus,
    WorkoutCardioMetrics,
    WorkoutRoutePoint,
    WorkoutRouteSummary,
} from "./cardioSession.types";

export type ISODate = string; // "YYYY-MM-DD"
export type WeekKey = string; // "YYYY-W##"

export type ResourceType = "image" | "video";

export type WorkoutDataSource = "manual" | "healthkit" | "health-connect";

/**
 * Session-level source supports app-created live workouts in addition to
 * historical/manual HealthKit and Health Connect imports. Sleep/day-level
 * sources keep using WorkoutDataSource so app-live stays scoped to sessions.
 */
export type WorkoutSessionDataSource = WorkoutDataSource | "app-live";

export type WorkoutSessionKind =
    | "device-import"
    | "gym-check"
    | "manual-cardio"
    | "live-cardio";

export type WorkoutSourceDevice = string;

export type MediaItem = {
    publicId: string;
    url: string;
    resourceType: ResourceType;
    format: string | null;
    createdAt: string;
    meta: Record<string, unknown> | null;
};

export type SleepBlock = {
    timeAsleepMinutes: number | null;
    timeInBedMinutes: number | null;
    score: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;

    source: WorkoutDataSource | null;
    sourceDevice: WorkoutSourceDevice | null;
    importedAt: string | null;
    lastSyncedAt: string | null;

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

export type CreateExerciseInput = Omit<Exercise, "id">;

export type TrainingSessionMeta = {
    /**
     * Existing GymCheck / FE flow fields
     */
    sessionKey?: string | null;
    trainingSource?: string | null;
    dayEffortRpe?: number | null;
    totalKcalEstimated?: boolean | null;

    /**
     * Health-enriched metadata fields
     */
    source: WorkoutSessionDataSource | null;
    sourceDevice: WorkoutSourceDevice | null;
    importedAt: string | null;
    lastSyncedAt: string | null;
    sessionKind: WorkoutSessionKind | null;

    /**
     * OS health write metadata for app-created live workouts.
     */
    healthWriteStatus?: WorkoutHealthWriteStatus | null;
    healthExternalId?: string | null;
    healthWrittenAt?: string | null;

    /**
     * Optional useful metadata helpers
     */
    externalId?: string | null;
    originalType?: string | null;
    provider?: string | null;
};

export type TrainingSession = {
    id: string;
    type: string;

    /**
     * Neutral activity family for cardio support.
     * Existing gym/manual sessions can keep this as null.
     */
    activityType: CardioActivityType | null;

    /**
     * Distinguishes GPS outdoor sessions from indoor/treadmill sessions.
     * Non-cardio sessions can keep this null.
     */
    cardioEnvironment: CardioEnvironment | null;

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

    /**
     * Route/session helpers for outdoor cardio sessions.
     * routeSummary powers fast list/detail previews, while routePoints powers
     * real map rendering when phone GPS or the OS provider exposes the route.
     */
    hasRoute: boolean;
    cardioMetrics: WorkoutCardioMetrics | null;
    routeSummary: WorkoutRouteSummary | null;
    routePoints: WorkoutRoutePoint[] | null;

    effortRpe: number | null;
    notes: string | null;
    meta: TrainingSessionMeta | null;
    media: MediaItem[] | null;
    exercises: Exercise[] | null;
};

export type CreateTrainingSessionInput = Omit<
    TrainingSession,
    "id" | "media" | "exercises"
> & {
    exercises: CreateExerciseInput[] | null;
};

export type PatchTrainingSessionInput = Partial<CreateTrainingSessionInput>;

export type TrainingBlock = {
    sessions: TrainingSession[] | null;
    source: WorkoutDataSource | null;
    dayEffortRpe: number | null;
    raw: unknown | null;
};

export type PlannedRoutineSource = "trainer" | "template";

export type PlannedRoutineExercise = {
    id: string;
    name: string;
    movementId: string | null;
    movementName: string | null;
    sets: number | null;
    reps: string | null;
    rpe: number | null;
    load: string | null;
    notes: string | null;
    attachmentPublicIds: string[] | null;
};

export type PlannedRoutine = {
    sessionType: string | null;
    focus: string | null;
    exercises: PlannedRoutineExercise[] | null;
    notes: string | null;
    tags: string[] | null;
};

export type PlannedMeta = {
    plannedBy: string;
    plannedAt: string;
    source: PlannedRoutineSource | null;
};

export type WorkoutDayDoc = {
    id: string;
    userId: string;
    date: ISODate;
    weekKey: WeekKey;
    sleep: SleepBlock | null;
    training: TrainingBlock | null;
    plannedRoutine: PlannedRoutine | null;
    plannedMeta: PlannedMeta | null;
    notes: string | null;
    tags: string[] | null;
    meta: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
};

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
    timeInBedMinutes: number | null;
    score: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;
};

export type TrainingSummary = {
    source: WorkoutDataSource | null;
    dayEffortRpe: number | null;
    sessionsCount: number;
};

export type CalendarDayFull = {
    date?: ISODate;
    weekKey?: WeekKey;
    hasSleep?: boolean;
    hasTraining?: boolean;
    hasPlanned?: boolean;
    sleep?: SleepBlock | null;
    training?: TrainingBlock | null;
    plannedRoutine?: PlannedRoutine | null;
    plannedMeta?: PlannedMeta | null;
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

export type StatsRangeArgs = {
    userId: string;
    from: ISODate;
    to: ISODate;
};

export type UpsertMode = "merge" | "replace";

export type WorkoutDayUpsertPayload = Partial<
    Pick<
        WorkoutDayDoc,
        | "sleep"
        | "training"
        | "plannedRoutine"
        | "plannedMeta"
        | "notes"
        | "tags"
        | "meta"
    >
>;

export type WorkoutDayUpsertBody = WorkoutDayUpsertPayload;

export type UpsertArgs = {
    userId: string;
    date: ISODate;
    payload: WorkoutDayUpsertPayload;
    mode: UpsertMode;
};

/**
 * Historical backfill support
 * Canonical backend contract for importing many dates at once.
 */
export type WorkoutDayBackfillItem = {
    date: ISODate;
    payload: WorkoutDayUpsertPayload;
};

export type WorkoutDayBackfillBody = {
    mode: UpsertMode;
    days: WorkoutDayBackfillItem[];
};

/**
 * Service/controller flow returns the serialized day shape,
 * not the raw Mongoose document type.
 */
export type WorkoutDaySerialized = WorkoutDayDoc | Record<string, unknown>;

export type WorkoutDayBackfillItemResult = {
    date: ISODate;
    ok: boolean;
    error: string | null;
    day: WorkoutDaySerialized | null;
};

export type WorkoutDayBackfillResult = {
    mode: UpsertMode;
    total: number;
    successCount: number;
    failedCount: number;
    results: WorkoutDayBackfillItemResult[];
};
