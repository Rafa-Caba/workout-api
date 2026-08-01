// /src/services/workoutExport/workoutExportData.service.ts
// Loads WorkoutDay documents and normalizes them into a stable export contract.

import mongoose from "mongoose";

import { UserModel } from "../../models/User.model";
import { UserSettingsModel } from "../../models/UserSettings.model";
import { WorkoutDayModel } from "../../models/WorkoutDay.model";
import type {
    ResolvedWorkoutReportRange,
    WorkoutReportCardioMetrics,
    WorkoutReportDay,
    WorkoutReportDayNote,
    WorkoutReportExercise,
    WorkoutReportExerciseSet,
    WorkoutReportMedia,
    WorkoutReportPlannedExercise,
    WorkoutReportPlannedMeta,
    WorkoutReportPlannedRoutine,
    WorkoutReportRoutePoint,
    WorkoutReportRouteSummary,
    WorkoutReportSession,
    WorkoutReportSleep,
    WorkoutReportTraining,
    WorkoutReportUser,
} from "../../types/workoutExport.types";
import {
    enumerateIsoDates,
    isRecord,
    readArray,
    readBoolean,
    readNumber,
    readNumberFrom,
    readString,
    readStringArray,
    readStringFrom,
    toIsoString,
    toJsonValue,
    valueToId,
    type UnknownRecord,
} from "./workoutExport.utils";

function normalizeMedia(value: unknown): WorkoutReportMedia[] {
    return readArray(value)
        .filter(isRecord)
        .map((item) => ({
            publicId: readStringFrom(item, "publicId") ?? "",
            url: readStringFrom(item, "url") ?? "",
            resourceType: readStringFrom(item, "resourceType") ?? "image",
            format: readStringFrom(item, "format"),
            createdAt: readStringFrom(item, "createdAt") ?? "",
            meta: toJsonValue(item.meta),
        }));
}

function normalizeSet(value: unknown, fallbackIndex: number): WorkoutReportExerciseSet | null {
    if (!isRecord(value)) return null;

    return {
        setIndex: readNumberFrom(value, "setIndex") ?? fallbackIndex,
        reps: readNumberFrom(value, "reps"),
        weight: readNumberFrom(value, "weight"),
        unit: readStringFrom(value, "unit") ?? "kg",
        rpe: readNumberFrom(value, "rpe"),
        isWarmup: readBoolean(value.isWarmup),
        isDropSet: readBoolean(value.isDropSet),
        tempo: readStringFrom(value, "tempo"),
        restSec: readNumberFrom(value, "restSec"),
        tags: readStringArray(value.tags),
        meta: toJsonValue(value.meta),
    };
}

function normalizeExercise(value: unknown): WorkoutReportExercise | null {
    if (!isRecord(value)) return null;

    const sets = readArray(value.sets)
        .map((set, index) => normalizeSet(set, index + 1))
        .filter((set): set is WorkoutReportExerciseSet => set !== null);

    return {
        id: valueToId(value.id ?? value._id) ?? "",
        name: readStringFrom(value, "name") ?? "Ejercicio",
        movementId: readStringFrom(value, "movementId"),
        movementName: readStringFrom(value, "movementName"),
        notes: readStringFrom(value, "notes"),
        sets,
        meta: toJsonValue(value.meta),
    };
}

function normalizeCardioMetrics(value: unknown): WorkoutReportCardioMetrics | null {
    if (!isRecord(value)) return null;

    const metrics: WorkoutReportCardioMetrics = {
        distanceKm: readNumberFrom(value, "distanceKm"),
        steps: readNumberFrom(value, "steps"),
        elevationGainM: readNumberFrom(value, "elevationGainM"),
        paceSecPerKm: readNumberFrom(value, "paceSecPerKm"),
        avgSpeedKmh: readNumberFrom(value, "avgSpeedKmh"),
        maxSpeedKmh: readNumberFrom(value, "maxSpeedKmh"),
        cadenceRpm: readNumberFrom(value, "cadenceRpm"),
        strideLengthM: readNumberFrom(value, "strideLengthM"),
    };

    return Object.values(metrics).some((metric) => metric !== null)
        ? metrics
        : null;
}

function normalizeRouteSummary(value: unknown): WorkoutReportRouteSummary | null {
    if (!isRecord(value)) return null;

    const summary: WorkoutReportRouteSummary = {
        pointCount: readNumberFrom(value, "pointCount") ?? 0,
        startLatitude: readNumberFrom(value, "startLatitude"),
        startLongitude: readNumberFrom(value, "startLongitude"),
        endLatitude: readNumberFrom(value, "endLatitude"),
        endLongitude: readNumberFrom(value, "endLongitude"),
        minLatitude: readNumberFrom(value, "minLatitude"),
        maxLatitude: readNumberFrom(value, "maxLatitude"),
        minLongitude: readNumberFrom(value, "minLongitude"),
        maxLongitude: readNumberFrom(value, "maxLongitude"),
    };

    const hasCoordinates = Object.entries(summary).some(
        ([key, coordinate]) => key !== "pointCount" && coordinate !== null,
    );

    return summary.pointCount > 0 || hasCoordinates
        ? summary
        : null;
}

function normalizeRoutePoint(value: unknown): WorkoutReportRoutePoint | null {
    if (!isRecord(value)) return null;

    const latitude = readNumberFrom(value, "latitude");
    const longitude = readNumberFrom(value, "longitude");

    if (latitude === null || longitude === null) return null;

    return {
        latitude,
        longitude,
        altitudeM: readNumberFrom(value, "altitudeM"),
        accuracyM: readNumberFrom(value, "accuracyM"),
        speedMps: readNumberFrom(value, "speedMps"),
        headingDeg: readNumberFrom(value, "headingDeg"),
        recordedAt: readStringFrom(value, "recordedAt"),
    };
}

function normalizeSession(value: unknown): WorkoutReportSession | null {
    if (!isRecord(value)) return null;

    const exercises = readArray(value.exercises)
        .map(normalizeExercise)
        .filter((exercise): exercise is WorkoutReportExercise => exercise !== null);

    const routePoints = readArray(value.routePoints)
        .map(normalizeRoutePoint)
        .filter((point): point is WorkoutReportRoutePoint => point !== null);

    return {
        id: valueToId(value.id ?? value._id) ?? "",
        type: readStringFrom(value, "type") ?? "session",
        activityType: readStringFrom(value, "activityType"),
        cardioEnvironment: readStringFrom(value, "cardioEnvironment"),
        startAt: readStringFrom(value, "startAt"),
        endAt: readStringFrom(value, "endAt"),
        durationSeconds: readNumberFrom(value, "durationSeconds"),
        activeKcal: readNumberFrom(value, "activeKcal"),
        totalKcal: readNumberFrom(value, "totalKcal"),
        avgHr: readNumberFrom(value, "avgHr"),
        maxHr: readNumberFrom(value, "maxHr"),
        distanceKm: readNumberFrom(value, "distanceKm"),
        steps: readNumberFrom(value, "steps"),
        elevationGainM: readNumberFrom(value, "elevationGainM"),
        paceSecPerKm: readNumberFrom(value, "paceSecPerKm"),
        cadenceRpm: readNumberFrom(value, "cadenceRpm"),
        hasRoute: readBoolean(value.hasRoute, routePoints.length > 0),
        cardioMetrics: normalizeCardioMetrics(value.cardioMetrics),
        routeSummary: normalizeRouteSummary(value.routeSummary),
        routePoints,
        effortRpe: readNumberFrom(value, "effortRpe"),
        notes: readStringFrom(value, "notes"),
        media: normalizeMedia(value.media),
        exercises,
        meta: toJsonValue(value.meta),
    };
}

function normalizeTraining(value: unknown): WorkoutReportTraining | null {
    if (!isRecord(value)) return null;

    const training: WorkoutReportTraining = {
        source: readStringFrom(value, "source"),
        dayEffortRpe: readNumberFrom(value, "dayEffortRpe"),
        sessions: readArray(value.sessions)
            .map(normalizeSession)
            .filter(
                (session): session is WorkoutReportSession =>
                    session !== null,
            ),
        raw: toJsonValue(value.raw),
    };

    return (
        training.sessions.length > 0 ||
        training.source !== null ||
        training.dayEffortRpe !== null ||
        training.raw !== null
    )
        ? training
        : null;
}

function normalizeSleep(value: unknown): WorkoutReportSleep | null {
    if (!isRecord(value)) return null;

    const sleep: WorkoutReportSleep = {
        timeAsleepMinutes: readNumberFrom(value, "timeAsleepMinutes"),
        timeInBedMinutes: readNumberFrom(value, "timeInBedMinutes"),
        score: readNumberFrom(value, "score"),
        awakeMinutes: readNumberFrom(value, "awakeMinutes"),
        remMinutes: readNumberFrom(value, "remMinutes"),
        coreMinutes: readNumberFrom(value, "coreMinutes"),
        deepMinutes: readNumberFrom(value, "deepMinutes"),
        source: readStringFrom(value, "source"),
        sourceDevice: readStringFrom(value, "sourceDevice"),
        importedAt: readStringFrom(value, "importedAt"),
        lastSyncedAt: readStringFrom(value, "lastSyncedAt"),
        raw: toJsonValue(value.raw),
    };

    return Object.values(sleep).some((field) => field !== null)
        ? sleep
        : null;
}

function normalizeDayNote(value: unknown): WorkoutReportDayNote | null {
    if (!isRecord(value)) return null;

    const id = readStringFrom(value, "id");
    const title = readStringFrom(value, "title");

    if (!id || !title) return null;

    return {
        id,
        type: readStringFrom(value, "type") ?? "other",
        title,
        description: readStringFrom(value, "description"),
        createdAt: readStringFrom(value, "createdAt") ?? "",
        updatedAt: readStringFrom(value, "updatedAt") ?? "",
    };
}

function normalizePlannedExercise(value: unknown): WorkoutReportPlannedExercise | null {
    if (!isRecord(value)) return null;

    return {
        id: readStringFrom(value, "id") ?? "",
        name: readStringFrom(value, "name") ?? "Ejercicio",
        movementId: readStringFrom(value, "movementId"),
        movementName: readStringFrom(value, "movementName"),
        sets: readNumberFrom(value, "sets"),
        reps: readStringFrom(value, "reps"),
        rpe: readNumberFrom(value, "rpe"),
        load: readStringFrom(value, "load"),
        notes: readStringFrom(value, "notes"),
        attachmentPublicIds: readStringArray(value.attachmentPublicIds),
    };
}

function normalizePlannedRoutine(value: unknown): WorkoutReportPlannedRoutine | null {
    if (!isRecord(value)) return null;

    const routine: WorkoutReportPlannedRoutine = {
        sessionType: readStringFrom(value, "sessionType"),
        focus: readStringFrom(value, "focus"),
        exercises: readArray(value.exercises)
            .map(normalizePlannedExercise)
            .filter(
                (exercise): exercise is WorkoutReportPlannedExercise =>
                    exercise !== null,
            ),
        notes: readStringFrom(value, "notes"),
        tags: readStringArray(value.tags),
    };

    return (
        routine.sessionType !== null ||
        routine.focus !== null ||
        routine.exercises.length > 0 ||
        routine.notes !== null ||
        routine.tags.length > 0
    )
        ? routine
        : null;
}

function normalizePlannedMeta(value: unknown): WorkoutReportPlannedMeta | null {
    if (!isRecord(value)) return null;

    return {
        plannedBy: valueToId(value.plannedBy),
        plannedAt: readStringFrom(value, "plannedAt"),
        source: readStringFrom(value, "source"),
    };
}

function hasMeaningfulDayData(day: Omit<WorkoutReportDay, "isEmpty">): boolean {
    return Boolean(
        day.sleep ||
        day.training ||
        day.plannedRoutine ||
        day.dayNotes.length > 0 ||
        day.notes ||
        day.tags.length > 0 ||
        day.meta,
    );
}

function normalizeDay(value: unknown): WorkoutReportDay | null {
    if (!isRecord(value)) return null;

    const date = readStringFrom(value, "date");
    if (!date) return null;

    const dayWithoutEmpty: Omit<WorkoutReportDay, "isEmpty"> = {
        id: valueToId(value.id ?? value._id),
        date,
        weekKey: readStringFrom(value, "weekKey"),
        sleep: normalizeSleep(value.sleep),
        training: normalizeTraining(value.training),
        plannedRoutine: normalizePlannedRoutine(value.plannedRoutine),
        plannedMeta: normalizePlannedMeta(value.plannedMeta),
        dayNotes: readArray(value.dayNotes)
            .map(normalizeDayNote)
            .filter((note): note is WorkoutReportDayNote => note !== null),
        notes: readStringFrom(value, "notes"),
        tags: readStringArray(value.tags),
        meta: toJsonValue(value.meta),
        createdAt: toIsoString(value.createdAt),
        updatedAt: toIsoString(value.updatedAt),
    };

    return {
        ...dayWithoutEmpty,
        isEmpty: !hasMeaningfulDayData(dayWithoutEmpty),
    };
}

function createEmptyDay(date: string): WorkoutReportDay {
    return {
        id: null,
        date,
        weekKey: null,
        sleep: null,
        training: null,
        plannedRoutine: null,
        plannedMeta: null,
        dayNotes: [],
        notes: null,
        tags: [],
        meta: null,
        createdAt: null,
        updatedAt: null,
        isEmpty: true,
    };
}

function normalizeLanguage(value: unknown): "es" | "en" {
    return value === "en" ? "en" : "es";
}

function normalizeWeekStartsOn(value: unknown): 0 | 1 {
    return readNumber(value) === 0 ? 0 : 1;
}

function normalizeUnit(value: unknown, fallback: "kg" | "km"): "kg" | "lb" | "km" | "mi" {
    if (value === "lb" || value === "mi" || value === "kg" || value === "km") return value;
    return fallback;
}

// /src/services/workoutExport/workoutExportData.service.ts
// Loads and normalizes the authenticated user's export preferences.

export async function loadWorkoutReportUser(
    userId: string,
): Promise<WorkoutReportUser> {
    const [rawUser, rawSettings] = await Promise.all([
        UserModel.findById(userId)
            .select({
                name: 1,
                email: 1,
                timezone: 1,
                units: 1,
            })
            .lean(),
        UserSettingsModel.findOne({ userId })
            .select({
                language: 1,
                weekStartsOn: 1,
            })
            .lean(),
    ]);

    /**
     * Explicitly typing these normalized values as UnknownRecord prevents
     * TypeScript from inferring the fallback as an empty `{}` object.
     */
    const user: UnknownRecord = isRecord(rawUser) ? rawUser : {};
    const settings: UnknownRecord = isRecord(rawSettings)
        ? rawSettings
        : {};

    const rawUnits = user["units"];
    const units: UnknownRecord = isRecord(rawUnits) ? rawUnits : {};

    const weightUnit = normalizeUnit(units["weight"], "kg");
    const distanceUnit = normalizeUnit(units["distance"], "km");

    return {
        id: userId,
        name: readStringFrom(user, "name") ?? "Usuario",
        email: readStringFrom(user, "email") ?? "",
        timezone: readStringFrom(user, "timezone"),
        language: normalizeLanguage(settings["language"]),
        weekStartsOn: normalizeWeekStartsOn(settings["weekStartsOn"]),
        weightUnit: weightUnit === "lb" ? "lb" : "kg",
        distanceUnit: distanceUnit === "mi" ? "mi" : "km",
    };
}

export async function loadWorkoutReportDays(
    userId: string,
    range: ResolvedWorkoutReportRange,
    includeEmptyDays: boolean,
): Promise<WorkoutReportDay[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw Object.assign(new Error("Invalid authenticated user id."), {
            statusCode: 401,
            code: "INVALID_AUTH_USER",
        });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const rawDays: readonly unknown[] = await WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: range.from, $lte: range.to },
    })
        .select({
            date: 1,
            weekKey: 1,
            sleep: 1,
            training: 1,
            plannedRoutine: 1,
            plannedMeta: 1,
            dayNotes: 1,
            notes: 1,
            tags: 1,
            meta: 1,
            createdAt: 1,
            updatedAt: 1,
        })
        .sort({ date: 1 })
        .lean();

    const normalized = rawDays
        .map(normalizeDay)
        .filter((day): day is WorkoutReportDay => day !== null);

    if (!includeEmptyDays) return normalized;

    const byDate = new Map(normalized.map((day) => [day.date, day]));

    return enumerateIsoDates(range.from, range.to).map(
        (date) => byDate.get(date) ?? createEmptyDay(date),
    );
}

export type WorkoutReportDataResult = {
    user: WorkoutReportUser;
    days: WorkoutReportDay[];
};

/**
 * Loads the complete canonical data set used by both XLSX and PDF renderers.
 */
export async function loadWorkoutReportData(
    userId: string,
    range: ResolvedWorkoutReportRange,
    includeEmptyDays: boolean,
): Promise<WorkoutReportDataResult> {
    const [user, days] = await Promise.all([
        loadWorkoutReportUser(userId),
        loadWorkoutReportDays(userId, range, includeEmptyDays),
    ]);

    return { user, days };
}
