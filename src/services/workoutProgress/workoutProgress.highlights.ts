// src/services/workoutProgress/workoutProgress.highlights.ts
// Highlights, hero summary, and summary blocks for the Workout Progress service.

import type {
    WorkoutExerciseHighlightsItem,
    WorkoutProgressComparisonRange,
    WorkoutProgressHero,
    WorkoutProgressHighlightsItem,
    WorkoutProgressMetric,
    WorkoutProgressSummaryBlock,
    WorkoutProgressTopMovement,
    WorkoutSessionTypeProgressItem,
} from "../../types/workoutProgress.types";
import { isNumber, round1 } from "./workoutProgress.shared";

export const buildProgressHighlights = ({
    training,
    sleep,
    adherence,
    topMovements,
    sessionTypeProgress,
}: {
    training: WorkoutProgressMetric[];
    sleep: WorkoutProgressMetric[];
    adherence: WorkoutProgressMetric[];
    topMovements: WorkoutProgressTopMovement[];
    sessionTypeProgress: WorkoutSessionTypeProgressItem[];
}): WorkoutProgressHighlightsItem[] => {
    const items: WorkoutProgressHighlightsItem[] = [];

    const sessionsMetric = training.find((metric) => metric.key === "sessionsCount");
    if (sessionsMetric && (sessionsMetric.delta ?? 0) > 0) {
        items.push({
            id: "training_sessions_up",
            tone: "positive",
            title: "Más sesiones completadas",
            message: `Completaste ${sessionsMetric.delta} sesión(es) más que en el periodo previo.`,
            metricKey: "sessionsCount",
            group: "training",
        });
    }

    const durationMetric = training.find((metric) => metric.key === "durationSeconds");
    if (durationMetric && (durationMetric.delta ?? 0) > 0) {
        items.push({
            id: "training_duration_up",
            tone: "positive",
            title: "Más tiempo de entrenamiento",
            message: `Tu tiempo total subió ${Math.round((durationMetric.delta ?? 0) / 60)} minutos.`,
            metricKey: "durationSeconds",
            group: "training",
        });
    }

    const sleepMetric = sleep.find((metric) => metric.key === "sleepAvgMinutes");
    if (sleepMetric && (sleepMetric.delta ?? 0) > 0) {
        items.push({
            id: "sleep_average_up",
            tone: "positive",
            title: "Sueño promedio al alza",
            message: `Tu sueño promedio mejoró ${Math.round(sleepMetric.delta ?? 0)} minutos.`,
            metricKey: "sleepAvgMinutes",
            group: "sleep",
        });
    }

    const adherenceMetric = adherence.find((metric) => metric.key === "adherencePct");
    if (adherenceMetric && (adherenceMetric.delta ?? 0) > 0) {
        items.push({
            id: "adherence_up",
            tone: "positive",
            title: "Mejor adherencia",
            message: `Tu adherencia subió ${round1(adherenceMetric.delta ?? 0)} puntos porcentuales.`,
            metricKey: "adherencePct",
            group: "adherence",
        });
    }

    if (topMovements.length > 0) {
        const bestMovement = topMovements[0];
        items.push({
            id: "best_movement",
            tone: "positive",
            title: "Mejor avance por ejercicio",
            message: `${bestMovement.exerciseLabel} destacó con una mejora de ${bestMovement.improvementPct !== null
                    ? `${round1(bestMovement.improvementPct)}%`
                    : `${round1(bestMovement.improvementAbsolute ?? 0)}`
                }.`,
            metricKey: "topSetLoad",
            group: "exercise",
        });
    }

    const bestSessionType = sessionTypeProgress
        .filter(
            (item) => (item.sessionsCount.percentDelta ?? item.sessionsCount.delta ?? 0) > 0
        )
        .sort(
            (a, b) =>
                (b.sessionsCount.percentDelta ?? b.sessionsCount.delta ?? 0) -
                (a.sessionsCount.percentDelta ?? a.sessionsCount.delta ?? 0)
        )[0];

    if (bestSessionType) {
        items.push({
            id: "best_session_type",
            tone: "neutral",
            title: "Tipo de sesión más sólido",
            message: `${bestSessionType.sessionType} mostró una mejor presencia en este periodo.`,
            metricKey: "sessionTypeSessionsCount",
            group: "sessionType",
        });
    }

    if (!items.length) {
        items.push({
            id: "neutral_progress",
            tone: "neutral",
            title: "Periodo estable",
            message: "Se detectó un comportamiento estable sin cambios drásticos frente al periodo previo.",
            metricKey: null,
            group: null,
        });
    }

    return items.slice(0, 6);
};

export const buildProgressSummaryText = ({
    range,
    training,
    sleep,
    adherence,
    topMovements,
    exerciseHighlights,
    highlights,
}: {
    range: WorkoutProgressComparisonRange;
    training: WorkoutProgressMetric[];
    sleep: WorkoutProgressMetric[];
    adherence: WorkoutProgressMetric[];
    topMovements: WorkoutProgressTopMovement[];
    exerciseHighlights: WorkoutExerciseHighlightsItem[];
    highlights: WorkoutProgressHighlightsItem[];
}): WorkoutProgressHero => {
    const weeksCovered = Math.max(1, Math.round(range.daysCount / 7));
    const sessionsMetric = training.find((metric) => metric.key === "sessionsCount");
    const sleepMetric = sleep.find((metric) => metric.key === "sleepAvgMinutes");
    const adherenceMetric = adherence.find((metric) => metric.key === "adherencePct");

    const items: string[] = [];
    const bullets: string[] = [];

    if (isNumber(sessionsMetric?.current)) {
        items.push(`${sessionsMetric.current} sesiones`);
    }

    if (isNumber(sleepMetric?.current)) {
        items.push(`${Math.round(sleepMetric.current)} min sueño promedio`);
    }

    if (isNumber(adherenceMetric?.current)) {
        items.push(`${round1(adherenceMetric.current)}% adherencia`);
    }

    if (topMovements.length > 0) {
        bullets.push(`Mejor avance por ejercicio: ${topMovements[0].exerciseLabel}`);
    }

    for (const exerciseHighlight of exerciseHighlights.slice(0, 2)) {
        bullets.push(exerciseHighlight.title);
    }

    for (const highlight of highlights.slice(0, 2)) {
        bullets.push(highlight.title);
    }

    return {
        title: "Resumen general",
        subtitle: `En ${weeksCovered} semana(s), lograste consolidar tu progreso comparado con el periodo previo.`,
        items,
        message:
            topMovements.length > 0
                ? `Esto refleja un progreso sólido, especialmente en ${topMovements[0].exerciseLabel}.`
                : "Esto refleja una base consistente sobre la cual seguir construyendo.",
        bullets,
    };
};

export const buildSummaryBlocks = ({
    training,
    sleep,
    adherence,
}: {
    training: WorkoutProgressMetric[];
    sleep: WorkoutProgressMetric[];
    adherence: WorkoutProgressMetric[];
}): WorkoutProgressSummaryBlock[] => {
    const sessionsMetric = training.find((metric) => metric.key === "sessionsCount");
    const sleepMetric = sleep.find((metric) => metric.key === "sleepAvgMinutes");
    const adherenceMetric = adherence.find((metric) => metric.key === "adherencePct");

    return [
        {
            key: "training",
            title: "Entrenamiento",
            subtitle: "Sesiones y carga general",
            metricsCount: training.length,
            currentValue: sessionsMetric?.current ?? null,
            previousValue: sessionsMetric?.previous ?? null,
            delta: sessionsMetric?.delta ?? null,
            percentDelta: sessionsMetric?.percentDelta ?? null,
            trend: sessionsMetric?.trend ?? "none",
            unit: "count",
        },
        {
            key: "sleep",
            title: "Sueño",
            subtitle: "Calidad y duración",
            metricsCount: sleep.length,
            currentValue: sleepMetric?.current ?? null,
            previousValue: sleepMetric?.previous ?? null,
            delta: sleepMetric?.delta ?? null,
            percentDelta: sleepMetric?.percentDelta ?? null,
            trend: sleepMetric?.trend ?? "none",
            unit: "minutes",
        },
        {
            key: "adherence",
            title: "Adherencia",
            subtitle: "Cumplimiento del plan",
            metricsCount: adherence.length,
            currentValue: adherenceMetric?.current ?? null,
            previousValue: adherenceMetric?.previous ?? null,
            delta: adherenceMetric?.delta ?? null,
            percentDelta: adherenceMetric?.percentDelta ?? null,
            trend: adherenceMetric?.trend ?? "none",
            unit: "percent",
        },
    ];
};