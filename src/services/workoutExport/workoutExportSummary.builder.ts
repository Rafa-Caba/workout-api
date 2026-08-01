// /src/services/workoutExport/workoutExportSummary.builder.ts
// Calculates report-level totals from normalized WorkoutDay data.

import type {
    WorkoutReportDay,
    WorkoutReportSummary,
} from "../../types/workoutExport.types";
import {
    averageNumbers,
    round,
    sumNumbers,
} from "./workoutExport.utils";

/**
 * Builds aggregate totals without mutating the normalized export document.
 */
export function buildWorkoutReportSummary(
    days: readonly WorkoutReportDay[],
    calendarDays = days.length,
): WorkoutReportSummary {
    const sessions = days.flatMap((day) => day.training?.sessions ?? []);
    const exercises = sessions.flatMap((session) => session.exercises);
    const sets = exercises.flatMap((exercise) => exercise.sets);
    const sleepBlocks = days
        .map((day) => day.sleep)
        .filter((sleep) => sleep !== null);

    return {
        calendarDays,
        daysWithData: days.filter((day) => !day.isEmpty).length,
        daysWithSleep: sleepBlocks.length,
        trainingDays: days.filter(
            (day) => (day.training?.sessions.length ?? 0) > 0,
        ).length,
        sessions: sessions.length,
        exercises: exercises.length,
        sets: sets.length,
        totalDurationSeconds: round(
            sumNumbers(sessions.map((session) => session.durationSeconds)),
            0,
        ),
        totalActiveKcal: round(
            sumNumbers(sessions.map((session) => session.activeKcal)),
            2,
        ),
        totalKcal: round(
            sumNumbers(sessions.map((session) => session.totalKcal)),
            2,
        ),
        totalDistanceKm: round(
            sumNumbers(
                sessions.map(
                    (session) =>
                        session.distanceKm ??
                        session.cardioMetrics?.distanceKm ??
                        null,
                ),
            ),
            3,
        ),
        totalSteps: round(
            sumNumbers(
                sessions.map(
                    (session) =>
                        session.steps ??
                        session.cardioMetrics?.steps ??
                        null,
                ),
            ),
            0,
        ),
        averageSleepMinutes: (() => {
            const value = averageNumbers(
                sleepBlocks.map((sleep) => sleep.timeAsleepMinutes),
            );
            return value === null ? null : round(value, 1);
        })(),
        averageSleepScore: (() => {
            const value = averageNumbers(
                sleepBlocks.map((sleep) => sleep.score),
            );
            return value === null ? null : round(value, 1);
        })(),
    };
}
