// src/types/workoutProgress.types.ts
// Backend contract types for the Workout Progress overview endpoint.
// This endpoint compares a current range against a previous one and returns
// progress metrics for training, sleep, adherence, exercise performance,
// session-type performance, highlights, and hero summary blocks.

export type ISODate = string; // YYYY-MM-DD
export type WeekKey = string; // YYYY-W##

/**
 * =========================================================
 * Query / mode
 * =========================================================
 */

export type WorkoutProgressMode =
    | "last7"
    | "last30"
    | "currentMonth"
    | "customRange";

export type WorkoutProgressCompareTo =
    | "previous_period"
    | "previous_month"
    | "none";

export type WorkoutProgressTrendDirection =
    | "up"
    | "down"
    | "flat"
    | "none";

export type WorkoutProgressHighlightsTone =
    | "positive"
    | "neutral"
    | "attention";

export type WorkoutProgressValueUnit =
    | "count"
    | "days"
    | "seconds"
    | "minutes"
    | "kcal"
    | "bpm"
    | "km"
    | "steps"
    | "percent"
    | "score"
    | "load"
    | "reps"
    | "sets"
    | "volume";

/**
 * =========================================================
 * Range
 * =========================================================
 */

export type WorkoutProgressComparisonRange = {
    from: ISODate;
    to: ISODate;
    daysCount: number;
    weekKeys: WeekKey[];
};

/**
 * =========================================================
 * Metric keys
 * =========================================================
 */

export type WorkoutProgressMetricKey =
    // Training
    | "sessionsCount"
    | "completedTrainingDays"
    | "trainingDays"
    | "durationSeconds"
    | "activeKcal"
    | "totalKcal"
    | "avgHr"
    | "maxHr"
    | "distanceKm"
    | "steps"

    // Sleep
    | "sleepAvgMinutes"
    | "deepAvgMinutes"
    | "remAvgMinutes"
    | "sleepScoreAvg"
    | "daysWithSleep"

    // Adherence
    | "plannedDays"
    | "completedPlannedDays"
    | "adherencePct"
    | "weeksWithTraining"
    | "consistencyPct"
    | "plannedExercises"
    | "completedExercises"
    | "exerciseCompletionPct"
    | "plannedSets"
    | "completedSets"
    | "setCompletionPct"
    | "sessionQualityPct"

    // Exercise
    | "topSetLoad"
    | "volumeLoad"
    | "weeklyVolumeLoad"
    | "totalReps"
    | "completedReps"
    | "completedExerciseSets"
    | "bestRepsAtSameLoad"
    | "estimatedStrength"
    | "estimated1RM"
    | "exerciseProgress"
    | "movementTrend"

    // Session type
    | "sessionTypeSessionsCount"
    | "sessionTypeDurationSeconds"
    | "sessionTypeActiveKcal"
    | "sessionTypeVolumeLoad"
    | "sessionTypeCompletionPct"
    | "sessionTypeExerciseCompletionPct"
    | "sessionTypeSetCompletionPct";

export type WorkoutProgressMetricGroup =
    | "training"
    | "sleep"
    | "adherence"
    | "exercise"
    | "sessionType";

/**
 * =========================================================
 * Generic comparable metric
 * =========================================================
 */

export type WorkoutProgressMetric = {
    key: WorkoutProgressMetricKey;
    group: WorkoutProgressMetricGroup;

    label: string;
    shortLabel: string | null;
    description: string | null;

    unit: WorkoutProgressValueUnit;

    current: number | null;
    previous: number | null;

    delta: number | null;
    percentDelta: number | null;

    trend: WorkoutProgressTrendDirection;

    /**
     * UI hint:
     * - true => higher value is usually positive
     * - false => lower value is usually positive
     */
    isPositiveWhenUp: boolean;

    hasComparison: boolean;
};

/**
 * =========================================================
 * Summary blocks
 * =========================================================
 */

export type WorkoutProgressSummaryBlockKey =
    | "training"
    | "sleep"
    | "adherence";

export type WorkoutProgressSummaryBlock = {
    key: WorkoutProgressSummaryBlockKey;
    title: string;
    subtitle: string | null;

    metricsCount: number;

    currentValue: number | null;
    previousValue: number | null;

    delta: number | null;
    percentDelta: number | null;

    trend: WorkoutProgressTrendDirection;
    unit: WorkoutProgressValueUnit | null;
};

/**
 * =========================================================
 * Highlights / hero
 * =========================================================
 */

export type WorkoutProgressHighlightsItem = {
    id: string;
    tone: WorkoutProgressHighlightsTone;
    title: string;
    message: string;

    metricKey: WorkoutProgressMetricKey | null;
    group: WorkoutProgressMetricGroup | null;
};

export type WorkoutProgressHero = {
    title: string;
    subtitle: string;
    items: string[];
    message: string;
    bullets: string[];
};

/**
 * =========================================================
 * Exercise progress
 * =========================================================
 */

export type WorkoutExerciseComparisonBasis =
    | "topSetLoad"
    | "volumeLoad"
    | "weeklyVolumeLoad"
    | "totalReps"
    | "completedReps"
    | "completedSets"
    | "bestRepsAtSameLoad"
    | "estimatedStrength";

export type WorkoutExerciseComparableLoad = {
    load: number;
    currentBestReps: number | null;
    previousBestReps: number | null;
    delta: number | null;
    percentDelta: number | null;
};

export type WorkoutExerciseProgressMetric = {
    key:
    | "topSetLoad"
    | "volumeLoad"
    | "weeklyVolumeLoad"
    | "totalReps"
    | "completedReps"
    | "completedSets"
    | "bestRepsAtSameLoad"
    | "estimatedStrength"
    | "exerciseCompletionPct";
    label: string;
    unit: WorkoutProgressValueUnit;

    current: number | null;
    previous: number | null;

    delta: number | null;
    percentDelta: number | null;

    trend: WorkoutProgressTrendDirection;
    hasComparison: boolean;
};

export type WorkoutExerciseProgressItem = {
    exerciseKey: string;
    exerciseLabel: string;

    movementId: string | null;
    movementName: string | null;

    appearancesCurrent: number;
    appearancesPrevious: number;

    plannedAppearancesCurrent: number;
    plannedAppearancesPrevious: number;

    comparableAppearances: number;

    metrics: WorkoutExerciseProgressMetric[];
    bestMetricKey: WorkoutExerciseComparisonBasis | null;

    comparableLoads: WorkoutExerciseComparableLoad[];
};

export type WorkoutExerciseGroupProgress = {
    groupKey: string;
    groupLabel: string;
    items: WorkoutExerciseProgressItem[];
};

export type WorkoutProgressTopMovement = {
    exerciseKey: string;
    exerciseLabel: string;

    basis: WorkoutExerciseComparisonBasis;

    improvementAbsolute: number | null;
    improvementPct: number | null;

    tone: "positive" | "neutral";
};

export type WorkoutProgressExerciseTableRow = {
    exerciseKey: string;
    exerciseLabel: string;

    basis: WorkoutExerciseComparisonBasis;

    improvementAbsolute: number | null;
    improvementPct: number | null;

    current: number | null;
    previous: number | null;

    unit: WorkoutProgressValueUnit;
    tone: "positive" | "neutral";
    periodLabel: string;
};

export type WorkoutExerciseHighlightsItem = {
    id: string;
    exerciseKey: string;
    exerciseLabel: string;
    title: string;
    message: string;
    basis: WorkoutExerciseComparisonBasis;
    tone: WorkoutProgressHighlightsTone;
};

/**
 * =========================================================
 * Session type progress
 * =========================================================
 */

export type WorkoutSessionTypeProgressItem = {
    sessionType: string;

    sessionsCount: WorkoutProgressMetric;
    durationSeconds: WorkoutProgressMetric;
    activeKcal: WorkoutProgressMetric;
    volumeLoad: WorkoutProgressMetric | null;
    completionPct: WorkoutProgressMetric | null;
    exerciseCompletionPct: WorkoutProgressMetric | null;
    setCompletionPct: WorkoutProgressMetric | null;
};

/**
 * =========================================================
 * Summary / overview
 * =========================================================
 */

export type WorkoutProgressOverviewSummary = {
    daysInRange: number;
    weeksCovered: number;

    trainingDays: number;
    completedTrainingDays: number;
    daysWithSleep: number;

    plannedDays: number | null;
    completedPlannedDays: number | null;
    adherencePct: number | null;

    plannedExercises: number | null;
    completedExercises: number | null;
    exerciseCompletionPct: number | null;

    plannedSets: number | null;
    completedSets: number | null;
    setCompletionPct: number | null;
};

/**
 * =========================================================
 * Query contract
 * =========================================================
 */

export type WorkoutProgressOverviewQuery = {
    mode: WorkoutProgressMode;
    from?: ISODate;
    to?: ISODate;
    compareTo: WorkoutProgressCompareTo;
    weekKey?: WeekKey;
    includeExerciseProgress: boolean;
};

/**
 * =========================================================
 * Main response contract
 * =========================================================
 */

export type WorkoutProgressOverviewResponse = {
    mode: WorkoutProgressMode;
    compareTo: WorkoutProgressCompareTo;
    includeExerciseProgress: boolean;

    range: WorkoutProgressComparisonRange;
    compareRange: WorkoutProgressComparisonRange | null;

    summary: WorkoutProgressOverviewSummary;
    summaryBlocks: WorkoutProgressSummaryBlock[];

    training: WorkoutProgressMetric[];
    sleep: WorkoutProgressMetric[];
    adherence: WorkoutProgressMetric[];

    exerciseProgress: WorkoutExerciseProgressItem[];
    exerciseHighlights: WorkoutExerciseHighlightsItem[];
    topMovements: WorkoutProgressTopMovement[];
    exerciseTable: WorkoutProgressExerciseTableRow[];

    sessionTypeProgress: WorkoutSessionTypeProgressItem[];

    highlights: WorkoutProgressHighlightsItem[];
    hero: WorkoutProgressHero;
};