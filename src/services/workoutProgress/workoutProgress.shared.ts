// src/services/workoutProgress/workoutProgress.shared.ts
// Shared helpers, fetchers, range resolution, and common metric builders
// for the Workout Progress service.

import mongoose from "mongoose";
import { WorkoutDayModel } from "../../models/WorkoutDay.model";
import { WorkoutRoutineWeekModel } from "../../models/WorkoutRoutineWeek.model";
import { getISOWeekDateRange, getWeekKeyFromISODate } from "../../utils/weekKey";
import type {
    Exercise,
    ExerciseSet,
    ISODate,
    TrainingSession,
    WeekKey,
    WorkoutDayDoc,
} from "../../types/workoutDay.types";
import type { RoutineWeekTemplate } from "../../types/workoutRoutine.types";
import type {
    WorkoutProgressComparisonRange,
    WorkoutProgressMetric,
    WorkoutProgressMetricGroup,
    WorkoutProgressMetricKey,
    WorkoutProgressOverviewQuery,
    WorkoutProgressTrendDirection,
} from "../../types/workoutProgress.types";

export type PlannedExerciseStats = {
    appearances: number;
    sets: number;
};

export type PlannedDayStats = {
    plannedDayDates: Set<ISODate>;
    plannedDays: number;
    plannedExercises: number;
    plannedSets: number;
    sessionTypesByDate: Map<ISODate, string | null>;
    plannedExercisesByKey: Map<string, PlannedExerciseStats>;
};

export type ActualDayStats = {
    trainingDays: number;
    completedPlannedDays: number;
    completedExercises: number;
    completedSets: number;
    daysWithSleep: number;
};

export type ProgressResolvedRanges = {
    range: WorkoutProgressComparisonRange;
    compareRange: WorkoutProgressComparisonRange | null;
};

export type ExerciseIdentity = {
    exerciseKey: string;
    exerciseLabel: string;
    movementId: string | null;
    movementName: string | null;
};

export type ExerciseAggregate = {
    exerciseKey: string;
    exerciseLabel: string;
    movementId: string | null;
    movementName: string | null;
    appearances: number;
    topSetLoad: number | null;
    volumeLoad: number | null;
    weeklyVolumeLoad: number | null;
    totalReps: number | null;
    completedReps: number | null;
    completedSets: number | null;
    bestRepsAtSameLoad: number | null;
    estimatedStrength: number | null;
    comparableLoads: Map<number, number>;
};

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

export const isNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

export const toNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const parsedValue = Number(value.trim());
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    return null;
};

export const safeSum = (values: Array<number | null | undefined>): number | null => {
    const numericValues = values.filter((value): value is number => isNumber(value));
    if (!numericValues.length) {
        return null;
    }

    return numericValues.reduce((sum, value) => sum + value, 0);
};

export const safeAverage = (values: Array<number | null | undefined>): number | null => {
    const numericValues = values.filter((value): value is number => isNumber(value));
    if (!numericValues.length) {
        return null;
    }

    return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
};

export const safeMax = (values: Array<number | null | undefined>): number | null => {
    const numericValues = values.filter((value): value is number => isNumber(value));
    if (!numericValues.length) {
        return null;
    }

    return Math.max(...numericValues);
};

export const round1 = (value: number): number => Math.round(value * 10) / 10;

const startOfUtcMonth = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfUtcMonth = (date: Date): Date =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

export const toIsoDate = (date: Date): ISODate => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export const fromIsoDate = (isoDate: ISODate): Date => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
};

export const addDays = (isoDate: ISODate, days: number): ISODate => {
    const date = fromIsoDate(isoDate);
    date.setUTCDate(date.getUTCDate() + days);
    return toIsoDate(date);
};

export const diffDaysInclusive = (from: ISODate, to: ISODate): number => {
    const fromTime = fromIsoDate(from).getTime();
    const toTime = fromIsoDate(to).getTime();
    return Math.floor((toTime - fromTime) / 86400000) + 1;
};

export const enumerateDates = (from: ISODate, to: ISODate): ISODate[] => {
    const dates: ISODate[] = [];
    let cursor = from;

    while (cursor <= to) {
        dates.push(cursor);
        cursor = addDays(cursor, 1);
    }

    return dates;
};

export const getWeekKeysBetween = (from: ISODate, to: ISODate): WeekKey[] => {
    const weekKeys = new Set<WeekKey>();

    for (const date of enumerateDates(from, to)) {
        weekKeys.add(getWeekKeyFromISODate(date));
    }

    return Array.from(weekKeys).sort();
};

export const buildComparisonRange = (
    from: ISODate,
    to: ISODate
): WorkoutProgressComparisonRange => ({
    from,
    to,
    daysCount: diffDaysInclusive(from, to),
    weekKeys: getWeekKeysBetween(from, to),
});

export const calculateDelta = (
    current: number | null,
    previous: number | null
): number | null => {
    if (!isNumber(current) || !isNumber(previous)) {
        return null;
    }

    return current - previous;
};

export const calculatePercentDelta = (
    current: number | null,
    previous: number | null
): number | null => {
    if (!isNumber(current) || !isNumber(previous) || previous === 0) {
        return null;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
};

export const resolveTrendDirection = (
    current: number | null,
    previous: number | null
): WorkoutProgressTrendDirection => {
    if (!isNumber(current) || !isNumber(previous)) {
        return "none";
    }

    const delta = current - previous;

    if (Math.abs(delta) < 0.0001) {
        return "flat";
    }

    return delta > 0 ? "up" : "down";
};

export const buildMetric = ({
    key,
    group,
    label,
    shortLabel,
    description,
    unit,
    current,
    previous,
    isPositiveWhenUp,
}: {
    key: WorkoutProgressMetricKey;
    group: WorkoutProgressMetricGroup;
    label: string;
    shortLabel: string | null;
    description: string | null;
    unit:
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
    current: number | null;
    previous: number | null;
    isPositiveWhenUp: boolean;
}): WorkoutProgressMetric => {
    const delta = calculateDelta(current, previous);
    const percentDelta = calculatePercentDelta(current, previous);

    return {
        key,
        group,
        label,
        shortLabel,
        description,
        unit,
        current,
        previous,
        delta,
        percentDelta,
        trend: resolveTrendDirection(current, previous),
        isPositiveWhenUp,
        hasComparison: previous !== null,
    };
};

export const normalizeSessionTypeLabel = (
    value: string | null | undefined
): string | null => {
    if (!value) {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();

    const aliasMap: Record<string, string> = {
        "pull": "Pull",
        "pull day": "Pull",
        "push": "Push",
        "push day": "Push",
        "legs": "Leg Day",
        "leg day": "Leg Day",
        "upper": "Upper",
        "upper power": "Upper Power",
        "upper hypertrophy": "Upper Hypertrophy",
        "traditional strength training": "Strength Training",
        "strength training": "Strength Training",
        "walking": "Walking",
        "indoor walk": "Walking",
        "running": "Running",
        "outdoor run": "Running",
    };

    if (aliasMap[normalizedValue]) {
        return aliasMap[normalizedValue];
    }

    return value.trim();
};

export const getSessionTypeLabel = (
    session: TrainingSession,
    fallback: string | null = null
): string => {
    return (
        normalizeSessionTypeLabel(session.type) ??
        normalizeSessionTypeLabel(session.activityType) ??
        normalizeSessionTypeLabel(session.meta?.originalType) ??
        normalizeSessionTypeLabel(fallback) ??
        "Unknown"
    );
};

export const resolveProgressRanges = (
    query: WorkoutProgressOverviewQuery
): ProgressResolvedRanges => {
    if (query.weekKey) {
        const weekRange = getISOWeekDateRange(query.weekKey);
        const range = buildComparisonRange(weekRange.startDate, weekRange.endDate);

        if (query.compareTo === "none") {
            return { range, compareRange: null };
        }

        if (query.compareTo === "previous_month") {
            const weekStart = fromIsoDate(range.from);
            const previousMonthDate = new Date(
                Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth() - 1, 1)
            );
            const previousMonthFrom = toIsoDate(startOfUtcMonth(previousMonthDate));
            const previousMonthTo = toIsoDate(endOfUtcMonth(previousMonthDate));

            return {
                range,
                compareRange: buildComparisonRange(previousMonthFrom, previousMonthTo),
            };
        }

        const compareFrom = addDays(range.from, -range.daysCount);
        const compareTo = addDays(range.from, -1);

        return {
            range,
            compareRange: buildComparisonRange(compareFrom, compareTo),
        };
    }

    let currentFrom: ISODate;
    let currentTo: ISODate;

    if (query.mode === "customRange") {
        currentFrom = query.from ?? "";
        currentTo = query.to ?? "";
    } else {
        const now = new Date();

        if (query.mode === "currentMonth") {
            currentFrom = toIsoDate(startOfUtcMonth(now));
            currentTo = toIsoDate(endOfUtcMonth(now));
        } else if (query.mode === "last7") {
            currentTo = toIsoDate(now);
            currentFrom = addDays(currentTo, -6);
        } else {
            currentTo = toIsoDate(now);
            currentFrom = addDays(currentTo, -29);
        }
    }

    const range = buildComparisonRange(currentFrom, currentTo);

    if (query.compareTo === "none") {
        return { range, compareRange: null };
    }

    if (query.compareTo === "previous_month") {
        const anchorDate = fromIsoDate(range.from);
        const previousMonthDate = new Date(
            Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - 1, 1)
        );
        const previousMonthFrom = toIsoDate(startOfUtcMonth(previousMonthDate));
        const previousMonthTo = toIsoDate(endOfUtcMonth(previousMonthDate));

        return {
            range,
            compareRange: buildComparisonRange(previousMonthFrom, previousMonthTo),
        };
    }

    const previousFrom = addDays(range.from, -range.daysCount);
    const previousTo = addDays(range.from, -1);

    return {
        range,
        compareRange: buildComparisonRange(previousFrom, previousTo),
    };
};

export const getWorkoutDaysInRange = async (
    userId: string,
    range: WorkoutProgressComparisonRange
): Promise<WorkoutDayDoc[]> => {
    const userObjectId = toObjectId(userId);

    return WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: range.from, $lte: range.to },
    })
        .sort({ date: 1 })
        .lean<WorkoutDayDoc[]>();
};

export const getRoutineWeeksInRange = async (
    userId: string,
    range: WorkoutProgressComparisonRange
): Promise<RoutineWeekTemplate[]> => {
    const userObjectId = toObjectId(userId);

    return WorkoutRoutineWeekModel.find({
        userId: userObjectId,
        "range.from": { $lte: range.to },
        "range.to": { $gte: range.from },
    })
        .sort({ weekKey: 1 })
        .lean<RoutineWeekTemplate[]>();
};

export const getTrainingSessions = (day: WorkoutDayDoc): TrainingSession[] => {
    const sessions = day.training?.sessions ?? null;
    return Array.isArray(sessions) ? sessions : [];
};

export const getDayExercises = (day: WorkoutDayDoc): Exercise[] => {
    return getTrainingSessions(day).flatMap((session) =>
        Array.isArray(session.exercises) ? session.exercises : []
    );
};

export const getDaysWithTraining = (days: WorkoutDayDoc[]): WorkoutDayDoc[] =>
    days.filter((day) => getTrainingSessions(day).length > 0);

export const safeExerciseLoad = (set: ExerciseSet): number | null =>
    toNullableNumber(set.weight);

export const safeExerciseReps = (set: ExerciseSet): number | null =>
    toNullableNumber(set.reps);

export const safeExerciseSets = (exercise: Exercise): number => {
    const sets = exercise.sets ?? [];
    return sets.length;
};

export const resolveComparableExerciseKey = (exercise: Exercise): string => {
    const movementId = exercise.movementId?.trim() || null;
    if (movementId) {
        return `movement:${movementId}`;
    }

    const normalizedName = exercise.name.trim().toLowerCase().replace(/\s+/g, " ");
    return `name:${normalizedName}`;
};

export const normalizeExerciseIdentity = (exercise: Exercise): ExerciseIdentity => {
    const movementId = exercise.movementId?.trim() || null;
    const movementName = exercise.movementName?.trim() || null;
    const exerciseKey = resolveComparableExerciseKey(exercise);
    const exerciseLabel = movementName || exercise.name.trim();

    return {
        exerciseKey,
        exerciseLabel,
        movementId,
        movementName,
    };
};

export const calculateExerciseEstimatedStrength = (
    sets: ExerciseSet[] | null
): number | null => {
    const validScores = (sets ?? [])
        .map((set) => {
            const reps = safeExerciseReps(set);
            const load = safeExerciseLoad(set);

            if (!isNumber(reps) || !isNumber(load) || reps <= 0 || load <= 0) {
                return null;
            }

            return load * (1 + reps / 30);
        })
        .filter((value): value is number => isNumber(value));

    return validScores.length ? Math.max(...validScores) : null;
};

export const buildExerciseSignal = (
    exercise: Exercise,
    weeksCovered: number
): ExerciseAggregate => {
    const identity = normalizeExerciseIdentity(exercise);
    const sets = exercise.sets ?? [];

    const validLoads = sets
        .map((set) => safeExerciseLoad(set))
        .filter((value): value is number => isNumber(value));

    const validReps = sets
        .map((set) => safeExerciseReps(set))
        .filter((value): value is number => isNumber(value));

    const topSetLoad = validLoads.length ? Math.max(...validLoads) : null;

    const volumeTerms = sets
        .map((set) => {
            const reps = safeExerciseReps(set);
            const load = safeExerciseLoad(set);

            if (!isNumber(reps) || !isNumber(load)) {
                return null;
            }

            return reps * load;
        })
        .filter((value): value is number => isNumber(value));

    const volumeLoad = volumeTerms.length
        ? volumeTerms.reduce((sum, value) => sum + value, 0)
        : null;

    const completedReps = validReps.length
        ? validReps.reduce((sum, value) => sum + value, 0)
        : null;

    const comparableLoads = new Map<number, number>();

    for (const set of sets) {
        const load = safeExerciseLoad(set);
        const reps = safeExerciseReps(set);

        if (!isNumber(load) || !isNumber(reps)) {
            continue;
        }

        const currentBestReps = comparableLoads.get(load) ?? 0;
        if (reps > currentBestReps) {
            comparableLoads.set(load, reps);
        }
    }

    return {
        ...identity,
        appearances: 1,
        topSetLoad,
        volumeLoad,
        weeklyVolumeLoad:
            volumeLoad !== null && weeksCovered > 0 ? volumeLoad / weeksCovered : null,
        totalReps: completedReps,
        completedReps,
        completedSets: sets.length ? sets.length : null,
        bestRepsAtSameLoad: null,
        estimatedStrength: calculateExerciseEstimatedStrength(sets),
        comparableLoads,
    };
};

export const groupExercisesByIdentity = (
    days: WorkoutDayDoc[],
    weeksCovered: number
): Map<string, ExerciseAggregate> => {
    const aggregates = new Map<string, ExerciseAggregate>();

    for (const day of days) {
        for (const session of getTrainingSessions(day)) {
            for (const exercise of session.exercises ?? []) {
                const signal = buildExerciseSignal(exercise, weeksCovered);
                const existing = aggregates.get(signal.exerciseKey);

                if (!existing) {
                    aggregates.set(signal.exerciseKey, signal);
                    continue;
                }

                existing.appearances += 1;
                existing.topSetLoad = safeMax([existing.topSetLoad, signal.topSetLoad]);
                existing.volumeLoad = safeSum([existing.volumeLoad, signal.volumeLoad]);
                existing.totalReps = safeSum([existing.totalReps, signal.totalReps]);
                existing.completedReps = safeSum([existing.completedReps, signal.completedReps]);
                existing.completedSets = safeSum([
                    existing.completedSets,
                    signal.completedSets,
                ]);
                existing.estimatedStrength = safeMax([
                    existing.estimatedStrength,
                    signal.estimatedStrength,
                ]);

                const totalVolume = existing.volumeLoad;
                existing.weeklyVolumeLoad =
                    totalVolume !== null && weeksCovered > 0
                        ? totalVolume / weeksCovered
                        : null;

                for (const [load, reps] of signal.comparableLoads.entries()) {
                    const currentBest = existing.comparableLoads.get(load) ?? 0;
                    if (reps > currentBest) {
                        existing.comparableLoads.set(load, reps);
                    }
                }
            }
        }
    }

    return aggregates;
};

export const buildPlannedDayStats = (
    routines: RoutineWeekTemplate[],
    range: WorkoutProgressComparisonRange
): PlannedDayStats => {
    const plannedDayDates = new Set<ISODate>();
    const sessionTypesByDate = new Map<ISODate, string | null>();
    const plannedExercisesByKey = new Map<string, PlannedExerciseStats>();

    let plannedExercises = 0;
    let plannedSets = 0;

    for (const routineWeek of routines) {
        for (const day of routineWeek.days) {
            if (day.date < range.from || day.date > range.to) {
                continue;
            }

            const hasMeaningfulPlan =
                Boolean(day.sessionType?.trim()) ||
                Boolean(day.focus?.trim()) ||
                (day.exercises?.length ?? 0) > 0;

            if (!hasMeaningfulPlan) {
                continue;
            }

            plannedDayDates.add(day.date);
            sessionTypesByDate.set(day.date, normalizeSessionTypeLabel(day.sessionType));

            for (const exercise of day.exercises ?? []) {
                plannedExercises += 1;
                plannedSets += exercise.sets ?? 0;

                const exerciseKey = exercise.movementId?.trim()
                    ? `movement:${exercise.movementId.trim()}`
                    : `name:${exercise.name.trim().toLowerCase().replace(/\s+/g, " ")}`;

                const current = plannedExercisesByKey.get(exerciseKey) ?? {
                    appearances: 0,
                    sets: 0,
                };

                current.appearances += 1;
                current.sets += exercise.sets ?? 0;

                plannedExercisesByKey.set(exerciseKey, current);
            }
        }
    }

    return {
        plannedDayDates,
        plannedDays: plannedDayDates.size,
        plannedExercises,
        plannedSets,
        sessionTypesByDate,
        plannedExercisesByKey,
    };
};

export const buildActualDayStats = (
    days: WorkoutDayDoc[],
    plannedDayDates: Set<ISODate>
): ActualDayStats => {
    const trainingDayDates = new Set<ISODate>();
    let completedExercises = 0;
    let completedSets = 0;
    let daysWithSleep = 0;

    for (const day of days) {
        const sessions = getTrainingSessions(day);

        if (sessions.length > 0) {
            trainingDayDates.add(day.date);
        }

        if (
            day.sleep?.timeAsleepMinutes !== null ||
            day.sleep?.deepMinutes !== null ||
            day.sleep?.remMinutes !== null ||
            day.sleep?.score !== null
        ) {
            daysWithSleep += 1;
        }

        for (const exercise of getDayExercises(day)) {
            completedExercises += 1;
            completedSets += safeExerciseSets(exercise);
        }
    }

    let completedPlannedDays = 0;
    for (const date of trainingDayDates) {
        if (plannedDayDates.has(date)) {
            completedPlannedDays += 1;
        }
    }

    return {
        trainingDays: trainingDayDates.size,
        completedPlannedDays,
        completedExercises,
        completedSets,
        daysWithSleep,
    };
};

export const calculateExerciseCompletionPct = (
    completedExercises: number | null,
    plannedExercises: number | null
): number | null => {
    if (!isNumber(completedExercises) || !isNumber(plannedExercises) || plannedExercises <= 0) {
        return null;
    }

    return (completedExercises / plannedExercises) * 100;
};

export const calculateSetCompletionPct = (
    completedSets: number | null,
    plannedSets: number | null
): number | null => {
    if (!isNumber(completedSets) || !isNumber(plannedSets) || plannedSets <= 0) {
        return null;
    }

    return (completedSets / plannedSets) * 100;
};