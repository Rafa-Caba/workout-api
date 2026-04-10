// src/types/bodyProgress.types.ts
import type { ISODate } from "./workoutDay.types";
import type {
    WorkoutProgressCompareTo,
    WorkoutProgressComparisonRange,
    WorkoutProgressHighlightsTone,
    WorkoutProgressMode,
    WorkoutProgressTrendDirection,
} from "./workoutProgress.types";
import type { UserMetricEntry } from "./userMetric.types";

export type BodyProgressMetricKey = "weightKg" | "bodyFatPct" | "waistCm";

export type BodyProgressUnit = "kg" | "percent" | "cm";

export type BodyProgressMetric = {
    key: BodyProgressMetricKey;
    label: string;
    unit: BodyProgressUnit;

    currentLatest: number | null;
    previousLatest: number | null;

    deltaVsPrevious: number | null;
    percentDeltaVsPrevious: number | null;

    currentFirst: number | null;
    currentLast: number | null;
    deltaWithinCurrent: number | null;
    percentDeltaWithinCurrent: number | null;

    trend: WorkoutProgressTrendDirection;
    isPositiveWhenUp: boolean;
    hasComparison: boolean;
};

export type BodyProgressSummary = {
    entriesCurrent: number;
    entriesPrevious: number;
    daysTrackedCurrent: number;
    daysTrackedPrevious: number;
};

export type BodyProgressHighlight = {
    id: string;
    tone: WorkoutProgressHighlightsTone;
    title: string;
    message: string;
    metricKey: BodyProgressMetricKey | null;
};

export type BodyProgressHero = {
    title: string;
    subtitle: string;
    items: string[];
    message: string;
    bullets: string[];
};

export type BodyProgressTimelinePoint = {
    date: ISODate;
    weightKg: number | null;
    bodyFatPct: number | null;
    waistCm: number | null;
};

export type BodyProgressOverviewQuery = {
    mode: WorkoutProgressMode;
    from?: ISODate;
    to?: ISODate;
    compareTo: WorkoutProgressCompareTo;
};

export type BodyProgressOverviewResponse = {
    mode: WorkoutProgressMode;
    compareTo: WorkoutProgressCompareTo;

    range: WorkoutProgressComparisonRange;
    compareRange: WorkoutProgressComparisonRange | null;

    summary: BodyProgressSummary;
    metrics: BodyProgressMetric[];

    timelineCurrent: BodyProgressTimelinePoint[];
    timelinePrevious: BodyProgressTimelinePoint[];

    latestCurrentEntry: UserMetricEntry | null;
    latestPreviousEntry: UserMetricEntry | null;

    highlights: BodyProgressHighlight[];
    hero: BodyProgressHero;
};