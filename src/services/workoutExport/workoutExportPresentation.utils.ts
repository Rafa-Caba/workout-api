// /src/services/workoutExport/workoutExportPresentation.utils.ts
// Shared presentation metrics and formatters for styled XLSX/PDF workout exports.

import type {
    WorkoutReportDay,
    WorkoutReportSession,
    WorkoutReportSleep,
} from "../../types/workoutExport.types";
import {
    averageNumbers,
    formatDuration,
    formatMinutes,
    isRecord,
    readStringFrom,
    round,
    sumNumbers,
} from "./workoutExport.utils";

export type WorkoutExportDayMetrics = {
    date: string;
    dateLabel: string;
    sessionCount: number;
    gymSessionCount: number;
    cardioSessionCount: number;
    mediaCount: number;
    exerciseCount: number;
    setCount: number;
    durationSeconds: number | null;
    activeKcal: number | null;
    totalKcal: number | null;
    distanceKm: number | null;
    steps: number | null;
    dayRpe: number | null;
    sleepMinutes: number | null;
    sleepScore: number | null;
};

export type WorkoutExportSleepMetrics = {
    date: string;
    dateLabel: string;
    totalMinutes: number | null;
    inBedMinutes: number | null;
    score: number | null;
    efficiencyPct: number | null;
    readiness: number | null;
    remPct: number | null;
    deepPct: number | null;
    coreMinutes: number | null;
    awakeMinutes: number | null;
    source: string | null;
    sourceDevice: string | null;
    importedAt: string | null;
    lastSyncedAt: string | null;
};

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function sumNullable(
    values: readonly (number | null | undefined)[],
): number | null {
    const validValues = values.filter(isFiniteNumber);
    return validValues.length > 0 ? sumNumbers(validValues) : null;
}

function computeAverageSessionRpe(
    sessions: readonly WorkoutReportSession[],
): number | null {
    return averageNumbers(sessions.map((session) => session.effortRpe));
}

function computeStagePercent(
    stageMinutes: number | null,
    totalMinutes: number | null,
): number | null {
    if (
        !isFiniteNumber(stageMinutes) ||
        !isFiniteNumber(totalMinutes) ||
        totalMinutes <= 0
    ) {
        return null;
    }

    return round((stageMinutes / totalMinutes) * 100, 0);
}

function computeSleepEfficiency(
    totalMinutes: number | null,
    inBedMinutes: number | null,
): number | null {
    if (
        !isFiniteNumber(totalMinutes) ||
        !isFiniteNumber(inBedMinutes) ||
        inBedMinutes <= 0
    ) {
        return null;
    }

    return round(clamp((totalMinutes / inBedMinutes) * 100, 0, 100), 0);
}

function computeReadiness(
    sleepScore: number | null,
    dayRpe: number | null,
): number | null {
    if (!isFiniteNumber(sleepScore)) return null;

    let readiness = sleepScore;

    if (isFiniteNumber(dayRpe)) {
        readiness += dayRpe >= 6
            ? -(dayRpe - 5) * 6
            : (5 - dayRpe) * 2;
    }

    return round(clamp(readiness, 0, 100), 0);
}

function normalizedTypeText(session: WorkoutReportSession): string {
    return [
        session.type,
        session.activityType,
        session.cardioEnvironment,
        getSessionMetaText(session, "sessionKind"),
        getSessionMetaText(session, "originalType"),
    ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();
}

/**
 * Identifies cardio-like sessions without limiting future activity types.
 */
export function isCardioSession(session: WorkoutReportSession): boolean {
    if (
        session.activityType ||
        session.cardioEnvironment ||
        session.cardioMetrics ||
        session.hasRoute ||
        session.routePoints.length > 0 ||
        session.routeSummary
    ) {
        return true;
    }

    const normalized = normalizedTypeText(session);
    return [
        "cardio",
        "walk",
        "walking",
        "run",
        "running",
        "cycle",
        "cycling",
        "bike",
        "biking",
        "hike",
        "hiking",
        "swim",
        "swimming",
        "rowing",
        "elliptical",
        "stair",
    ].some((keyword) => normalized.includes(keyword));
}

export function getSessionMetaText(
    session: WorkoutReportSession,
    key: string,
): string | null {
    if (!isRecord(session.meta)) return null;
    return readStringFrom(session.meta, key);
}

export function getSessionDistanceKm(
    session: WorkoutReportSession,
): number | null {
    return session.distanceKm ?? session.cardioMetrics?.distanceKm ?? null;
}

export function getSessionSteps(
    session: WorkoutReportSession,
): number | null {
    return session.steps ?? session.cardioMetrics?.steps ?? null;
}

export function getSessionElevationM(
    session: WorkoutReportSession,
): number | null {
    return session.elevationGainM
        ?? session.cardioMetrics?.elevationGainM
        ?? null;
}

export function getSessionPaceSecPerKm(
    session: WorkoutReportSession,
): number | null {
    return session.paceSecPerKm
        ?? session.cardioMetrics?.paceSecPerKm
        ?? null;
}

export function getSessionCadenceRpm(
    session: WorkoutReportSession,
): number | null {
    return session.cadenceRpm
        ?? session.cardioMetrics?.cadenceRpm
        ?? null;
}

export function getSessionRoutePointCount(
    session: WorkoutReportSession,
): number {
    return session.routePoints.length || session.routeSummary?.pointCount || 0;
}

export function buildDayMetrics(
    day: WorkoutReportDay,
): WorkoutExportDayMetrics {
    const sessions = day.training?.sessions ?? [];
    const cardioSessions = sessions.filter(isCardioSession);
    const gymSessions = sessions.filter((session) => !isCardioSession(session));
    const exerciseCount = sumNumbers(
        sessions.map((session) => session.exercises.length),
    );
    const setCount = sumNumbers(
        sessions.flatMap((session) =>
            session.exercises.map((exercise) => exercise.sets.length),
        ),
    );

    return {
        date: day.date,
        dateLabel: formatReportDate(day.date),
        sessionCount: sessions.length,
        gymSessionCount: gymSessions.length,
        cardioSessionCount: cardioSessions.length,
        mediaCount: sumNumbers(
            sessions.map((session) => session.media.length),
        ),
        exerciseCount,
        setCount,
        durationSeconds: sumNullable(
            sessions.map((session) => session.durationSeconds),
        ),
        activeKcal: sumNullable(
            sessions.map((session) => session.activeKcal),
        ),
        totalKcal: sumNullable(
            sessions.map((session) => session.totalKcal),
        ),
        distanceKm: sumNullable(sessions.map(getSessionDistanceKm)),
        steps: sumNullable(sessions.map(getSessionSteps)),
        dayRpe: day.training?.dayEffortRpe
            ?? computeAverageSessionRpe(sessions),
        sleepMinutes: day.sleep?.timeAsleepMinutes ?? null,
        sleepScore: day.sleep?.score ?? null,
    };
}

export function buildSleepMetrics(
    day: WorkoutReportDay,
): WorkoutExportSleepMetrics | null {
    const sleep: WorkoutReportSleep | null = day.sleep;
    if (!sleep) return null;

    const sessions = day.training?.sessions ?? [];
    const dayRpe = day.training?.dayEffortRpe
        ?? computeAverageSessionRpe(sessions);

    return {
        date: day.date,
        dateLabel: formatReportDate(day.date),
        totalMinutes: sleep.timeAsleepMinutes,
        inBedMinutes: sleep.timeInBedMinutes,
        score: sleep.score,
        efficiencyPct: computeSleepEfficiency(
            sleep.timeAsleepMinutes,
            sleep.timeInBedMinutes,
        ),
        readiness: computeReadiness(sleep.score, dayRpe),
        remPct: computeStagePercent(
            sleep.remMinutes,
            sleep.timeAsleepMinutes,
        ),
        deepPct: computeStagePercent(
            sleep.deepMinutes,
            sleep.timeAsleepMinutes,
        ),
        coreMinutes: sleep.coreMinutes,
        awakeMinutes: sleep.awakeMinutes,
        source: sleep.source,
        sourceDevice: sleep.sourceDevice,
        importedAt: sleep.importedAt,
        lastSyncedAt: sleep.lastSyncedAt,
    };
}

export function formatReportDate(dateIso: string): string {
    const date = new Date(`${dateIso}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return dateIso;

    return new Intl.DateTimeFormat("es-MX", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

export function formatReportDateLong(dateIso: string): string {
    const date = new Date(`${dateIso}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return dateIso;

    return new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
}

export function formatReportDateTime(value: string | null): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "UTC",
    }).format(date);
}

export function formatReportTime(value: string | null): string {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
    }).format(date);
}

export function formatReportNumber(
    value: number | null,
    decimals = 0,
    suffix = "",
): string {
    if (!isFiniteNumber(value)) return "-";
    return `${round(value, decimals).toLocaleString("es-MX", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}${suffix}`;
}

export function formatReportPercent(value: number | null): string {
    return isFiniteNumber(value) ? `${round(value, 0)}%` : "-";
}

export function formatReportMinutes(value: number | null): string {
    return formatMinutes(value).replace("—", "-");
}

export function formatReportDuration(value: number | null): string {
    return formatDuration(value).replace("—", "-");
}

export function formatReportPace(value: number | null): string {
    if (!isFiniteNumber(value) || value < 0) return "-";

    const totalSeconds = Math.round(value);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}
