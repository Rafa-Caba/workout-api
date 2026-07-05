// src/utils/workoutDayBuilders.ts

import type {
    BuildOpts,
    CalendarDayFull,
    CalendarTotals,
    SleepBlock,
    TrainingBlock,
    TrainingSession,
    TrainingSummary,
    TrainingTypeTotals,
    WeekRange,
    WorkoutDataSource,
    PlannedRoutine,
    PlannedMeta,
} from "../types/workoutDay.types";

/**
 * =========================================================
 * Small helpers
 * =========================================================
 */

type NullableNumber = number | null;

type TrainingTypeAccumulator = {
    type: string;
    sessions: number;

    totalDurationSeconds: NullableNumber;
    totalActiveKcal: NullableNumber;
    totalKcal: NullableNumber;

    totalDistanceKm: NullableNumber;
    totalSteps: NullableNumber;
    totalElevationGainM: NullableNumber;

    maxHr: NullableNumber;

    hrWeightedSum: number;
    hrWeight: number;

    cadenceWeightedSum: number;
    cadenceWeight: number;

    paceWeightedSum: number;
    paceWeight: number;
};

type BuildableDayInput = {
    date?: string;
    weekKey?: string;

    sleep?: SleepBlock | null;
    training?: TrainingBlock | null;

    plannedRoutine?: PlannedRoutine | null;
    plannedMeta?: PlannedMeta | null;

    notes?: string | null;
    tags?: string[] | null;
    meta?: Record<string, unknown> | null;

    hasPlanned?: boolean;
};

type TrainingBlockOutput = Omit<TrainingBlock, "sessions"> & {
    sessions: TrainingSession[] | null;
};

const safeAvg = (sum: number, count: number): number | null => {
    if (count <= 0) return null;
    return sum / count;
};

const addNullable = (a: NullableNumber, b: NullableNumber): NullableNumber => {
    if (a === null && b === null) return null;
    return (a ?? 0) + (b ?? 0);
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

const isNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

const hasMeaningfulSleep = (sleep: SleepBlock | null | undefined): boolean => {
    if (!sleep) return false;

    return (
        sleep.timeAsleepMinutes != null ||
        sleep.timeInBedMinutes != null ||
        sleep.score != null ||
        sleep.awakeMinutes != null ||
        sleep.remMinutes != null ||
        sleep.coreMinutes != null ||
        sleep.deepMinutes != null
    );
};

const hasMeaningfulPlannedRoutine = (
    plannedRoutine: PlannedRoutine | null | undefined
): boolean => {
    if (!plannedRoutine) return false;

    return (
        (typeof plannedRoutine.sessionType === "string" &&
            plannedRoutine.sessionType.trim().length > 0) ||
        (typeof plannedRoutine.focus === "string" &&
            plannedRoutine.focus.trim().length > 0) ||
        (Array.isArray(plannedRoutine.exercises) &&
            plannedRoutine.exercises.length > 0)
    );
};

const getTrainingSessions = (
    training: TrainingBlock | null | undefined
): TrainingSession[] | null => {
    const sessions = training?.sessions ?? null;
    return Array.isArray(sessions) ? sessions : null;
};

const normalizeSessionForOutput = (session: TrainingSession): TrainingSession => {
    return {
        ...session,
        meta: session.meta ?? null,
        media: Array.isArray(session.media) ? session.media : [],
        activityType: session.activityType ?? null,
        hasRoute: session.hasRoute ?? false,
        cardioMetrics: session.cardioMetrics ?? null,
        routeSummary: session.routeSummary ?? null,
        routePoints: Array.isArray(session.routePoints) ? session.routePoints : null,
    };
};

const stripTrainingRawForOutput = (
    training: TrainingBlock | null
): TrainingBlockOutput | null => {
    if (!training) return null;

    const normalizedSessions = Array.isArray(training.sessions)
        ? training.sessions.map((session) => normalizeSessionForOutput(session))
        : training.sessions ?? null;

    return {
        sessions: normalizedSessions,
        source: training.source,
        dayEffortRpe: training.dayEffortRpe,
        raw: null,
    };
};

const buildEmptyCalendarTotals = (): CalendarTotals => ({
    totalSessions: 0,

    totalDurationSeconds: null,
    totalActiveKcal: null,
    totalKcal: null,

    totalDistanceKm: null,
    totalSteps: null,
    totalElevationGainM: null,

    avgHr: null,
    maxHr: null,

    avgPaceSecPerKm: null,
    avgCadenceRpm: null,
});

const createTrainingTypeAccumulator = (type: string): TrainingTypeAccumulator => ({
    type,
    sessions: 0,

    totalDurationSeconds: null,
    totalActiveKcal: null,
    totalKcal: null,

    totalDistanceKm: null,
    totalSteps: null,
    totalElevationGainM: null,

    maxHr: null,

    hrWeightedSum: 0,
    hrWeight: 0,

    cadenceWeightedSum: 0,
    cadenceWeight: 0,

    paceWeightedSum: 0,
    paceWeight: 0,
});

const toTrainingTypeTotals = (
    accumulator: TrainingTypeAccumulator
): TrainingTypeTotals => {
    const avgHr =
        accumulator.hrWeight > 0
            ? round1(accumulator.hrWeightedSum / accumulator.hrWeight)
            : null;

    const avgCadenceRpm =
        accumulator.cadenceWeight > 0
            ? round1(accumulator.cadenceWeightedSum / accumulator.cadenceWeight)
            : null;

    const avgPaceSecPerKm =
        accumulator.paceWeight > 0
            ? round1(accumulator.paceWeightedSum / accumulator.paceWeight)
            : null;

    return {
        type: accumulator.type,
        sessions: accumulator.sessions,

        totalDurationSeconds: accumulator.totalDurationSeconds,
        totalActiveKcal: accumulator.totalActiveKcal,
        totalKcal: accumulator.totalKcal,

        totalDistanceKm: accumulator.totalDistanceKm,
        totalSteps: accumulator.totalSteps,
        totalElevationGainM: accumulator.totalElevationGainM,

        avgHr,
        maxHr: accumulator.maxHr,

        avgPaceSecPerKm,
        avgCadenceRpm,
    };
};

/**
 * =========================================================
 * Totals + summaries
 * =========================================================
 */

export const computeTrainingTotals = (
    day: BuildableDayInput
): CalendarTotals => {
    const sessions = getTrainingSessions(day.training);

    if (!sessions || sessions.length === 0) {
        return buildEmptyCalendarTotals();
    }

    let totalSessions = 0;

    let totalDurationSeconds: NullableNumber = null;
    let totalActiveKcal: NullableNumber = null;
    let totalKcal: NullableNumber = null;

    let totalDistanceKm: NullableNumber = null;
    let totalSteps: NullableNumber = null;
    let totalElevationGainM: NullableNumber = null;

    let hrWeightedSum = 0;
    let hrWeight = 0;

    let cadenceWeightedSum = 0;
    let cadenceWeight = 0;

    let paceWeightedSum = 0;
    let paceWeight = 0;

    let maxHr: NullableNumber = null;

    for (const session of sessions) {
        totalSessions += 1;

        totalDurationSeconds = addNullable(
            totalDurationSeconds,
            session.durationSeconds ?? null
        );
        totalActiveKcal = addNullable(totalActiveKcal, session.activeKcal ?? null);
        totalKcal = addNullable(totalKcal, session.totalKcal ?? null);

        totalDistanceKm = addNullable(totalDistanceKm, session.distanceKm ?? null);
        totalSteps = addNullable(totalSteps, session.steps ?? null);
        totalElevationGainM = addNullable(
            totalElevationGainM,
            session.elevationGainM ?? null
        );

        if (isNumber(session.maxHr)) {
            maxHr = maxHr === null ? session.maxHr : Math.max(maxHr, session.maxHr);
        }

        if (isNumber(session.avgHr)) {
            const weight = isNumber(session.durationSeconds)
                ? session.durationSeconds
                : 0;

            if (weight > 0) {
                hrWeightedSum += session.avgHr * weight;
                hrWeight += weight;
            }
        }

        if (isNumber(session.cadenceRpm)) {
            const weight = isNumber(session.durationSeconds)
                ? session.durationSeconds
                : 0;

            if (weight > 0) {
                cadenceWeightedSum += session.cadenceRpm * weight;
                cadenceWeight += weight;
            }
        }

        if (isNumber(session.paceSecPerKm)) {
            const weight = isNumber(session.distanceKm) ? session.distanceKm : 0;

            if (weight > 0) {
                paceWeightedSum += session.paceSecPerKm * weight;
                paceWeight += weight;
            }
        }
    }

    const avgHr = hrWeight > 0 ? round1(hrWeightedSum / hrWeight) : null;
    const avgCadenceRpm =
        cadenceWeight > 0 ? round1(cadenceWeightedSum / cadenceWeight) : null;
    const avgPaceSecPerKm =
        paceWeight > 0 ? round1(paceWeightedSum / paceWeight) : null;

    return {
        totalSessions,

        totalDurationSeconds,
        totalActiveKcal,
        totalKcal,

        totalDistanceKm,
        totalSteps,
        totalElevationGainM,

        avgHr,
        maxHr,

        avgPaceSecPerKm,
        avgCadenceRpm,
    };
};

export const computeTrainingTypes = (
    day: BuildableDayInput
): TrainingTypeTotals[] => {
    const sessions = getTrainingSessions(day.training);
    if (!sessions || sessions.length === 0) return [];

    const accumulatorMap = new Map<string, TrainingTypeAccumulator>();

    for (const session of sessions) {
        const type = String(session.type ?? "Unknown");

        if (!accumulatorMap.has(type)) {
            accumulatorMap.set(type, createTrainingTypeAccumulator(type));
        }

        const accumulator = accumulatorMap.get(type);
        if (!accumulator) {
            continue;
        }

        accumulator.sessions += 1;

        accumulator.totalDurationSeconds = addNullable(
            accumulator.totalDurationSeconds,
            session.durationSeconds ?? null
        );
        accumulator.totalActiveKcal = addNullable(
            accumulator.totalActiveKcal,
            session.activeKcal ?? null
        );
        accumulator.totalKcal = addNullable(
            accumulator.totalKcal,
            session.totalKcal ?? null
        );

        accumulator.totalDistanceKm = addNullable(
            accumulator.totalDistanceKm,
            session.distanceKm ?? null
        );
        accumulator.totalSteps = addNullable(
            accumulator.totalSteps,
            session.steps ?? null
        );
        accumulator.totalElevationGainM = addNullable(
            accumulator.totalElevationGainM,
            session.elevationGainM ?? null
        );

        if (isNumber(session.maxHr)) {
            accumulator.maxHr =
                accumulator.maxHr === null
                    ? session.maxHr
                    : Math.max(accumulator.maxHr, session.maxHr);
        }

        if (isNumber(session.avgHr)) {
            const weight = isNumber(session.durationSeconds)
                ? session.durationSeconds
                : 0;

            if (weight > 0) {
                accumulator.hrWeightedSum += session.avgHr * weight;
                accumulator.hrWeight += weight;
            }
        }

        if (isNumber(session.cadenceRpm)) {
            const weight = isNumber(session.durationSeconds)
                ? session.durationSeconds
                : 0;

            if (weight > 0) {
                accumulator.cadenceWeightedSum += session.cadenceRpm * weight;
                accumulator.cadenceWeight += weight;
            }
        }

        if (isNumber(session.paceSecPerKm)) {
            const weight = isNumber(session.distanceKm) ? session.distanceKm : 0;

            if (weight > 0) {
                accumulator.paceWeightedSum += session.paceSecPerKm * weight;
                accumulator.paceWeight += weight;
            }
        }
    }

    const output = Array.from(accumulatorMap.values()).map((accumulator) =>
        toTrainingTypeTotals(accumulator)
    );

    output.sort((a, b) => {
        if (b.sessions !== a.sessions) {
            return b.sessions - a.sessions;
        }

        return a.type.localeCompare(b.type);
    });

    return output;
};

export const computeSleepSummary = (
    day: BuildableDayInput
): {
    timeAsleepMinutes: number | null;
    timeInBedMinutes: number | null;
    score: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;
} | null => {
    const sleep = day.sleep ?? null;
    if (!hasMeaningfulSleep(sleep)) return null;

    return {
        timeAsleepMinutes: sleep?.timeAsleepMinutes ?? null,
        timeInBedMinutes: sleep?.timeInBedMinutes ?? null,
        score: sleep?.score ?? null,
        awakeMinutes: sleep?.awakeMinutes ?? null,
        remMinutes: sleep?.remMinutes ?? null,
        coreMinutes: sleep?.coreMinutes ?? null,
        deepMinutes: sleep?.deepMinutes ?? null,
    };
};

export const computeTrainingSummary = (
    day: BuildableDayInput
): TrainingSummary | null => {
    const training = day.training ?? null;
    const sessions = getTrainingSessions(training);

    const hasSessionsArray = Array.isArray(sessions);
    const hasTrainingSessions = hasSessionsArray && sessions.length > 0;

    const hasAnyTrainingMeta =
        training?.dayEffortRpe != null || training?.source != null;

    if (!hasTrainingSessions && !hasAnyTrainingMeta) return null;

    return {
        source: training?.source ?? null,
        dayEffortRpe: training?.dayEffortRpe ?? null,
        sessionsCount: hasSessionsArray ? sessions.length : 0,
    };
};

/**
 * =========================================================
 * Fields picking
 * =========================================================
 */

export const DEFAULT_FIELDS_ALL = [
    "date",
    "weekKey",
    "hasSleep",
    "hasTraining",
    "sleep",
    "training",
    "notes",
    "tags",
    "meta",
    "plannedRoutine",
    "plannedMeta",
    "sleepSummary",
    "trainingSummary",
    "trainingTotals",
    "trainingTypes",
] as const;

export const pickFields = (
    obj: CalendarDayFull,
    fields: string[] | null
): CalendarDayFull => {
    const allowed = (fields ?? Array.from(DEFAULT_FIELDS_ALL)) as Array<
        keyof CalendarDayFull
    >;

    const output: CalendarDayFull = {};

    for (const key of allowed) {
        switch (key) {
            case "date":
                output.date = obj.date;
                break;
            case "weekKey":
                output.weekKey = obj.weekKey;
                break;
            case "hasSleep":
                output.hasSleep = obj.hasSleep;
                break;
            case "hasTraining":
                output.hasTraining = obj.hasTraining;
                break;
            case "hasPlanned":
                output.hasPlanned = obj.hasPlanned;
                break;
            case "sleep":
                output.sleep = obj.sleep;
                break;
            case "training":
                output.training = obj.training;
                break;
            case "plannedRoutine":
                output.plannedRoutine = obj.plannedRoutine;
                break;
            case "plannedMeta":
                output.plannedMeta = obj.plannedMeta;
                break;
            case "notes":
                output.notes = obj.notes;
                break;
            case "tags":
                output.tags = obj.tags;
                break;
            case "meta":
                output.meta = obj.meta;
                break;
            case "sleepSummary":
                output.sleepSummary = obj.sleepSummary;
                break;
            case "trainingSummary":
                output.trainingSummary = obj.trainingSummary;
                break;
            case "trainingTotals":
                output.trainingTotals = obj.trainingTotals;
                break;
            case "trainingTypes":
                output.trainingTypes = obj.trainingTypes;
                break;
            default:
                break;
        }
    }

    return output;
};

/**
 * =========================================================
 * Fill missing days
 * =========================================================
 */

const addDays = (iso: string, deltaDays: number): string => {
    const date = new Date(`${iso}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + deltaDays);
    return date.toISOString().slice(0, 10);
};

export const enumerateDays = (from: string, to: string): string[] => {
    const output: string[] = [];
    let currentDate = from;

    while (currentDate <= to) {
        output.push(currentDate);
        currentDate = addDays(currentDate, 1);
    }

    return output;
};

/**
 * =========================================================
 * Build day object (calendar/week) - pure
 * NOTE: service provides weekKey(date) function via callback.
 * =========================================================
 */

export const buildCalendarDay = (
    day: BuildableDayInput,
    opts: BuildOpts,
    getWeekKeyFromISODate: (isoDate: string) => string
): CalendarDayFull => {
    const sessions = getTrainingSessions(day.training);
    const hasTraining = Array.isArray(sessions) && sessions.length > 0;

    const hasSleep = hasMeaningfulSleep(day.sleep ?? null);
    const hasPlanned = hasMeaningfulPlannedRoutine(day.plannedRoutine ?? null);

    const sleepSummary = opts.includeSummaries
        ? computeSleepSummary(day)
        : undefined;

    const trainingSummary = opts.includeSummaries
        ? computeTrainingSummary(day)
        : undefined;

    const trainingTotals = opts.includeTotals
        ? computeTrainingTotals(day)
        : undefined;

    const trainingTypes = opts.includeTypes
        ? computeTrainingTypes(day)
        : undefined;

    const full: CalendarDayFull = {
        date: day.date,
        weekKey:
            day.weekKey ??
            (typeof day.date === "string" ? getWeekKeyFromISODate(day.date) : undefined),

        hasSleep,
        hasTraining,
        hasPlanned:
            typeof day.hasPlanned === "boolean" ? day.hasPlanned : hasPlanned,

        plannedRoutine: day.plannedRoutine ?? null,
        plannedMeta: day.plannedMeta ?? null,

        sleep: opts.includeSleep ? day.sleep ?? null : undefined,
        training: opts.includeTraining ? day.training ?? null : undefined,

        notes: day.notes ?? null,
        tags: day.tags ?? null,
        meta: day.meta ?? null,

        sleepSummary: sleepSummary ?? null,
        trainingSummary: trainingSummary ?? null,

        trainingTotals: trainingTotals ?? computeTrainingTotals(day),
        trainingTypes: trainingTypes ?? computeTrainingTypes(day),
    };

    if (!opts.includeRaw) {
        if (full.sleep) {
            full.sleep = {
                ...full.sleep,
                raw: null,
            };
        }

        if (full.training) {
            full.training = stripTrainingRawForOutput(full.training);
        }
    }

    if (!opts.includeSleep) {
        delete full.sleep;
    }

    if (!opts.includeTraining) {
        delete full.training;
    }

    if (!opts.includeSummaries) {
        delete full.sleepSummary;
        delete full.trainingSummary;
    }

    if (!opts.includeTotals) {
        delete full.trainingTotals;
    }

    if (!opts.includeTypes) {
        delete full.trainingTypes;
    }

    return full;
};

/**
 * =========================================================
 * Rollups (calendar/week) - pure
 * =========================================================
 */

export const rollupFromDays = (
    days: BuildableDayInput[],
    getWeekKeyFromISODate: (isoDate: string) => string
) => {
    let hrWeightedSum = 0;
    let hrWeight = 0;

    let cadenceWeightedSum = 0;
    let cadenceWeight = 0;

    let paceWeightedSum = 0;
    let paceWeight = 0;

    const totals: CalendarTotals = buildEmptyCalendarTotals();

    const typeAccumulatorMap = new Map<string, TrainingTypeAccumulator>();

    let daysWithSleep = 0;
    let sleepTimeSum = 0;
    let sleepTimeCount = 0;
    let sleepScoreSum = 0;
    let sleepScoreCount = 0;
    let awakeSum = 0;
    let awakeCount = 0;
    let remSum = 0;
    let remCount = 0;
    let coreSum = 0;
    let coreCount = 0;
    let deepSum = 0;
    let deepCount = 0;

    for (const day of days) {
        if (hasMeaningfulSleep(day.sleep ?? null) && day.sleep) {
            daysWithSleep += 1;

            if (day.sleep.timeAsleepMinutes != null) {
                sleepTimeSum += day.sleep.timeAsleepMinutes;
                sleepTimeCount += 1;
            }

            if (day.sleep.score != null) {
                sleepScoreSum += day.sleep.score;
                sleepScoreCount += 1;
            }

            if (day.sleep.awakeMinutes != null) {
                awakeSum += day.sleep.awakeMinutes;
                awakeCount += 1;
            }

            if (day.sleep.remMinutes != null) {
                remSum += day.sleep.remMinutes;
                remCount += 1;
            }

            if (day.sleep.coreMinutes != null) {
                coreSum += day.sleep.coreMinutes;
                coreCount += 1;
            }

            if (day.sleep.deepMinutes != null) {
                deepSum += day.sleep.deepMinutes;
                deepCount += 1;
            }
        }

        const sessions = getTrainingSessions(day.training);
        if (!sessions || sessions.length === 0) {
            continue;
        }

        for (const session of sessions) {
            totals.totalSessions += 1;

            totals.totalDurationSeconds = addNullable(
                totals.totalDurationSeconds,
                session.durationSeconds ?? null
            );
            totals.totalActiveKcal = addNullable(
                totals.totalActiveKcal,
                session.activeKcal ?? null
            );
            totals.totalKcal = addNullable(totals.totalKcal, session.totalKcal ?? null);

            totals.totalDistanceKm = addNullable(
                totals.totalDistanceKm,
                session.distanceKm ?? null
            );
            totals.totalSteps = addNullable(
                totals.totalSteps,
                session.steps ?? null
            );
            totals.totalElevationGainM = addNullable(
                totals.totalElevationGainM,
                session.elevationGainM ?? null
            );

            if (isNumber(session.maxHr)) {
                totals.maxHr =
                    totals.maxHr === null
                        ? session.maxHr
                        : Math.max(totals.maxHr, session.maxHr);
            }

            const durationWeight = isNumber(session.durationSeconds)
                ? session.durationSeconds
                : 0;

            if (isNumber(session.avgHr) && durationWeight > 0) {
                hrWeightedSum += session.avgHr * durationWeight;
                hrWeight += durationWeight;
            }

            if (isNumber(session.cadenceRpm) && durationWeight > 0) {
                cadenceWeightedSum += session.cadenceRpm * durationWeight;
                cadenceWeight += durationWeight;
            }

            const distanceWeight = isNumber(session.distanceKm)
                ? session.distanceKm
                : 0;

            if (isNumber(session.paceSecPerKm) && distanceWeight > 0) {
                paceWeightedSum += session.paceSecPerKm * distanceWeight;
                paceWeight += distanceWeight;
            }

            const type = String(session.type ?? "Unknown");

            if (!typeAccumulatorMap.has(type)) {
                typeAccumulatorMap.set(type, createTrainingTypeAccumulator(type));
            }

            const accumulator = typeAccumulatorMap.get(type);
            if (!accumulator) {
                continue;
            }

            accumulator.sessions += 1;

            accumulator.totalDurationSeconds = addNullable(
                accumulator.totalDurationSeconds,
                session.durationSeconds ?? null
            );
            accumulator.totalActiveKcal = addNullable(
                accumulator.totalActiveKcal,
                session.activeKcal ?? null
            );
            accumulator.totalKcal = addNullable(
                accumulator.totalKcal,
                session.totalKcal ?? null
            );

            accumulator.totalDistanceKm = addNullable(
                accumulator.totalDistanceKm,
                session.distanceKm ?? null
            );
            accumulator.totalSteps = addNullable(
                accumulator.totalSteps,
                session.steps ?? null
            );
            accumulator.totalElevationGainM = addNullable(
                accumulator.totalElevationGainM,
                session.elevationGainM ?? null
            );

            if (isNumber(session.maxHr)) {
                accumulator.maxHr =
                    accumulator.maxHr === null
                        ? session.maxHr
                        : Math.max(accumulator.maxHr, session.maxHr);
            }

            if (isNumber(session.avgHr) && durationWeight > 0) {
                accumulator.hrWeightedSum += session.avgHr * durationWeight;
                accumulator.hrWeight += durationWeight;
            }

            if (isNumber(session.cadenceRpm) && durationWeight > 0) {
                accumulator.cadenceWeightedSum += session.cadenceRpm * durationWeight;
                accumulator.cadenceWeight += durationWeight;
            }

            if (isNumber(session.paceSecPerKm) && distanceWeight > 0) {
                accumulator.paceWeightedSum += session.paceSecPerKm * distanceWeight;
                accumulator.paceWeight += distanceWeight;
            }
        }
    }

    totals.avgHr = hrWeight > 0 ? round1(hrWeightedSum / hrWeight) : null;
    totals.avgCadenceRpm =
        cadenceWeight > 0 ? round1(cadenceWeightedSum / cadenceWeight) : null;
    totals.avgPaceSecPerKm =
        paceWeight > 0 ? round1(paceWeightedSum / paceWeight) : null;

    const trainingTypes = Array.from(typeAccumulatorMap.values())
        .map((accumulator) => toTrainingTypeTotals(accumulator))
        .sort((a, b) => {
            if (b.sessions !== a.sessions) {
                return b.sessions - a.sessions;
            }

            return a.type.localeCompare(b.type);
        });

    const sleepAverages = {
        daysWithSleep,
        avgTimeAsleepMinutes: safeAvg(sleepTimeSum, sleepTimeCount),
        avgScore: safeAvg(sleepScoreSum, sleepScoreCount),
        avgAwakeMinutes: safeAvg(awakeSum, awakeCount),
        avgRemMinutes: safeAvg(remSum, remCount),
        avgCoreMinutes: safeAvg(coreSum, coreCount),
        avgDeepMinutes: safeAvg(deepSum, deepCount),
    };

    void getWeekKeyFromISODate;

    return {
        trainingTotals: totals,
        trainingTypes,
        sleepAverages,
    };
};

/**
 * =========================================================
 * Week parsing helpers
 * =========================================================
 */

const WEEK_KEY_REGEX = /^(\d{4})-W(\d{2})$/;

export const parseWeekKey = (weekKey: string): { year: number; week: number } => {
    const match = WEEK_KEY_REGEX.exec(weekKey);

    if (!match) {
        throw new Error(`Invalid weekKey "${weekKey}". Expected format: YYYY-W##`);
    }

    const year = Number(match[1]);
    const week = Number(match[2]);

    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
        throw new Error(`Invalid weekKey "${weekKey}". Week must be 01..53`);
    }

    return { year, week };
};

// ISO week start (Monday) for a given year/week in UTC
export const isoWeekStart = (year: number, week: number): Date => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);

    mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));

    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

    return monday;
};

export const toISODate = (date: Date): string => date.toISOString().slice(0, 10);

export const getWeekRangeFromKey = (weekKey: string): WeekRange => {
    const { year, week } = parseWeekKey(weekKey);
    const start = isoWeekStart(year, week);
    const end = new Date(start);

    end.setUTCDate(start.getUTCDate() + 6);

    return {
        from: toISODate(start),
        to: toISODate(end),
    };
};