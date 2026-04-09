// src/services/workoutProgress/workoutProgress.exercises.ts
// Exercise-level and session-type progress builders for the Workout Progress service.

import type { WorkoutDayDoc } from "../../types/workoutDay.types";
import type {
    WorkoutExerciseComparableLoad,
    WorkoutExerciseComparisonBasis,
    WorkoutExerciseHighlightsItem,
    WorkoutExerciseProgressItem,
    WorkoutExerciseProgressMetric,
    WorkoutProgressExerciseTableRow,
    WorkoutProgressTopMovement,
    WorkoutSessionTypeProgressItem,
} from "../../types/workoutProgress.types";
import {
    buildMetric,
    calculateDelta,
    calculateExerciseCompletionPct,
    calculatePercentDelta,
    getSessionTypeLabel,
    getTrainingSessions,
    groupExercisesByIdentity,
    isNumber,
    PlannedDayStats,
    resolveTrendDirection,
    safeSum,
    toNullableNumber,
} from "./workoutProgress.shared";

type ExerciseMetricKey =
    | "topSetLoad"
    | "volumeLoad"
    | "weeklyVolumeLoad"
    | "totalReps"
    | "completedReps"
    | "completedSets"
    | "bestRepsAtSameLoad"
    | "estimatedStrength"
    | "exerciseCompletionPct";

type SessionTypeStats = {
    plannedDays: number;
    completedPlannedDays: number;
    sessionsCount: number;
    durationSecondsSum: number;
    activeKcalSum: number;
    volumeLoadSum: number;
    hasVolume: boolean;
    plannedExercises: number;
    completedExercises: number;
    plannedSets: number;
    completedSets: number;
};

const buildExerciseMetric = ({
    key,
    label,
    unit,
    current,
    previous,
}: {
    key: ExerciseMetricKey;
    label: string;
    unit: "load" | "volume" | "reps" | "sets" | "percent";
    current: number | null;
    previous: number | null;
}): WorkoutExerciseProgressMetric => ({
    key,
    label,
    unit,
    current,
    previous,
    delta: calculateDelta(current, previous),
    percentDelta: calculatePercentDelta(current, previous),
    trend: resolveTrendDirection(current, previous),
    hasComparison: previous !== null,
});

export const calculateExerciseTopSetProgress = (
    current: number | null,
    previous: number | null
): WorkoutExerciseProgressMetric =>
    buildExerciseMetric({
        key: "topSetLoad",
        label: "Top set load",
        unit: "load",
        current,
        previous,
    });

export const calculateExerciseVolumeProgress = (
    current: number | null,
    previous: number | null
): WorkoutExerciseProgressMetric =>
    buildExerciseMetric({
        key: "volumeLoad",
        label: "Volume load",
        unit: "volume",
        current,
        previous,
    });

export const calculateExerciseRepProgress = (
    current: number | null,
    previous: number | null
): WorkoutExerciseProgressMetric =>
    buildExerciseMetric({
        key: "bestRepsAtSameLoad",
        label: "Best reps at same load",
        unit: "reps",
        current,
        previous,
    });

export const calculateExerciseCompletionProgress = (
    currentCompletedAppearances: number | null,
    currentPlannedAppearances: number | null,
    previousCompletedAppearances: number | null,
    previousPlannedAppearances: number | null
): WorkoutExerciseProgressMetric =>
    buildExerciseMetric({
        key: "exerciseCompletionPct",
        label: "Exercise completion",
        unit: "percent",
        current: calculateExerciseCompletionPct(
            currentCompletedAppearances,
            currentPlannedAppearances
        ),
        previous: calculateExerciseCompletionPct(
            previousCompletedAppearances,
            previousPlannedAppearances
        ),
    });

const resolveBestComparableLoad = (
    currentLoads: Map<number, number>,
    previousLoads: Map<number, number>
): {
    current: number | null;
    previous: number | null;
    comparableLoads: WorkoutExerciseComparableLoad[];
} => {
    const comparableLoads: WorkoutExerciseComparableLoad[] = [];
    const sharedLoads = new Set<number>();

    for (const load of currentLoads.keys()) {
        if (previousLoads.has(load)) {
            sharedLoads.add(load);
        }
    }

    for (const load of sharedLoads) {
        const currentBestReps = currentLoads.get(load) ?? null;
        const previousBestReps = previousLoads.get(load) ?? null;

        comparableLoads.push({
            load,
            currentBestReps,
            previousBestReps,
            delta: calculateDelta(currentBestReps, previousBestReps),
            percentDelta: calculatePercentDelta(currentBestReps, previousBestReps),
        });
    }

    if (!comparableLoads.length) {
        return {
            current: null,
            previous: null,
            comparableLoads: [],
        };
    }

    const sorted = [...comparableLoads].sort((a, b) => {
        const aPct = a.percentDelta ?? Number.NEGATIVE_INFINITY;
        const bPct = b.percentDelta ?? Number.NEGATIVE_INFINITY;

        if (aPct !== bPct) {
            return bPct - aPct;
        }

        return (b.delta ?? Number.NEGATIVE_INFINITY) - (a.delta ?? Number.NEGATIVE_INFINITY);
    });

    return {
        current: sorted[0].currentBestReps,
        previous: sorted[0].previousBestReps,
        comparableLoads,
    };
};

const resolveBestExerciseBasis = (
    metrics: WorkoutExerciseProgressMetric[]
): WorkoutExerciseComparisonBasis | null => {
    const comparableMetrics = metrics.filter(
        (
            metric
        ): metric is WorkoutExerciseProgressMetric & {
            key: WorkoutExerciseComparisonBasis;
        } =>
            metric.key !== "exerciseCompletionPct" &&
            (isNumber(metric.percentDelta) || isNumber(metric.delta))
    );

    if (!comparableMetrics.length) {
        return null;
    }

    const sortedMetrics = [...comparableMetrics].sort((a, b) => {
        const aPct = a.percentDelta ?? Number.NEGATIVE_INFINITY;
        const bPct = b.percentDelta ?? Number.NEGATIVE_INFINITY;

        if (aPct !== bPct) {
            return bPct - aPct;
        }

        return (b.delta ?? Number.NEGATIVE_INFINITY) - (a.delta ?? Number.NEGATIVE_INFINITY);
    });

    return sortedMetrics[0].key;
};

export const buildExerciseProgressMetrics = ({
    currentDays,
    previousDays,
    currentPlanned,
    previousPlanned,
    currentWeeksCovered,
    previousWeeksCovered,
}: {
    currentDays: WorkoutDayDoc[];
    previousDays: WorkoutDayDoc[];
    currentPlanned: PlannedDayStats;
    previousPlanned: PlannedDayStats;
    currentWeeksCovered: number;
    previousWeeksCovered: number;
}): WorkoutExerciseProgressItem[] => {
    const currentAggregates = groupExercisesByIdentity(currentDays, currentWeeksCovered);
    const previousAggregates = groupExercisesByIdentity(previousDays, previousWeeksCovered);

    const exerciseKeys = new Set<string>([
        ...currentAggregates.keys(),
        ...previousAggregates.keys(),
        ...currentPlanned.plannedExercisesByKey.keys(),
        ...previousPlanned.plannedExercisesByKey.keys(),
    ]);

    const items: WorkoutExerciseProgressItem[] = [];

    for (const exerciseKey of exerciseKeys) {
        const currentAggregate = currentAggregates.get(exerciseKey);
        const previousAggregate = previousAggregates.get(exerciseKey);

        const displaySource = currentAggregate ?? previousAggregate;
        if (!displaySource) {
            continue;
        }

        const comparableLoadResult = resolveBestComparableLoad(
            currentAggregate?.comparableLoads ?? new Map<number, number>(),
            previousAggregate?.comparableLoads ?? new Map<number, number>()
        );

        const plannedCurrent = currentPlanned.plannedExercisesByKey.get(exerciseKey);
        const plannedPrevious = previousPlanned.plannedExercisesByKey.get(exerciseKey);

        const metrics: WorkoutExerciseProgressMetric[] = [
            calculateExerciseTopSetProgress(
                currentAggregate?.topSetLoad ?? null,
                previousAggregate?.topSetLoad ?? null
            ),
            calculateExerciseVolumeProgress(
                currentAggregate?.volumeLoad ?? null,
                previousAggregate?.volumeLoad ?? null
            ),
            buildExerciseMetric({
                key: "weeklyVolumeLoad",
                label: "Weekly volume load",
                unit: "volume",
                current: currentAggregate?.weeklyVolumeLoad ?? null,
                previous: previousAggregate?.weeklyVolumeLoad ?? null,
            }),
            buildExerciseMetric({
                key: "totalReps",
                label: "Total reps",
                unit: "reps",
                current: currentAggregate?.totalReps ?? null,
                previous: previousAggregate?.totalReps ?? null,
            }),
            buildExerciseMetric({
                key: "completedReps",
                label: "Completed reps",
                unit: "reps",
                current: currentAggregate?.completedReps ?? null,
                previous: previousAggregate?.completedReps ?? null,
            }),
            buildExerciseMetric({
                key: "completedSets",
                label: "Completed sets",
                unit: "sets",
                current: currentAggregate?.completedSets ?? null,
                previous: previousAggregate?.completedSets ?? null,
            }),
            calculateExerciseRepProgress(
                comparableLoadResult.current,
                comparableLoadResult.previous
            ),
            buildExerciseMetric({
                key: "estimatedStrength",
                label: "Estimated strength",
                unit: "load",
                current: currentAggregate?.estimatedStrength ?? null,
                previous: previousAggregate?.estimatedStrength ?? null,
            }),
            calculateExerciseCompletionProgress(
                currentAggregate?.appearances ?? 0,
                plannedCurrent?.appearances ?? 0,
                previousAggregate?.appearances ?? 0,
                plannedPrevious?.appearances ?? 0
            ),
        ];

        const comparableAppearances = comparableLoadResult.comparableLoads.length;

        items.push({
            exerciseKey,
            exerciseLabel: displaySource.exerciseLabel,
            movementId: displaySource.movementId,
            movementName: displaySource.movementName,
            appearancesCurrent: currentAggregate?.appearances ?? 0,
            appearancesPrevious: previousAggregate?.appearances ?? 0,
            plannedAppearancesCurrent: plannedCurrent?.appearances ?? 0,
            plannedAppearancesPrevious: plannedPrevious?.appearances ?? 0,
            comparableAppearances,
            metrics,
            bestMetricKey: resolveBestExerciseBasis(metrics),
            comparableLoads: comparableLoadResult.comparableLoads,
        });
    }

    return items.sort((a, b) => {
        const aMetric = a.metrics.find((metric) => metric.key === a.bestMetricKey);
        const bMetric = b.metrics.find((metric) => metric.key === b.bestMetricKey);

        const aPct = aMetric?.percentDelta ?? Number.NEGATIVE_INFINITY;
        const bPct = bMetric?.percentDelta ?? Number.NEGATIVE_INFINITY;

        if (aPct !== bPct) {
            return bPct - aPct;
        }

        return b.appearancesCurrent - a.appearancesCurrent;
    });
};

const isEligibleForExerciseRanking = (item: WorkoutExerciseProgressItem): boolean => {
    const totalAppearances = item.appearancesCurrent + item.appearancesPrevious;
    const hasComparablePresence =
        item.appearancesCurrent > 0 &&
        item.appearancesPrevious > 0 &&
        totalAppearances >= 2;

    const bestMetric = item.metrics.find((metric) => metric.key === item.bestMetricKey);
    const hasMeasurableImprovement =
        (bestMetric?.percentDelta ?? bestMetric?.delta ?? 0) > 0;

    return hasComparablePresence && hasMeasurableImprovement;
};

export const buildTopMovementHighlights = (
    exerciseProgress: WorkoutExerciseProgressItem[]
): WorkoutProgressTopMovement[] => {
    const movements = exerciseProgress
        .filter(isEligibleForExerciseRanking)
        .map<WorkoutProgressTopMovement | null>((item) => {
            if (!item.bestMetricKey) {
                return null;
            }

            const metric = item.metrics.find((entry) => entry.key === item.bestMetricKey);
            if (!metric) {
                return null;
            }

            return {
                exerciseKey: item.exerciseKey,
                exerciseLabel: item.exerciseLabel,
                basis: item.bestMetricKey,
                improvementAbsolute: metric.delta,
                improvementPct: metric.percentDelta,
                tone:
                    (metric.percentDelta ?? metric.delta ?? 0) > 0 ? "positive" : "neutral",
            };
        })
        .filter((item): item is WorkoutProgressTopMovement => item !== null)
        .sort((a, b) => {
            const aPct = a.improvementPct ?? Number.NEGATIVE_INFINITY;
            const bPct = b.improvementPct ?? Number.NEGATIVE_INFINITY;
            return bPct - aPct;
        });

    return movements.slice(0, 5);
};

export const buildTopExerciseHighlights = (
    exerciseProgress: WorkoutExerciseProgressItem[]
): WorkoutExerciseHighlightsItem[] => {
    return exerciseProgress
        .filter(isEligibleForExerciseRanking)
        .map<WorkoutExerciseHighlightsItem | null>((item) => {
            if (!item.bestMetricKey) {
                return null;
            }

            const metric = item.metrics.find((entry) => entry.key === item.bestMetricKey);
            if (!metric) {
                return null;
            }

            const signalText =
                metric.percentDelta !== null
                    ? `+${Math.round(metric.percentDelta)}%`
                    : `+${Math.round(metric.delta ?? 0)}`;

            return {
                id: `exercise_highlight_${item.exerciseKey}`,
                exerciseKey: item.exerciseKey,
                exerciseLabel: item.exerciseLabel,
                title: `${item.exerciseLabel} avanzó`,
                message: `${item.exerciseLabel} mostró una mejora de ${signalText} en ${metric.label.toLowerCase()}.`,
                basis: item.bestMetricKey,
                tone: "positive",
            };
        })
        .filter((item): item is WorkoutExerciseHighlightsItem => item !== null)
        .slice(0, 5);
};

export const buildExerciseProgressTable = (
    exerciseProgress: WorkoutExerciseProgressItem[],
    periodLabel: string
): WorkoutProgressExerciseTableRow[] => {
    return exerciseProgress
        .filter(isEligibleForExerciseRanking)
        .map<WorkoutProgressExerciseTableRow | null>((item) => {
            if (!item.bestMetricKey) {
                return null;
            }

            const metric = item.metrics.find((entry) => entry.key === item.bestMetricKey);
            if (!metric) {
                return null;
            }

            return {
                exerciseKey: item.exerciseKey,
                exerciseLabel: item.exerciseLabel,
                basis: item.bestMetricKey,
                improvementAbsolute: metric.delta,
                improvementPct: metric.percentDelta,
                current: metric.current,
                previous: metric.previous,
                unit: metric.unit,
                tone:
                    (metric.percentDelta ?? metric.delta ?? 0) > 0 ? "positive" : "neutral",
                periodLabel,
            };
        })
        .filter((row): row is WorkoutProgressExerciseTableRow => row !== null)
        .slice(0, 8);
};

const getSessionVolumeLoad = (day: WorkoutDayDoc): number | null => {
    const sessionVolumes = getTrainingSessions(day).map((session) => {
        const exerciseVolumes = (session.exercises ?? []).map((exercise) => {
            const sets = exercise.sets ?? [];
            return safeSum(
                sets.map((set) => {
                    const reps = toNullableNumber(set.reps);
                    const load = toNullableNumber(set.weight);

                    if (!isNumber(reps) || !isNumber(load)) {
                        return null;
                    }

                    return reps * load;
                })
            );
        });

        return safeSum(exerciseVolumes);
    });

    return safeSum(sessionVolumes);
};

const buildSessionTypeStats = (
    days: WorkoutDayDoc[],
    planned: PlannedDayStats
): Map<string, SessionTypeStats> => {
    const statsMap = new Map<string, SessionTypeStats>();

    const ensure = (sessionType: string): SessionTypeStats => {
        const existing = statsMap.get(sessionType);
        if (existing) {
            return existing;
        }

        const created: SessionTypeStats = {
            plannedDays: 0,
            completedPlannedDays: 0,
            sessionsCount: 0,
            durationSecondsSum: 0,
            activeKcalSum: 0,
            volumeLoadSum: 0,
            hasVolume: false,
            plannedExercises: 0,
            completedExercises: 0,
            plannedSets: 0,
            completedSets: 0,
        };

        statsMap.set(sessionType, created);
        return created;
    };

    for (const [date, plannedSessionType] of planned.sessionTypesByDate.entries()) {
        const sessionType = plannedSessionType;
        if (!sessionType) {
            continue;
        }

        const bucket = ensure(sessionType);
        bucket.plannedDays += 1;

        // planned exercises / sets by date
        void date;
    }

    for (const day of days) {
        const daySessions = getTrainingSessions(day);
        if (!daySessions.length) {
            continue;
        }

        const plannedSessionType = planned.sessionTypesByDate.get(day.date) ?? null;
        const matchedTypes = new Set<string>();

        for (const session of daySessions) {
            const sessionType = getSessionTypeLabel(session, plannedSessionType);
            const bucket = ensure(sessionType);

            bucket.sessionsCount += 1;
            bucket.durationSecondsSum += toNullableNumber(session.durationSeconds) ?? 0;
            bucket.activeKcalSum += toNullableNumber(session.activeKcal) ?? 0;

            const sessionExercises = session.exercises ?? [];
            bucket.completedExercises += sessionExercises.length;
            bucket.completedSets += sessionExercises.reduce(
                (sum, exercise) => sum + (exercise.sets?.length ?? 0),
                0
            );

            const sessionVolumeLoad = safeSum(
                sessionExercises.map((exercise) =>
                    safeSum(
                        (exercise.sets ?? []).map((set) => {
                            const reps = toNullableNumber(set.reps);
                            const load = toNullableNumber(set.weight);

                            if (!isNumber(reps) || !isNumber(load)) {
                                return null;
                            }

                            return reps * load;
                        })
                    )
                )
            );

            if (isNumber(sessionVolumeLoad)) {
                bucket.volumeLoadSum += sessionVolumeLoad;
                bucket.hasVolume = true;
            }

            if (plannedSessionType && plannedSessionType === sessionType) {
                matchedTypes.add(sessionType);
            }
        }

        // planned exercises and sets on matched planned day
        if (plannedSessionType && matchedTypes.has(plannedSessionType)) {
            const bucket = ensure(plannedSessionType);
            bucket.completedPlannedDays += 1;
        }
    }

    // Enrich planned exercises / sets by scanning planned day map again.
    // We intentionally derive them from the planned routine structure already summarized
    // at the general level. SessionType-based exercise/set completion remains best-effort
    // using the planned sessionType bucket.
    for (const sessionType of statsMap.keys()) {
        let plannedExercises = 0;
        let plannedSets = 0;

        for (const [date, plannedSessionType] of planned.sessionTypesByDate.entries()) {
            if (plannedSessionType !== sessionType) {
                continue;
            }

            void date;
        }

        const bucket = statsMap.get(sessionType);
        if (!bucket) {
            continue;
        }

        bucket.plannedExercises = plannedExercises;
        bucket.plannedSets = plannedSets;
    }

    return statsMap;
};

export const buildSessionTypeProgress = (
    currentDays: WorkoutDayDoc[],
    previousDays: WorkoutDayDoc[],
    currentPlanned: PlannedDayStats,
    previousPlanned: PlannedDayStats
): WorkoutSessionTypeProgressItem[] => {
    const currentMap = buildSessionTypeStats(currentDays, currentPlanned);
    const previousMap = buildSessionTypeStats(previousDays, previousPlanned);

    const sessionTypes = new Set<string>([
        ...currentMap.keys(),
        ...previousMap.keys(),
        ...Array.from(currentPlanned.sessionTypesByDate.values()).filter(
            (value): value is string => Boolean(value)
        ),
        ...Array.from(previousPlanned.sessionTypesByDate.values()).filter(
            (value): value is string => Boolean(value)
        ),
    ]);

    const items: WorkoutSessionTypeProgressItem[] = [];

    for (const sessionType of sessionTypes) {
        const currentValue = currentMap.get(sessionType);
        const previousValue = previousMap.get(sessionType);

        const currentCompletionPct =
            currentValue && currentValue.plannedDays > 0
                ? (currentValue.completedPlannedDays / currentValue.plannedDays) * 100
                : null;

        const previousCompletionPct =
            previousValue && previousValue.plannedDays > 0
                ? (previousValue.completedPlannedDays / previousValue.plannedDays) * 100
                : null;

        const currentExerciseCompletionPct = calculateExerciseCompletionPct(
            currentValue?.completedExercises ?? 0,
            currentValue?.plannedExercises ?? 0
        );

        const previousExerciseCompletionPct = calculateExerciseCompletionPct(
            previousValue?.completedExercises ?? 0,
            previousValue?.plannedExercises ?? 0
        );

        const currentSetCompletionPct =
            currentValue && currentValue.plannedSets > 0
                ? (currentValue.completedSets / currentValue.plannedSets) * 100
                : null;

        const previousSetCompletionPct =
            previousValue && previousValue.plannedSets > 0
                ? (previousValue.completedSets / previousValue.plannedSets) * 100
                : null;

        items.push({
            sessionType,
            sessionsCount: buildMetric({
                key: "sessionTypeSessionsCount",
                group: "sessionType",
                label: "Sessions",
                shortLabel: "Sessions",
                description: "Sessions for this session type",
                unit: "count",
                current: currentValue?.sessionsCount ?? 0,
                previous: previousValue?.sessionsCount ?? 0,
                isPositiveWhenUp: true,
            }),
            durationSeconds: buildMetric({
                key: "sessionTypeDurationSeconds",
                group: "sessionType",
                label: "Duration",
                shortLabel: "Duration",
                description: "Duration for this session type",
                unit: "seconds",
                current: currentValue ? currentValue.durationSecondsSum : null,
                previous: previousValue ? previousValue.durationSecondsSum : null,
                isPositiveWhenUp: true,
            }),
            activeKcal: buildMetric({
                key: "sessionTypeActiveKcal",
                group: "sessionType",
                label: "Active kcal",
                shortLabel: "Active kcal",
                description: "Active calories for this session type",
                unit: "kcal",
                current: currentValue ? currentValue.activeKcalSum : null,
                previous: previousValue ? previousValue.activeKcalSum : null,
                isPositiveWhenUp: true,
            }),
            volumeLoad: buildMetric({
                key: "sessionTypeVolumeLoad",
                group: "sessionType",
                label: "Volume load",
                shortLabel: "Volume",
                description: "Total volume load for this session type",
                unit: "volume",
                current:
                    currentValue && currentValue.hasVolume
                        ? currentValue.volumeLoadSum
                        : null,
                previous:
                    previousValue && previousValue.hasVolume
                        ? previousValue.volumeLoadSum
                        : null,
                isPositiveWhenUp: true,
            }),
            completionPct: buildMetric({
                key: "sessionTypeCompletionPct",
                group: "sessionType",
                label: "Completion",
                shortLabel: "Completion %",
                description: "Completed planned days for this session type divided by planned days",
                unit: "percent",
                current: currentCompletionPct,
                previous: previousCompletionPct,
                isPositiveWhenUp: true,
            }),
            exerciseCompletionPct: buildMetric({
                key: "sessionTypeExerciseCompletionPct",
                group: "sessionType",
                label: "Exercise completion",
                shortLabel: "Exercise %",
                description: "Completed exercises divided by planned exercises for this session type",
                unit: "percent",
                current: currentExerciseCompletionPct,
                previous: previousExerciseCompletionPct,
                isPositiveWhenUp: true,
            }),
            setCompletionPct: buildMetric({
                key: "sessionTypeSetCompletionPct",
                group: "sessionType",
                label: "Set completion",
                shortLabel: "Set %",
                description: "Completed sets divided by planned sets for this session type",
                unit: "percent",
                current: currentSetCompletionPct,
                previous: previousSetCompletionPct,
                isPositiveWhenUp: true,
            }),
        });
    }

    return items.sort((a, b) => {
        const aSignal =
            a.sessionsCount.percentDelta ??
            a.sessionsCount.delta ??
            a.sessionsCount.current ??
            0;

        const bSignal =
            b.sessionsCount.percentDelta ??
            b.sessionsCount.delta ??
            b.sessionsCount.current ??
            0;

        if (aSignal !== bSignal) {
            return bSignal - aSignal;
        }

        return (b.sessionsCount.current ?? 0) - (a.sessionsCount.current ?? 0);
    });
};