// src/services/workoutDay.service.ts
// Service for WorkoutDay read/upsert/backfill flows.

import mongoose from "mongoose";

import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { assertMovementsExist } from "./movement.service";

import {
    DEFAULT_FIELDS_ALL,
    buildCalendarDay,
    enumerateDays,
    getWeekRangeFromKey,
    pickFields,
    rollupFromDays,
} from "../utils/workoutDayBuilders";
import { getWeekKeyFromISODate } from "../utils/weekKey";

import type {
    BuildOpts,
    CalendarDayFull,
    Exercise,
    ExerciseSet,
    MediaItem,
    PlannedMeta,
    PlannedRoutine,
    PlannedRoutineExercise,
    SleepBlock,
    StatsRangeArgs,
    TrainingBlock,
    TrainingSession,
    TrainingSessionMeta,
    UpsertArgs,
    WeekViewResponse,
    WorkoutDataSource,
    WorkoutDayBackfillBody,
    WorkoutDayBackfillItemResult,
    WorkoutDayBackfillResult,
    WorkoutSessionDataSource,
    WorkoutSessionKind,
} from "../types/workoutDay.types";
import type {
    CardioEnvironment,
    CardioActivityType,
    WorkoutHealthWriteStatus,
    WorkoutCardioMetrics,
    WorkoutRoutePoint,
    WorkoutRouteSummary,
} from "../types/cardioSession.types";

type WorkoutDayUpsertPayload = UpsertArgs["payload"];

type WorkoutDayCreateInput = {
    userId: mongoose.Types.ObjectId;
    date: string;
    weekKey: string;
    sleep: SleepBlock | null;
    training: TrainingBlock | null;
    plannedRoutine: PlannedRoutine | null;
    plannedMeta: PlannedMeta | null;
    notes: string | null;
    tags: string[] | null;
    meta: Record<string, unknown> | null;
};

type CalendarRangeResponse = {
    from: string;
    to: string;
    fields: string[] | null;
    fillMissingDays: boolean;
    days: CalendarDayFull[];
    rollups?: ReturnType<typeof rollupFromDays>;
};

type PlainObject = Record<string, unknown>;
type TrainingBlockInput = WorkoutDayUpsertPayload["training"];
type SleepBlockInput = WorkoutDayUpsertPayload["sleep"];

const safeAvg = (sum: number, count: number): number | null => {
    if (count <= 0) return null;
    return sum / count;
};

const safeSumOrNull = (sum: number, count: number): number | null => {
    return count > 0 ? sum : null;
};

const isPlainObject = (value: unknown): value is PlainObject => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const hasOwn = (obj: unknown, key: string): boolean => {
    return isPlainObject(obj) && Object.prototype.hasOwnProperty.call(obj, key);
};

const isFiniteNumber = (value: unknown): value is number => {
    return typeof value === "number" && Number.isFinite(value);
};

const toNullableNumber = (value: unknown): number | null => {
    return isFiniteNumber(value) ? value : null;
};

const toNullableString = (value: unknown): string | null => {
    return typeof value === "string" ? value : null;
};

const toNullableBoolean = (value: unknown): boolean | null => {
    return typeof value === "boolean" ? value : null;
};

const toNullableStringArray = (value: unknown): string[] | null => {
    if (value === null) return null;
    if (!Array.isArray(value)) return null;

    const out = value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item) => item.length > 0);

    return out;
};

const toNullableMeta = (value: unknown): Record<string, unknown> | null => {
    if (value === null) return null;
    return isPlainObject(value) ? value : null;
};

const toNullableWorkoutDataSource = (value: unknown): WorkoutDataSource | null => {
    return value === "manual" || value === "healthkit" || value === "health-connect"
        ? value
        : null;
};

const toNullableWorkoutSessionDataSource = (
    value: unknown
): WorkoutSessionDataSource | null => {
    return value === "manual" ||
        value === "healthkit" ||
        value === "health-connect" ||
        value === "app-live"
        ? value
        : null;
};

const toNullableWorkoutSessionKind = (value: unknown): WorkoutSessionKind | null => {
    return value === "device-import" ||
        value === "gym-check" ||
        value === "manual-cardio" ||
        value === "live-cardio"
        ? value
        : null;
};

const toNullableCardioActivityType = (value: unknown): CardioActivityType | null => {
    return value === "walking" || value === "running" ? value : null;
};

const toNullableCardioEnvironment = (value: unknown): CardioEnvironment | null => {
    return value === "outdoor" || value === "indoor" ? value : null;
};

const toNullableWorkoutHealthWriteStatus = (
    value: unknown
): WorkoutHealthWriteStatus | null => {
    return value === "pending" || value === "synced" || value === "failed"
        ? value
        : null;
};

const toExerciseSetUnit = (value: unknown): "lb" | "kg" => {
    return value === "kg" ? "kg" : "lb";
};

const readMergedScalar = <T>(incoming: unknown, key: string, currentValue: T): T => {
    if (!hasOwn(incoming, key)) {
        return currentValue;
    }

    return (incoming as PlainObject)[key] as T;
};

const normalizeMediaItem = (value: unknown): MediaItem | null => {
    if (!isPlainObject(value)) return null;

    const publicId = toNullableString(value.publicId);
    const url = toNullableString(value.url);
    const resourceType = value.resourceType === "video" ? "video" : "image";

    if (!publicId || !url) return null;

    return {
        publicId,
        url,
        resourceType,
        format: toNullableString(value.format),
        createdAt: toNullableString(value.createdAt) ?? "",
        meta: toNullableMeta(value.meta),
    };
};

const normalizeExerciseSet = (value: unknown, fallbackIndex: number): ExerciseSet | null => {
    if (!isPlainObject(value)) return null;

    return {
        setIndex: isFiniteNumber(value.setIndex) ? Math.trunc(value.setIndex) : fallbackIndex,
        reps: toNullableNumber(value.reps),
        weight: toNullableNumber(value.weight),
        unit: toExerciseSetUnit(value.unit),
        rpe: toNullableNumber(value.rpe),
        isWarmup: value.isWarmup === true,
        isDropSet: value.isDropSet === true,
        tempo: toNullableString(value.tempo),
        restSec: toNullableNumber(value.restSec),
        tags: toNullableStringArray(value.tags),
        meta: toNullableMeta(value.meta),
    };
};

const normalizeExercise = (value: unknown): Exercise | null => {
    if (!isPlainObject(value)) return null;

    const id = toNullableString(value.id) ?? toNullableString(value._id);
    const name = toNullableString(value.name);

    if (!id || !name) return null;

    const rawSets = Array.isArray(value.sets) ? value.sets : null;
    const sets =
        rawSets === null
            ? null
            : rawSets
                .map((item, index) => normalizeExerciseSet(item, index + 1))
                .filter((item): item is ExerciseSet => item !== null);

    return {
        id,
        name,
        movementId: toNullableString(value.movementId),
        movementName: toNullableString(value.movementName),
        notes: toNullableString(value.notes),
        sets,
        meta: toNullableMeta(value.meta),
    };
};

const normalizeTrainingSessionMeta = (value: unknown): TrainingSessionMeta | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    return {
        sessionKey: toNullableString(value.sessionKey),
        trainingSource: toNullableString(value.trainingSource),
        dayEffortRpe: toNullableNumber(value.dayEffortRpe),

        source: toNullableWorkoutSessionDataSource(value.source),
        sourceDevice: toNullableString(value.sourceDevice),
        importedAt: toNullableString(value.importedAt),
        lastSyncedAt: toNullableString(value.lastSyncedAt),
        sessionKind: toNullableWorkoutSessionKind(value.sessionKind),

        healthWriteStatus: toNullableWorkoutHealthWriteStatus(value.healthWriteStatus),
        healthExternalId: toNullableString(value.healthExternalId),
        healthWrittenAt: toNullableString(value.healthWrittenAt),

        externalId: toNullableString(value.externalId),
        originalType: toNullableString(value.originalType),
        provider: toNullableString(value.provider),
    };
};

const normalizeWorkoutCardioMetrics = (value: unknown): WorkoutCardioMetrics | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    return {
        distanceKm: toNullableNumber(value.distanceKm),
        steps: toNullableNumber(value.steps),
        elevationGainM: toNullableNumber(value.elevationGainM),

        paceSecPerKm: toNullableNumber(value.paceSecPerKm),
        avgSpeedKmh: toNullableNumber(value.avgSpeedKmh),
        maxSpeedKmh: toNullableNumber(value.maxSpeedKmh),

        cadenceRpm: toNullableNumber(value.cadenceRpm),
        strideLengthM: toNullableNumber(value.strideLengthM),
    };
};

const normalizeWorkoutRouteSummary = (value: unknown): WorkoutRouteSummary | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    const pointCount = toNullableNumber(value.pointCount);
    if (pointCount === null) {
        return null;
    }

    return {
        pointCount: Math.max(0, Math.trunc(pointCount)),

        startLatitude: toNullableNumber(value.startLatitude),
        startLongitude: toNullableNumber(value.startLongitude),

        endLatitude: toNullableNumber(value.endLatitude),
        endLongitude: toNullableNumber(value.endLongitude),

        minLatitude: toNullableNumber(value.minLatitude),
        maxLatitude: toNullableNumber(value.maxLatitude),

        minLongitude: toNullableNumber(value.minLongitude),
        maxLongitude: toNullableNumber(value.maxLongitude),
    };
};

const normalizeWorkoutRoutePoint = (value: unknown): WorkoutRoutePoint | null => {
    if (!isPlainObject(value)) return null;

    const latitude = toNullableNumber(value.latitude);
    const longitude = toNullableNumber(value.longitude);

    if (latitude === null || longitude === null) {
        return null;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return null;
    }

    const headingDeg = toNullableNumber(value.headingDeg);

    return {
        latitude,
        longitude,
        altitudeM: toNullableNumber(value.altitudeM),
        accuracyM: toNullableNumber(value.accuracyM),
        speedMps: toNullableNumber(value.speedMps),
        headingDeg:
            headingDeg === null ? null : Math.min(360, Math.max(0, headingDeg)),
        recordedAt: toNullableString(value.recordedAt),
    };
};

const normalizeWorkoutRoutePoints = (value: unknown): WorkoutRoutePoint[] | null => {
    if (value === null) return null;
    if (!Array.isArray(value)) return null;

    const normalized = value
        .map((item) => normalizeWorkoutRoutePoint(item))
        .filter((item): item is WorkoutRoutePoint => item !== null);

    return normalized.length > 0 ? normalized : null;
};

const normalizeTrainingSession = (value: unknown): TrainingSession | null => {
    if (!isPlainObject(value)) return null;

    const id = toNullableString(value.id) ?? toNullableString(value._id);
    const type = toNullableString(value.type);

    if (!id || !type) return null;

    const mediaRaw = Array.isArray(value.media) ? value.media : null;
    const exercisesRaw = Array.isArray(value.exercises) ? value.exercises : null;

    return {
        id,
        type,
        activityType: toNullableCardioActivityType(value.activityType),
        cardioEnvironment: toNullableCardioEnvironment(value.cardioEnvironment),
        startAt: toNullableString(value.startAt),
        endAt: toNullableString(value.endAt),
        durationSeconds: toNullableNumber(value.durationSeconds),
        activeKcal: toNullableNumber(value.activeKcal),
        totalKcal: toNullableNumber(value.totalKcal),
        avgHr: toNullableNumber(value.avgHr),
        maxHr: toNullableNumber(value.maxHr),
        distanceKm: toNullableNumber(value.distanceKm),
        steps: toNullableNumber(value.steps),
        elevationGainM: toNullableNumber(value.elevationGainM),
        paceSecPerKm: toNullableNumber(value.paceSecPerKm),
        cadenceRpm: toNullableNumber(value.cadenceRpm),
        hasRoute: toNullableBoolean(value.hasRoute) ?? false,
        cardioMetrics: normalizeWorkoutCardioMetrics(value.cardioMetrics),
        routeSummary: normalizeWorkoutRouteSummary(value.routeSummary),
        routePoints: normalizeWorkoutRoutePoints(value.routePoints),
        effortRpe: toNullableNumber(value.effortRpe),
        notes: toNullableString(value.notes),
        meta: normalizeTrainingSessionMeta(value.meta),
        media:
            mediaRaw === null
                ? null
                : mediaRaw
                    .map((item) => normalizeMediaItem(item))
                    .filter((item): item is MediaItem => item !== null),
        exercises:
            exercisesRaw === null
                ? null
                : exercisesRaw
                    .map((item) => normalizeExercise(item))
                    .filter((item): item is Exercise => item !== null),
    };
};

const normalizeTrainingSessions = (value: unknown): TrainingSession[] | null => {
    if (value === null) return null;
    if (!Array.isArray(value)) return null;

    return value
        .map((item) => normalizeTrainingSession(item))
        .filter((item): item is TrainingSession => item !== null);
};

const normalizeTrainingBlock = (value: unknown): TrainingBlock | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    return {
        sessions: normalizeTrainingSessions(value.sessions),
        source: toNullableWorkoutDataSource(value.source),
        dayEffortRpe: toNullableNumber(value.dayEffortRpe),
        raw: value.raw ?? null,
    };
};

const normalizeSleepBlock = (value: unknown): SleepBlock | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    return {
        timeAsleepMinutes: toNullableNumber(value.timeAsleepMinutes),
        timeInBedMinutes: toNullableNumber(value.timeInBedMinutes),
        score: toNullableNumber(value.score),
        awakeMinutes: toNullableNumber(value.awakeMinutes),
        remMinutes: toNullableNumber(value.remMinutes),
        coreMinutes: toNullableNumber(value.coreMinutes),
        deepMinutes: toNullableNumber(value.deepMinutes),
        source: toNullableWorkoutDataSource(value.source),
        sourceDevice: toNullableString(value.sourceDevice),
        importedAt: toNullableString(value.importedAt),
        lastSyncedAt: toNullableString(value.lastSyncedAt),
        raw: value.raw ?? null,
    };
};

const normalizePlannedRoutineExercise = (value: unknown): PlannedRoutineExercise | null => {
    if (!isPlainObject(value)) return null;

    const id = toNullableString(value.id);
    const name = toNullableString(value.name);

    if (!id || !name) return null;

    return {
        id,
        name,
        movementId: toNullableString(value.movementId),
        movementName: toNullableString(value.movementName),
        sets: toNullableNumber(value.sets),
        reps: toNullableString(value.reps),
        rpe: toNullableNumber(value.rpe),
        load: toNullableString(value.load),
        notes: toNullableString(value.notes),
        attachmentPublicIds: toNullableStringArray(value.attachmentPublicIds),
    };
};

const normalizePlannedRoutine = (value: unknown): PlannedRoutine | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    const exercisesRaw = Array.isArray(value.exercises) ? value.exercises : null;

    return {
        sessionType: toNullableString(value.sessionType),
        focus: toNullableString(value.focus),
        exercises:
            exercisesRaw === null
                ? null
                : exercisesRaw
                    .map((item) => normalizePlannedRoutineExercise(item))
                    .filter((item): item is PlannedRoutineExercise => item !== null),
        notes: toNullableString(value.notes),
        tags: toNullableStringArray(value.tags),
    };
};

const normalizePlannedMeta = (value: unknown): PlannedMeta | null => {
    if (value === null) return null;
    if (!isPlainObject(value)) return null;

    const plannedByRaw = value.plannedBy;
    const plannedBy =
        typeof plannedByRaw === "string"
            ? plannedByRaw
            : isPlainObject(plannedByRaw) && typeof plannedByRaw.toString === "function"
                ? plannedByRaw.toString()
                : plannedByRaw instanceof mongoose.Types.ObjectId
                    ? plannedByRaw.toString()
                    : typeof plannedByRaw?.toString === "function"
                        ? plannedByRaw.toString()
                        : null;

    const plannedAt = toNullableString(value.plannedAt);

    if (!plannedBy || !plannedAt) return null;

    return {
        plannedBy,
        plannedAt,
        source: value.source === "trainer" || value.source === "template" ? value.source : null,
    };
};

const normalizeCalendarDayFull = (value: unknown): CalendarDayFull => {
    if (!isPlainObject(value)) {
        return {};
    }

    return {
        date: toNullableString(value.date) ?? undefined,
        weekKey: toNullableString(value.weekKey) ?? undefined,
        hasSleep: typeof value.hasSleep === "boolean" ? value.hasSleep : undefined,
        hasTraining: typeof value.hasTraining === "boolean" ? value.hasTraining : undefined,
        hasPlanned: typeof value.hasPlanned === "boolean" ? value.hasPlanned : undefined,
        sleep: hasOwn(value, "sleep") ? normalizeSleepBlock(value.sleep) : undefined,
        training: hasOwn(value, "training") ? normalizeTrainingBlock(value.training) : undefined,
        plannedRoutine: hasOwn(value, "plannedRoutine")
            ? normalizePlannedRoutine(value.plannedRoutine)
            : undefined,
        plannedMeta: hasOwn(value, "plannedMeta") ? normalizePlannedMeta(value.plannedMeta) : undefined,
        notes: hasOwn(value, "notes") ? toNullableString(value.notes) : undefined,
        tags: hasOwn(value, "tags") ? toNullableStringArray(value.tags) : undefined,
        meta: hasOwn(value, "meta") ? toNullableMeta(value.meta) : undefined,
        sleepSummary:
            hasOwn(value, "sleepSummary") && isPlainObject(value.sleepSummary)
                ? {
                    timeAsleepMinutes: toNullableNumber(value.sleepSummary.timeAsleepMinutes),
                    timeInBedMinutes: toNullableNumber(value.sleepSummary.timeInBedMinutes),
                    score: toNullableNumber(value.sleepSummary.score),
                    awakeMinutes: toNullableNumber(value.sleepSummary.awakeMinutes),
                    remMinutes: toNullableNumber(value.sleepSummary.remMinutes),
                    coreMinutes: toNullableNumber(value.sleepSummary.coreMinutes),
                    deepMinutes: toNullableNumber(value.sleepSummary.deepMinutes),
                }
                : undefined,
        trainingSummary:
            hasOwn(value, "trainingSummary") && isPlainObject(value.trainingSummary)
                ? {
                    source: toNullableWorkoutDataSource(value.trainingSummary.source),
                    dayEffortRpe: toNullableNumber(value.trainingSummary.dayEffortRpe),
                    sessionsCount: toNullableNumber(value.trainingSummary.sessionsCount) ?? 0,
                }
                : undefined,
        trainingTotals:
            hasOwn(value, "trainingTotals") && isPlainObject(value.trainingTotals)
                ? {
                    totalSessions: toNullableNumber(value.trainingTotals.totalSessions) ?? 0,
                    totalDurationSeconds: toNullableNumber(value.trainingTotals.totalDurationSeconds),
                    totalActiveKcal: toNullableNumber(value.trainingTotals.totalActiveKcal),
                    totalKcal: toNullableNumber(value.trainingTotals.totalKcal),
                    totalDistanceKm: toNullableNumber(value.trainingTotals.totalDistanceKm),
                    totalSteps: toNullableNumber(value.trainingTotals.totalSteps),
                    totalElevationGainM: toNullableNumber(value.trainingTotals.totalElevationGainM),
                    avgHr: toNullableNumber(value.trainingTotals.avgHr),
                    maxHr: toNullableNumber(value.trainingTotals.maxHr),
                    avgPaceSecPerKm: toNullableNumber(value.trainingTotals.avgPaceSecPerKm),
                    avgCadenceRpm: toNullableNumber(value.trainingTotals.avgCadenceRpm),
                }
                : undefined,
        trainingTypes:
            hasOwn(value, "trainingTypes") && Array.isArray(value.trainingTypes)
                ? value.trainingTypes
                    .filter((item): item is PlainObject => isPlainObject(item))
                    .map((item) => ({
                        type: toNullableString(item.type) ?? "",
                        sessions: toNullableNumber(item.sessions) ?? 0,
                        totalDurationSeconds: toNullableNumber(item.totalDurationSeconds),
                        totalActiveKcal: toNullableNumber(item.totalActiveKcal),
                        totalKcal: toNullableNumber(item.totalKcal),
                        totalDistanceKm: toNullableNumber(item.totalDistanceKm),
                        totalSteps: toNullableNumber(item.totalSteps),
                        totalElevationGainM: toNullableNumber(item.totalElevationGainM),
                        avgHr: toNullableNumber(item.avgHr),
                        maxHr: toNullableNumber(item.maxHr),
                        avgPaceSecPerKm: toNullableNumber(item.avgPaceSecPerKm),
                        avgCadenceRpm: toNullableNumber(item.avgCadenceRpm),
                    }))
                : undefined,
    };
};

const buildCanonicalDefaults = (
    userObjectId: mongoose.Types.ObjectId,
    date: string
): WorkoutDayCreateInput => {
    const weekKey = getWeekKeyFromISODate(date);

    return {
        userId: userObjectId,
        date,
        weekKey,
        sleep: null,
        training: null,
        plannedRoutine: null,
        plannedMeta: null,
        notes: null,
        tags: null,
        meta: null,
    };
};

const mergeTrainingBlock = (
    existing: unknown,
    incoming: TrainingBlockInput | undefined
): TrainingBlock | null => {
    const normalizedExisting = normalizeTrainingBlock(existing);

    if (incoming === undefined) return normalizedExisting;
    if (incoming === null) return null;
    if (!isPlainObject(incoming)) return normalizedExisting;

    const currentSessions = normalizedExisting?.sessions ?? null;
    const currentSource = normalizedExisting?.source ?? null;
    const currentDayEffortRpe = normalizedExisting?.dayEffortRpe ?? null;
    const currentRaw = normalizedExisting?.raw ?? null;

    const nextSessions = hasOwn(incoming, "sessions")
        ? normalizeTrainingSessions(readMergedScalar(incoming, "sessions", null))
        : currentSessions;

    const nextSource = hasOwn(incoming, "source")
        ? toNullableWorkoutDataSource(readMergedScalar(incoming, "source", null))
        : currentSource;

    const nextDayEffortRpe = hasOwn(incoming, "dayEffortRpe")
        ? toNullableNumber(readMergedScalar(incoming, "dayEffortRpe", null))
        : currentDayEffortRpe;

    const nextRaw = hasOwn(incoming, "raw")
        ? readMergedScalar(incoming, "raw", null)
        : currentRaw;

    return {
        sessions: nextSessions,
        source: nextSource,
        dayEffortRpe: nextDayEffortRpe,
        raw: nextRaw,
    };
};

const mergeSleepBlock = (
    existing: unknown,
    incoming: SleepBlockInput | undefined
): SleepBlock | null => {
    const normalizedExisting = normalizeSleepBlock(existing);

    if (incoming === undefined) return normalizedExisting;
    if (incoming === null) return null;
    if (!isPlainObject(incoming)) return normalizedExisting;

    return {
        timeAsleepMinutes: hasOwn(incoming, "timeAsleepMinutes")
            ? toNullableNumber(readMergedScalar(incoming, "timeAsleepMinutes", null))
            : normalizedExisting?.timeAsleepMinutes ?? null,
        timeInBedMinutes: hasOwn(incoming, "timeInBedMinutes")
            ? toNullableNumber(readMergedScalar(incoming, "timeInBedMinutes", null))
            : normalizedExisting?.timeInBedMinutes ?? null,
        score: hasOwn(incoming, "score")
            ? toNullableNumber(readMergedScalar(incoming, "score", null))
            : normalizedExisting?.score ?? null,
        awakeMinutes: hasOwn(incoming, "awakeMinutes")
            ? toNullableNumber(readMergedScalar(incoming, "awakeMinutes", null))
            : normalizedExisting?.awakeMinutes ?? null,
        remMinutes: hasOwn(incoming, "remMinutes")
            ? toNullableNumber(readMergedScalar(incoming, "remMinutes", null))
            : normalizedExisting?.remMinutes ?? null,
        coreMinutes: hasOwn(incoming, "coreMinutes")
            ? toNullableNumber(readMergedScalar(incoming, "coreMinutes", null))
            : normalizedExisting?.coreMinutes ?? null,
        deepMinutes: hasOwn(incoming, "deepMinutes")
            ? toNullableNumber(readMergedScalar(incoming, "deepMinutes", null))
            : normalizedExisting?.deepMinutes ?? null,
        source: hasOwn(incoming, "source")
            ? toNullableWorkoutDataSource(readMergedScalar(incoming, "source", null))
            : normalizedExisting?.source ?? null,
        sourceDevice: hasOwn(incoming, "sourceDevice")
            ? toNullableString(readMergedScalar(incoming, "sourceDevice", null))
            : normalizedExisting?.sourceDevice ?? null,
        importedAt: hasOwn(incoming, "importedAt")
            ? toNullableString(readMergedScalar(incoming, "importedAt", null))
            : normalizedExisting?.importedAt ?? null,
        lastSyncedAt: hasOwn(incoming, "lastSyncedAt")
            ? toNullableString(readMergedScalar(incoming, "lastSyncedAt", null))
            : normalizedExisting?.lastSyncedAt ?? null,
        raw: hasOwn(incoming, "raw")
            ? readMergedScalar(incoming, "raw", null)
            : normalizedExisting?.raw ?? null,
    };
};

const mergePlannedRoutine = (
    existing: unknown,
    incoming: WorkoutDayUpsertPayload["plannedRoutine"] | undefined
): PlannedRoutine | null => {
    const normalizedExisting = normalizePlannedRoutine(existing);

    if (incoming === undefined) return normalizedExisting;
    if (incoming === null) return null;

    return normalizePlannedRoutine(incoming);
};

const mergePlannedMeta = (
    existing: unknown,
    incoming: WorkoutDayUpsertPayload["plannedMeta"] | undefined
): PlannedMeta | null => {
    const normalizedExisting = normalizePlannedMeta(existing);

    if (incoming === undefined) return normalizedExisting;
    if (incoming === null) return null;

    return normalizePlannedMeta(incoming);
};

const mergeNotes = (existing: unknown, incoming: WorkoutDayUpsertPayload["notes"] | undefined): string | null => {
    const normalizedExisting = toNullableString(existing);

    if (incoming === undefined) return normalizedExisting;
    return incoming;
};

const mergeTags = (existing: unknown, incoming: WorkoutDayUpsertPayload["tags"] | undefined): string[] | null => {
    const normalizedExisting = toNullableStringArray(existing);

    if (incoming === undefined) return normalizedExisting;
    return incoming;
};

const mergeMeta = (
    existing: unknown,
    incoming: WorkoutDayUpsertPayload["meta"] | undefined
): Record<string, unknown> | null => {
    const normalizedExisting = toNullableMeta(existing);

    if (incoming === undefined) return normalizedExisting;
    if (incoming === null) return null;

    return {
        ...(normalizedExisting ?? {}),
        ...incoming,
    };
};

const applyFullReplace = (
    userObjectId: mongoose.Types.ObjectId,
    date: string,
    payload: WorkoutDayUpsertPayload
): WorkoutDayCreateInput => {
    const base = buildCanonicalDefaults(userObjectId, date);

    const out: WorkoutDayCreateInput = { ...base };

    if (hasOwn(payload, "sleep")) out.sleep = normalizeSleepBlock(payload.sleep);
    if (hasOwn(payload, "training")) out.training = normalizeTrainingBlock(payload.training);
    if (hasOwn(payload, "plannedRoutine")) out.plannedRoutine = normalizePlannedRoutine(payload.plannedRoutine);
    if (hasOwn(payload, "plannedMeta")) out.plannedMeta = normalizePlannedMeta(payload.plannedMeta);
    if (hasOwn(payload, "notes")) out.notes = payload.notes ?? null;
    if (hasOwn(payload, "tags")) out.tags = payload.tags ?? null;
    if (hasOwn(payload, "meta")) out.meta = payload.meta ?? null;

    out.weekKey = getWeekKeyFromISODate(date);

    return out;
};

const applyMerge = (
    existing: {
        sleep: unknown;
        training: unknown;
        plannedRoutine: unknown;
        plannedMeta: unknown;
        notes: unknown;
        tags: unknown;
        meta: unknown;
    },
    payload: WorkoutDayUpsertPayload
) => {
    return {
        sleep: mergeSleepBlock(existing.sleep, payload.sleep),
        training: mergeTrainingBlock(existing.training, payload.training),
        plannedRoutine: mergePlannedRoutine(existing.plannedRoutine, payload.plannedRoutine),
        plannedMeta: mergePlannedMeta(existing.plannedMeta, payload.plannedMeta),
        notes: mergeNotes(existing.notes, payload.notes),
        tags: mergeTags(existing.tags, payload.tags),
        meta: mergeMeta(existing.meta, payload.meta),
    };
};

const collectMovementIdsFromPayload = (payload: WorkoutDayUpsertPayload): string[] => {
    const ids: string[] = [];

    const sessions = payload.training?.sessions;
    if (!Array.isArray(sessions)) return ids;

    for (const session of sessions) {
        const exercises = session.exercises;
        if (!Array.isArray(exercises)) continue;

        for (const exercise of exercises) {
            const movementId = exercise.movementId;
            if (typeof movementId === "string" && movementId.trim()) {
                ids.push(movementId.trim());
            }
        }
    }

    return ids;
};

const buildCalendarFallbackDay = (date: string): CalendarDayFull => {
    return {
        date,
        weekKey: getWeekKeyFromISODate(date),
        sleep: null,
        training: null,
        plannedRoutine: null,
        plannedMeta: null,
        notes: null,
        tags: null,
        meta: null,
    };
};

export const getStatsInRange = async ({ userId, from, to }: StatsRangeArgs) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const days = await WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: from, $lte: to },
    })
        .sort({ date: 1 })
        .lean();

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

    let totalSessions = 0;
    let daysWithTraining = 0;

    let dayEffortSum = 0;
    let dayEffortCount = 0;

    let activeKcalSum = 0;
    let activeKcalCount = 0;

    let distanceKmSum = 0;
    let distanceKmCount = 0;

    let avgHrSum = 0;
    let avgHrCount = 0;

    let maxHrSum = 0;
    let maxHrCount = 0;

    for (const rawDay of days) {
        const day = normalizeCalendarDayFull(rawDay);

        if (day.sleep) {
            const hasAnySleepValue =
                day.sleep.timeAsleepMinutes != null ||
                day.sleep.score != null ||
                day.sleep.awakeMinutes != null ||
                day.sleep.remMinutes != null ||
                day.sleep.coreMinutes != null ||
                day.sleep.deepMinutes != null;

            if (hasAnySleepValue) daysWithSleep++;

            if (day.sleep.timeAsleepMinutes != null) {
                sleepTimeSum += day.sleep.timeAsleepMinutes;
                sleepTimeCount++;
            }
            if (day.sleep.score != null) {
                sleepScoreSum += day.sleep.score;
                sleepScoreCount++;
            }
            if (day.sleep.awakeMinutes != null) {
                awakeSum += day.sleep.awakeMinutes;
                awakeCount++;
            }
            if (day.sleep.remMinutes != null) {
                remSum += day.sleep.remMinutes;
                remCount++;
            }
            if (day.sleep.coreMinutes != null) {
                coreSum += day.sleep.coreMinutes;
                coreCount++;
            }
            if (day.sleep.deepMinutes != null) {
                deepSum += day.sleep.deepMinutes;
                deepCount++;
            }
        }

        const sessions = day.training?.sessions ?? null;

        if (sessions && sessions.length > 0) {
            daysWithTraining++;
            totalSessions += sessions.length;

            if (day.training?.dayEffortRpe != null) {
                dayEffortSum += day.training.dayEffortRpe;
                dayEffortCount++;
            }

            for (const session of sessions) {
                if (session.activeKcal != null) {
                    activeKcalSum += session.activeKcal;
                    activeKcalCount++;
                }
                if (session.distanceKm != null) {
                    distanceKmSum += session.distanceKm;
                    distanceKmCount++;
                }
                if (session.avgHr != null) {
                    avgHrSum += session.avgHr;
                    avgHrCount++;
                }
                if (session.maxHr != null) {
                    maxHrSum += session.maxHr;
                    maxHrCount++;
                }
            }
        } else if (day.training?.dayEffortRpe != null) {
            dayEffortSum += day.training.dayEffortRpe;
            dayEffortCount++;
        }
    }

    return {
        range: { from, to },
        sleep: {
            avgTimeAsleepMinutes: safeAvg(sleepTimeSum, sleepTimeCount),
            avgScore: safeAvg(sleepScoreSum, sleepScoreCount),
            avgAwakeMinutes: safeAvg(awakeSum, awakeCount),
            avgRemMinutes: safeAvg(remSum, remCount),
            avgCoreMinutes: safeAvg(coreSum, coreCount),
            avgDeepMinutes: safeAvg(deepSum, deepCount),
            daysWithSleep,
        },
        training: {
            totalSessions,
            daysWithTraining,
            avgDayEffortRpe: safeAvg(dayEffortSum, dayEffortCount),
            totalActiveKcal: safeSumOrNull(activeKcalSum, activeKcalCount),
            totalDistanceKm: safeSumOrNull(distanceKmSum, distanceKmCount),
            avgAvgHr: safeAvg(avgHrSum, avgHrCount),
            avgMaxHr: safeAvg(maxHrSum, maxHrCount),
        },
    };
};

export const getDayByDate = async (userId: string, date: string) => {
    const day = await WorkoutDayModel.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        date,
    });

    if (!day) return null;
    return day.toJSON();
};

export const getDaysInRange = async (userId: string, from: string, to: string) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const days = await WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: from, $lte: to },
    }).sort({ date: 1 });

    return days.map((day) => day.toJSON());
};

export const upsertWorkoutDay = async ({
    userId,
    date,
    payload,
    mode,
}: UpsertArgs) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const weekKey = getWeekKeyFromISODate(date);

    const movementIds = collectMovementIdsFromPayload(payload);
    await assertMovementsExist({ userId, movementIds });

    const existing = await WorkoutDayModel.findOne({ userId: userObjectId, date });

    if (!existing) {
        if (mode === "replace") {
            const createDoc = applyFullReplace(userObjectId, date, payload);
            createDoc.weekKey = weekKey;

            const created = await WorkoutDayModel.create(createDoc);
            return created.toJSON();
        }

        const base = buildCanonicalDefaults(userObjectId, date);
        const merged = applyMerge(
            {
                sleep: base.sleep,
                training: base.training,
                plannedRoutine: base.plannedRoutine,
                plannedMeta: base.plannedMeta,
                notes: base.notes,
                tags: base.tags,
                meta: base.meta,
            },
            payload
        );

        const createDoc: WorkoutDayCreateInput = {
            ...base,
            ...merged,
            weekKey,
        };

        const created = await WorkoutDayModel.create(createDoc);
        return created.toJSON();
    }

    if (mode === "replace") {
        const next = applyFullReplace(userObjectId, date, payload);

        existing.set({
            sleep: next.sleep,
            training: next.training,
            plannedRoutine: next.plannedRoutine,
            plannedMeta: next.plannedMeta,
            notes: next.notes,
            tags: next.tags,
            meta: next.meta,
            weekKey,
        });

        const saved = await existing.save();
        return saved.toJSON();
    }

    const merged = applyMerge(
        {
            sleep: existing.sleep,
            training: existing.training,
            plannedRoutine: existing.plannedRoutine,
            plannedMeta: existing.plannedMeta,
            notes: existing.notes,
            tags: existing.tags,
            meta: existing.meta,
        },
        payload
    );

    existing.set({
        ...merged,
        weekKey,
    });

    const saved = await existing.save();
    return saved.toJSON();
};

/**
 * Historical backfill support
 */
export const backfillWorkoutDayByDate = async (
    args: UpsertArgs
) => {
    return upsertWorkoutDay(args);
};

export const backfillWorkoutDaysRange = async (
    userId: string,
    body: WorkoutDayBackfillBody
): Promise<WorkoutDayBackfillResult> => {
    const mode = body.mode;
    const sortedDays = [...body.days].sort((a, b) => a.date.localeCompare(b.date));

    const results: WorkoutDayBackfillItemResult[] = [];

    for (const item of sortedDays) {
        try {
            const day = await upsertWorkoutDay({
                userId,
                date: item.date,
                payload: item.payload,
                mode,
            });

            results.push({
                date: item.date,
                ok: true,
                error: null,
                day,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown backfill error";

            results.push({
                date: item.date,
                ok: false,
                error: message,
                day: null,
            });
        }
    }

    const successCount = results.filter((item) => item.ok).length;
    const failedCount = results.length - successCount;

    return {
        mode,
        total: results.length,
        successCount,
        failedCount,
        results,
    };
};

export const getCalendarInRange = async (
    userId: string,
    from: string,
    to: string,
    fields: string[] | null,
    opts: Omit<BuildOpts, "fields">
): Promise<CalendarRangeResponse> => {
    const docs = await WorkoutDayModel.find({
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: from, $lte: to },
    }).sort({ date: 1 });

    const byDate = new Map<string, CalendarDayFull>();

    for (const doc of docs) {
        const day = normalizeCalendarDayFull(doc.toJSON());
        if (day.date) {
            byDate.set(day.date, day);
        }
    }

    const dates = opts.fillMissingDays ? enumerateDays(from, to) : Array.from(byDate.keys()).sort();
    const effectiveFields = fields ?? Array.from(DEFAULT_FIELDS_ALL);

    const builtDays: CalendarDayFull[] = dates.map((currentDate) => {
        const day = byDate.get(currentDate) ?? buildCalendarFallbackDay(currentDate);

        const full = buildCalendarDay(
            day,
            { ...opts, fields: effectiveFields },
            getWeekKeyFromISODate
        );

        const picked = pickFields(full, effectiveFields);
        return normalizeCalendarDayFull(picked);
    });

    const response: CalendarRangeResponse = {
        from,
        to,
        fields: effectiveFields,
        fillMissingDays: opts.fillMissingDays,
        days: builtDays,
    };

    if (opts.includeRollups) {
        const rollupDays = dates.map((currentDate) => byDate.get(currentDate) ?? buildCalendarFallbackDay(currentDate));
        response.rollups = rollupFromDays(rollupDays, getWeekKeyFromISODate);
    }

    return response;
};

export const getWeekViewByKey = async (
    userId: string,
    weekKey: string,
    fields: string[] | null,
    opts: Omit<BuildOpts, "fields">
): Promise<WeekViewResponse> => {
    const range = getWeekRangeFromKey(weekKey);

    const calendar = await getCalendarInRange(userId, range.from, range.to, fields, opts);

    return {
        weekKey,
        range,
        fields: calendar.fields,
        fillMissingDays: calendar.fillMissingDays,
        days: calendar.days,
        ...(calendar.rollups ? { rollups: calendar.rollups } : {}),
    };
};