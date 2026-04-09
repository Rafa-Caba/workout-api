// src/services/workoutProgress.service.ts
// Main Workout Progress service. Orchestrates range resolution, data fetching,
// progress metrics, highlights, and final overview response.

import type { WorkoutDayDoc } from "../types/workoutDay.types";
import type {
    WorkoutProgressMetric,
    WorkoutProgressOverviewQuery,
    WorkoutProgressOverviewResponse,
    WorkoutProgressOverviewSummary,
} from "../types/workoutProgress.types";
import {
    ActualDayStats,
    buildActualDayStats,
    buildMetric,
    buildPlannedDayStats,
    calculateExerciseCompletionPct,
    calculateSetCompletionPct,
    getDaysWithTraining,
    getRoutineWeeksInRange,
    getTrainingSessions,
    getWorkoutDaysInRange,
    isNumber,
    PlannedDayStats,
    resolveProgressRanges,
    safeAverage,
    safeMax,
    safeSum,
    toNullableNumber,
} from "./workoutProgress/workoutProgress.shared";
import {
    buildExerciseProgressMetrics,
    buildExerciseProgressTable,
    buildSessionTypeProgress,
    buildTopExerciseHighlights,
    buildTopMovementHighlights,
} from "./workoutProgress/workoutProgress.exercises";
import {
    buildProgressHighlights,
    buildProgressSummaryText,
    buildSummaryBlocks,
} from "./workoutProgress/workoutProgress.highlights";

const buildTrainingProgressMetrics = (
    currentDays: WorkoutDayDoc[],
    previousDays: WorkoutDayDoc[]
): WorkoutProgressMetric[] => {
    const collectSessionMetric = (
        days: WorkoutDayDoc[],
        selector: (session: ReturnType<typeof getTrainingSessions>[number]) => number | null
    ): number | null => {
        const values = days
            .flatMap((day) => getTrainingSessions(day))
            .map((session) => selector(session));

        return safeSum(values);
    };

    const weightedAvgHr = (days: WorkoutDayDoc[]): number | null => {
        const sessions = days.flatMap((day) => getTrainingSessions(day));

        const weightedEntries = sessions
            .map((session) => ({
                durationSeconds: toNullableNumber(session.durationSeconds),
                avgHr: toNullableNumber(session.avgHr),
            }))
            .filter(
                (
                    entry
                ): entry is {
                    durationSeconds: number;
                    avgHr: number;
                } =>
                    isNumber(entry.durationSeconds) &&
                    isNumber(entry.avgHr) &&
                    entry.durationSeconds > 0
            );

        if (!weightedEntries.length) {
            return safeAverage(
                sessions.map((session) => toNullableNumber(session.avgHr))
            );
        }

        const weightedSum = weightedEntries.reduce(
            (sum, entry) => sum + entry.avgHr * entry.durationSeconds,
            0
        );
        const weight = weightedEntries.reduce(
            (sum, entry) => sum + entry.durationSeconds,
            0
        );

        return weight > 0 ? weightedSum / weight : null;
    };

    const maxHr = (days: WorkoutDayDoc[]): number | null =>
        safeMax(
            days.flatMap((day) =>
                getTrainingSessions(day).map((session) => toNullableNumber(session.maxHr))
            )
        );

    const currentTrainingDays = getDaysWithTraining(currentDays).length;
    const previousTrainingDays = getDaysWithTraining(previousDays).length;

    const currentSessionsCount = currentDays.reduce(
        (sum, day) => sum + getTrainingSessions(day).length,
        0
    );
    const previousSessionsCount = previousDays.reduce(
        (sum, day) => sum + getTrainingSessions(day).length,
        0
    );

    return [
        buildMetric({
            key: "sessionsCount",
            group: "training",
            label: "Training sessions",
            shortLabel: "Sessions",
            description: "Total number of sessions in the selected range",
            unit: "count",
            current: currentSessionsCount,
            previous: previousSessionsCount,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "completedTrainingDays",
            group: "training",
            label: "Completed training days",
            shortLabel: "Completed days",
            description: "Days with at least one completed training session",
            unit: "days",
            current: currentTrainingDays,
            previous: previousTrainingDays,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "trainingDays",
            group: "training",
            label: "Training days",
            shortLabel: "Days",
            description: "Alias metric for days with at least one training session",
            unit: "days",
            current: currentTrainingDays,
            previous: previousTrainingDays,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "durationSeconds",
            group: "training",
            label: "Training duration",
            shortLabel: "Duration",
            description: "Total training duration",
            unit: "seconds",
            current: collectSessionMetric(currentDays, (session) =>
                toNullableNumber(session.durationSeconds)
            ),
            previous: collectSessionMetric(previousDays, (session) =>
                toNullableNumber(session.durationSeconds)
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "activeKcal",
            group: "training",
            label: "Active calories",
            shortLabel: "Active kcal",
            description: "Sum of active calories across sessions",
            unit: "kcal",
            current: collectSessionMetric(currentDays, (session) =>
                toNullableNumber(session.activeKcal)
            ),
            previous: collectSessionMetric(previousDays, (session) =>
                toNullableNumber(session.activeKcal)
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "totalKcal",
            group: "training",
            label: "Total calories",
            shortLabel: "Total kcal",
            description: "Sum of total calories across sessions",
            unit: "kcal",
            current: collectSessionMetric(currentDays, (session) =>
                toNullableNumber(session.totalKcal)
            ),
            previous: collectSessionMetric(previousDays, (session) =>
                toNullableNumber(session.totalKcal)
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "avgHr",
            group: "training",
            label: "Average heart rate",
            shortLabel: "Avg HR",
            description: "Duration-weighted average HR when possible",
            unit: "bpm",
            current: weightedAvgHr(currentDays),
            previous: weightedAvgHr(previousDays),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "maxHr",
            group: "training",
            label: "Max heart rate",
            shortLabel: "Max HR",
            description: "Highest HR observed in the selected range",
            unit: "bpm",
            current: maxHr(currentDays),
            previous: maxHr(previousDays),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "distanceKm",
            group: "training",
            label: "Distance",
            shortLabel: "Distance",
            description: "Total distance across sessions",
            unit: "km",
            current: collectSessionMetric(currentDays, (session) =>
                toNullableNumber(session.distanceKm)
            ),
            previous: collectSessionMetric(previousDays, (session) =>
                toNullableNumber(session.distanceKm)
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "steps",
            group: "training",
            label: "Steps",
            shortLabel: "Steps",
            description: "Total steps across sessions",
            unit: "steps",
            current: collectSessionMetric(currentDays, (session) =>
                toNullableNumber(session.steps)
            ),
            previous: collectSessionMetric(previousDays, (session) =>
                toNullableNumber(session.steps)
            ),
            isPositiveWhenUp: true,
        }),
    ];
};

const buildSleepProgressMetrics = (
    currentDays: WorkoutDayDoc[],
    previousDays: WorkoutDayDoc[]
): WorkoutProgressMetric[] => {
    const currentSleepDays = currentDays.filter(
        (day) =>
            day.sleep?.timeAsleepMinutes !== null ||
            day.sleep?.deepMinutes !== null ||
            day.sleep?.remMinutes !== null ||
            day.sleep?.score !== null
    );

    const previousSleepDays = previousDays.filter(
        (day) =>
            day.sleep?.timeAsleepMinutes !== null ||
            day.sleep?.deepMinutes !== null ||
            day.sleep?.remMinutes !== null ||
            day.sleep?.score !== null
    );

    return [
        buildMetric({
            key: "sleepAvgMinutes",
            group: "sleep",
            label: "Average sleep",
            shortLabel: "Sleep avg",
            description: "Average asleep minutes on days with sleep data",
            unit: "minutes",
            current: safeAverage(
                currentSleepDays.map((day) => toNullableNumber(day.sleep?.timeAsleepMinutes))
            ),
            previous: safeAverage(
                previousSleepDays.map((day) => toNullableNumber(day.sleep?.timeAsleepMinutes))
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "deepAvgMinutes",
            group: "sleep",
            label: "Average deep sleep",
            shortLabel: "Deep avg",
            description: "Average deep sleep minutes",
            unit: "minutes",
            current: safeAverage(
                currentSleepDays.map((day) => toNullableNumber(day.sleep?.deepMinutes))
            ),
            previous: safeAverage(
                previousSleepDays.map((day) => toNullableNumber(day.sleep?.deepMinutes))
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "remAvgMinutes",
            group: "sleep",
            label: "Average REM sleep",
            shortLabel: "REM avg",
            description: "Average REM sleep minutes",
            unit: "minutes",
            current: safeAverage(
                currentSleepDays.map((day) => toNullableNumber(day.sleep?.remMinutes))
            ),
            previous: safeAverage(
                previousSleepDays.map((day) => toNullableNumber(day.sleep?.remMinutes))
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "sleepScoreAvg",
            group: "sleep",
            label: "Average sleep score",
            shortLabel: "Score avg",
            description: "Average sleep score",
            unit: "score",
            current: safeAverage(
                currentSleepDays.map((day) => toNullableNumber(day.sleep?.score))
            ),
            previous: safeAverage(
                previousSleepDays.map((day) => toNullableNumber(day.sleep?.score))
            ),
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "daysWithSleep",
            group: "sleep",
            label: "Days with sleep data",
            shortLabel: "Sleep days",
            description: "Days that contain any sleep information",
            unit: "days",
            current: currentSleepDays.length,
            previous: previousSleepDays.length,
            isPositiveWhenUp: true,
        }),
    ];
};

const buildAdherenceProgressMetrics = ({
    currentDays,
    previousDays,
    currentPlanned,
    previousPlanned,
    currentActual,
    previousActual,
    rangeDaysCount,
    compareRangeDaysCount,
}: {
    currentDays: WorkoutDayDoc[];
    previousDays: WorkoutDayDoc[];
    currentPlanned: PlannedDayStats;
    previousPlanned: PlannedDayStats;
    currentActual: ActualDayStats;
    previousActual: ActualDayStats;
    rangeDaysCount: number;
    compareRangeDaysCount: number | null;
}): WorkoutProgressMetric[] => {
    const currentAdherencePct =
        currentPlanned.plannedDays > 0
            ? (currentActual.completedPlannedDays / currentPlanned.plannedDays) * 100
            : null;

    const previousAdherencePct =
        previousPlanned.plannedDays > 0
            ? (previousActual.completedPlannedDays / previousPlanned.plannedDays) * 100
            : null;

    const currentConsistencyPct =
        rangeDaysCount > 0 ? (currentActual.trainingDays / rangeDaysCount) * 100 : null;

    const previousConsistencyPct =
        compareRangeDaysCount && compareRangeDaysCount > 0
            ? (previousActual.trainingDays / compareRangeDaysCount) * 100
            : null;

    const currentWeeksWithTraining = new Set(
        getDaysWithTraining(currentDays).map((day) => day.weekKey)
    ).size;

    const previousWeeksWithTraining = new Set(
        getDaysWithTraining(previousDays).map((day) => day.weekKey)
    ).size;

    const currentExerciseCompletionPct = calculateExerciseCompletionPct(
        currentActual.completedExercises,
        currentPlanned.plannedExercises
    );

    const previousExerciseCompletionPct = calculateExerciseCompletionPct(
        previousActual.completedExercises,
        previousPlanned.plannedExercises
    );

    const currentSetCompletionPct = calculateSetCompletionPct(
        currentActual.completedSets,
        currentPlanned.plannedSets
    );

    const previousSetCompletionPct = calculateSetCompletionPct(
        previousActual.completedSets,
        previousPlanned.plannedSets
    );

    return [
        buildMetric({
            key: "plannedDays",
            group: "adherence",
            label: "Planned days",
            shortLabel: "Planned days",
            description: "Unique planned workout days in the selected range",
            unit: "days",
            current: currentPlanned.plannedDays,
            previous: previousPlanned.plannedDays,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "completedPlannedDays",
            group: "adherence",
            label: "Completed planned days",
            shortLabel: "Completed planned",
            description: "Planned days that ended with training",
            unit: "days",
            current: currentActual.completedPlannedDays,
            previous: previousActual.completedPlannedDays,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "adherencePct",
            group: "adherence",
            label: "Adherence",
            shortLabel: "Adherence %",
            description: "Completed planned days divided by planned days",
            unit: "percent",
            current: currentAdherencePct,
            previous: previousAdherencePct,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "weeksWithTraining",
            group: "adherence",
            label: "Weeks with training",
            shortLabel: "Active weeks",
            description: "Weeks that contain at least one training day",
            unit: "count",
            current: currentWeeksWithTraining,
            previous: previousWeeksWithTraining,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "consistencyPct",
            group: "adherence",
            label: "Consistency",
            shortLabel: "Consistency %",
            description: "Training days divided by days in range",
            unit: "percent",
            current: currentConsistencyPct,
            previous: previousConsistencyPct,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "plannedExercises",
            group: "adherence",
            label: "Planned exercises",
            shortLabel: "Planned ex.",
            description: "Total planned exercises from routine templates",
            unit: "count",
            current: currentPlanned.plannedExercises,
            previous: previousPlanned.plannedExercises,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "completedExercises",
            group: "adherence",
            label: "Completed exercises",
            shortLabel: "Completed ex.",
            description: "Total performed exercises",
            unit: "count",
            current: currentActual.completedExercises,
            previous: previousActual.completedExercises,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "exerciseCompletionPct",
            group: "adherence",
            label: "Exercise completion",
            shortLabel: "Exercise %",
            description: "Completed exercises divided by planned exercises",
            unit: "percent",
            current: currentExerciseCompletionPct,
            previous: previousExerciseCompletionPct,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "plannedSets",
            group: "adherence",
            label: "Planned sets",
            shortLabel: "Planned sets",
            description: "Total planned sets",
            unit: "sets",
            current: currentPlanned.plannedSets,
            previous: previousPlanned.plannedSets,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "completedSets",
            group: "adherence",
            label: "Completed sets",
            shortLabel: "Completed sets",
            description: "Total performed sets",
            unit: "sets",
            current: currentActual.completedSets,
            previous: previousActual.completedSets,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "setCompletionPct",
            group: "adherence",
            label: "Set completion",
            shortLabel: "Set %",
            description: "Completed sets divided by planned sets",
            unit: "percent",
            current: currentSetCompletionPct,
            previous: previousSetCompletionPct,
            isPositiveWhenUp: true,
        }),
        buildMetric({
            key: "sessionQualityPct",
            group: "adherence",
            label: "Session quality",
            shortLabel: "Quality %",
            description: "Average of adherence, exercise completion, and set completion",
            unit: "percent",
            current: safeAverage([
                currentAdherencePct,
                currentExerciseCompletionPct,
                currentSetCompletionPct,
            ]),
            previous: safeAverage([
                previousAdherencePct,
                previousExerciseCompletionPct,
                previousSetCompletionPct,
            ]),
            isPositiveWhenUp: true,
        }),
    ];
};

const buildOverviewSummary = ({
    daysInRange,
    weeksCovered,
    currentActual,
    currentPlanned,
}: {
    daysInRange: number;
    weeksCovered: number;
    currentActual: ActualDayStats;
    currentPlanned: PlannedDayStats;
}): WorkoutProgressOverviewSummary => ({
    daysInRange,
    weeksCovered,
    trainingDays: currentActual.trainingDays,
    completedTrainingDays: currentActual.trainingDays,
    daysWithSleep: currentActual.daysWithSleep,
    plannedDays: currentPlanned.plannedDays,
    completedPlannedDays: currentActual.completedPlannedDays,
    adherencePct:
        currentPlanned.plannedDays > 0
            ? (currentActual.completedPlannedDays / currentPlanned.plannedDays) * 100
            : null,
    plannedExercises: currentPlanned.plannedExercises,
    completedExercises: currentActual.completedExercises,
    exerciseCompletionPct: calculateExerciseCompletionPct(
        currentActual.completedExercises,
        currentPlanned.plannedExercises
    ),
    plannedSets: currentPlanned.plannedSets,
    completedSets: currentActual.completedSets,
    setCompletionPct: calculateSetCompletionPct(
        currentActual.completedSets,
        currentPlanned.plannedSets
    ),
});

export const getWorkoutProgressOverview = async (
    userId: string,
    query: WorkoutProgressOverviewQuery
): Promise<WorkoutProgressOverviewResponse> => {
    const { range, compareRange } = resolveProgressRanges(query);

    const [currentDays, previousDays, currentRoutines, previousRoutines] = await Promise.all([
        getWorkoutDaysInRange(userId, range),
        compareRange ? getWorkoutDaysInRange(userId, compareRange) : Promise.resolve([]),
        getRoutineWeeksInRange(userId, range),
        compareRange ? getRoutineWeeksInRange(userId, compareRange) : Promise.resolve([]),
    ]);

    const currentPlanned = buildPlannedDayStats(currentRoutines, range);
    const previousPlanned = compareRange
        ? buildPlannedDayStats(previousRoutines, compareRange)
        : {
            plannedDayDates: new Set<string>(),
            plannedDays: 0,
            plannedExercises: 0,
            plannedSets: 0,
            sessionTypesByDate: new Map<string, string | null>(),
            plannedExercisesByKey: new Map<string, { appearances: number; sets: number }>(),
        };

    const currentActual = buildActualDayStats(currentDays, currentPlanned.plannedDayDates);
    const previousActual = buildActualDayStats(previousDays, previousPlanned.plannedDayDates);

    const training = buildTrainingProgressMetrics(currentDays, previousDays);
    const sleep = buildSleepProgressMetrics(currentDays, previousDays);
    const adherence = buildAdherenceProgressMetrics({
        currentDays,
        previousDays,
        currentPlanned,
        previousPlanned,
        currentActual,
        previousActual,
        rangeDaysCount: range.daysCount,
        compareRangeDaysCount: compareRange?.daysCount ?? null,
    });

    const currentWeeksCovered = Math.max(range.weekKeys.length, 1);
    const previousWeeksCovered = Math.max(compareRange?.weekKeys.length ?? 1, 1);

    const exerciseProgress = query.includeExerciseProgress
        ? buildExerciseProgressMetrics({
            currentDays,
            previousDays,
            currentPlanned,
            previousPlanned,
            currentWeeksCovered,
            previousWeeksCovered,
        })
        : [];

    const periodLabel =
        range.daysCount >= 28
            ? `en ${Math.round(range.daysCount / 7)} semanas`
            : `en ${range.daysCount} días`;

    const topMovements = query.includeExerciseProgress
        ? buildTopMovementHighlights(exerciseProgress)
        : [];

    const exerciseHighlights = query.includeExerciseProgress
        ? buildTopExerciseHighlights(exerciseProgress)
        : [];

    const exerciseTable = query.includeExerciseProgress
        ? buildExerciseProgressTable(exerciseProgress, periodLabel)
        : [];

    const sessionTypeProgress = buildSessionTypeProgress(
        currentDays,
        previousDays,
        currentPlanned,
        previousPlanned
    );

    const highlights = buildProgressHighlights({
        training,
        sleep,
        adherence,
        topMovements,
        sessionTypeProgress,
    });

    const hero = buildProgressSummaryText({
        range,
        training,
        sleep,
        adherence,
        topMovements,
        exerciseHighlights,
        highlights,
    });

    const summary = buildOverviewSummary({
        daysInRange: range.daysCount,
        weeksCovered: range.weekKeys.length,
        currentActual,
        currentPlanned,
    });

    const summaryBlocks = buildSummaryBlocks({
        training,
        sleep,
        adherence,
    });

    return {
        mode: query.mode,
        compareTo: query.compareTo,
        includeExerciseProgress: query.includeExerciseProgress,
        range,
        compareRange,
        summary,
        summaryBlocks,
        training,
        sleep,
        adherence,
        exerciseProgress,
        exerciseHighlights,
        topMovements,
        exerciseTable,
        sessionTypeProgress,
        highlights,
        hero,
    };
};