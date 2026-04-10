// src/services/bodyProgress.service.ts
import mongoose from "mongoose";
import { UserMetricModel } from "../models/UserMetric.model";
import { UserModel } from "../models/User.model";
import type {
    BodyProgressHighlight,
    BodyProgressMetric,
    BodyProgressMetricKey,
    BodyProgressOverviewQuery,
    BodyProgressOverviewResponse,
    BodyProgressTimelinePoint,
} from "../types/bodyProgress.types";
import type { UserMetricEntry } from "../types/userMetric.types";
import {
    buildComparisonRange,
    calculateDelta,
    calculatePercentDelta,
    resolveProgressRanges,
    resolveTrendDirection,
    round1,
} from "./workoutProgress/workoutProgress.shared";

type MetricGoal = "up" | "down";

type LeanMetricDoc = {
    id?: string;
    userId?: string | mongoose.Types.ObjectId;
    date: string;
    weightKg?: number | null;
    bodyFatPct?: number | null;
    waistCm?: number | null;
    customMetrics?: Array<{
        key: string;
        label: string;
        value: number;
        unit: string;
    }>;
    notes?: string | null;
    source?: "manual" | "profile" | "device" | "import" | "coach";
    sourceDevice?: string | null;
    importedAt?: Date | string | null;
    createdFromProfile?: boolean;
    meta?: Record<string, unknown> | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const toIsoString = (value: Date | string | null | undefined): string | null => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toUserMetricEntry = (doc: LeanMetricDoc): UserMetricEntry => {
    return {
        id: doc.id ? String(doc.id) : "",
        userId: doc.userId ? String(doc.userId) : "",
        date: String(doc.date),

        weightKg: typeof doc.weightKg === "number" ? doc.weightKg : null,
        bodyFatPct: typeof doc.bodyFatPct === "number" ? doc.bodyFatPct : null,
        waistCm: typeof doc.waistCm === "number" ? doc.waistCm : null,

        customMetrics: Array.isArray(doc.customMetrics)
            ? doc.customMetrics.map((item) => ({
                key: String(item.key),
                label: String(item.label),
                value: Number(item.value),
                unit: String(item.unit),
            }))
            : [],

        notes: typeof doc.notes === "string" ? doc.notes : null,
        source:
            doc.source === "profile" ||
                doc.source === "device" ||
                doc.source === "import" ||
                doc.source === "coach"
                ? doc.source
                : "manual",
        sourceDevice: typeof doc.sourceDevice === "string" ? doc.sourceDevice : null,
        importedAt: toIsoString(doc.importedAt),
        createdFromProfile: Boolean(doc.createdFromProfile),
        meta:
            doc.meta && typeof doc.meta === "object" && !Array.isArray(doc.meta)
                ? doc.meta
                : null,
        createdAt: toIsoString(doc.createdAt) ?? new Date().toISOString(),
        updatedAt: toIsoString(doc.updatedAt) ?? new Date().toISOString(),
    };
};

const getMetricGoalForUser = (
    key: BodyProgressMetricKey,
    activityGoal: string | null | undefined
): MetricGoal => {
    if (key === "bodyFatPct" || key === "waistCm") {
        return "down";
    }

    if (key === "weightKg") {
        if (activityGoal === "hypertrophy" || activityGoal === "strength") {
            return "up";
        }

        return "down";
    }

    return "down";
};

const pickFieldValue = (
    entry: UserMetricEntry,
    key: BodyProgressMetricKey
): number | null => {
    if (key === "weightKg") return entry.weightKg;
    if (key === "bodyFatPct") return entry.bodyFatPct;
    return entry.waistCm;
};

const getFirstValueInEntries = (
    entries: UserMetricEntry[],
    key: BodyProgressMetricKey
): number | null => {
    for (const entry of entries) {
        const value = pickFieldValue(entry, key);
        if (typeof value === "number") {
            return value;
        }
    }

    return null;
};

const getLastValueInEntries = (
    entries: UserMetricEntry[],
    key: BodyProgressMetricKey
): number | null => {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const value = pickFieldValue(entries[index], key);
        if (typeof value === "number") {
            return value;
        }
    }

    return null;
};

const buildTimeline = (entries: UserMetricEntry[]): BodyProgressTimelinePoint[] => {
    return entries.map((entry) => ({
        date: entry.date,
        weightKg: entry.weightKg,
        bodyFatPct: entry.bodyFatPct,
        waistCm: entry.waistCm,
    }));
};

const buildBodyMetric = ({
    key,
    label,
    unit,
    activityGoal,
    currentEntries,
    previousEntries,
}: {
    key: BodyProgressMetricKey;
    label: string;
    unit: "kg" | "percent" | "cm";
    activityGoal: string | null | undefined;
    currentEntries: UserMetricEntry[];
    previousEntries: UserMetricEntry[];
}): BodyProgressMetric => {
    const currentFirst = getFirstValueInEntries(currentEntries, key);
    const currentLast = getLastValueInEntries(currentEntries, key);
    const previousLast = getLastValueInEntries(previousEntries, key);

    const deltaWithinCurrent = calculateDelta(currentLast, currentFirst);
    const percentDeltaWithinCurrent = calculatePercentDelta(currentLast, currentFirst);

    const deltaVsPrevious = calculateDelta(currentLast, previousLast);
    const percentDeltaVsPrevious = calculatePercentDelta(currentLast, previousLast);

    const comparisonTrend =
        previousLast !== null
            ? resolveTrendDirection(currentLast, previousLast)
            : resolveTrendDirection(currentLast, currentFirst);

    const goal = getMetricGoalForUser(key, activityGoal);

    return {
        key,
        label,
        unit,

        currentLatest: currentLast,
        previousLatest: previousLast,

        deltaVsPrevious,
        percentDeltaVsPrevious,

        currentFirst,
        currentLast,
        deltaWithinCurrent,
        percentDeltaWithinCurrent,

        trend: comparisonTrend,
        isPositiveWhenUp: goal === "up",
        hasComparison: previousLast !== null,
    };
};

const buildHighlights = (metrics: BodyProgressMetric[]): BodyProgressHighlight[] => {
    const items: BodyProgressHighlight[] = [];

    const weightMetric = metrics.find((metric) => metric.key === "weightKg");
    const bodyFatMetric = metrics.find((metric) => metric.key === "bodyFatPct");
    const waistMetric = metrics.find((metric) => metric.key === "waistCm");

    if (
        weightMetric &&
        typeof weightMetric.deltaVsPrevious === "number" &&
        Math.abs(weightMetric.deltaVsPrevious) >= 0.2
    ) {
        items.push({
            id: "weight_change",
            tone: "neutral",
            title: "Cambio de peso detectado",
            message: `Tu peso cambió ${round1(weightMetric.deltaVsPrevious)} kg frente al periodo comparado.`,
            metricKey: "weightKg",
        });
    }

    if (
        bodyFatMetric &&
        typeof bodyFatMetric.deltaVsPrevious === "number" &&
        Math.abs(bodyFatMetric.deltaVsPrevious) >= 0.3
    ) {
        const tone: "positive" | "attention" =
            bodyFatMetric.deltaVsPrevious < 0 ? "positive" : "attention";

        items.push({
            id: "body_fat_change",
            tone,
            title: "Cambio en grasa corporal",
            message: `El porcentaje de grasa corporal cambió ${round1(bodyFatMetric.deltaVsPrevious)} puntos frente al periodo previo.`,
            metricKey: "bodyFatPct",
        });
    }

    if (
        waistMetric &&
        typeof waistMetric.deltaVsPrevious === "number" &&
        Math.abs(waistMetric.deltaVsPrevious) >= 0.5
    ) {
        const tone: "positive" | "attention" =
            waistMetric.deltaVsPrevious < 0 ? "positive" : "attention";

        items.push({
            id: "waist_change",
            tone,
            title: "Cambio en cintura",
            message: `La cintura cambió ${round1(waistMetric.deltaVsPrevious)} cm frente al periodo comparado.`,
            metricKey: "waistCm",
        });
    }

    if (!items.length) {
        items.push({
            id: "body_stable",
            tone: "neutral",
            title: "Seguimiento corporal estable",
            message: "No se detectaron cambios drásticos en las métricas corporales frente al periodo comparado.",
            metricKey: null,
        });
    }

    return items.slice(0, 4);
};

export const getBodyProgressOverview = async (
    userId: string,
    query: BodyProgressOverviewQuery
): Promise<BodyProgressOverviewResponse> => {
    const { range, compareRange } = resolveProgressRanges({
        mode: query.mode,
        from: query.from,
        to: query.to,
        compareTo: query.compareTo,
        includeExerciseProgress: false,
    });

    const currentDocs = await UserMetricModel.find({
        userId: toObjectId(userId),
        date: { $gte: range.from, $lte: range.to },
    })
        .sort({ date: 1, createdAt: 1 })
        .lean<LeanMetricDoc[]>();

    const previousDocs = compareRange
        ? await UserMetricModel.find({
            userId: toObjectId(userId),
            date: { $gte: compareRange.from, $lte: compareRange.to },
        })
            .sort({ date: 1, createdAt: 1 })
            .lean<LeanMetricDoc[]>()
        : [];

    const user = await UserModel.findById(userId).lean<{
        activityGoal?: string | null;
    } | null>();

    const currentEntries = currentDocs.map(toUserMetricEntry);
    const previousEntries = previousDocs.map(toUserMetricEntry);

    const metrics: BodyProgressMetric[] = [
        buildBodyMetric({
            key: "weightKg",
            label: "Peso",
            unit: "kg",
            activityGoal: user?.activityGoal ?? null,
            currentEntries,
            previousEntries,
        }),
        buildBodyMetric({
            key: "bodyFatPct",
            label: "Grasa corporal",
            unit: "percent",
            activityGoal: user?.activityGoal ?? null,
            currentEntries,
            previousEntries,
        }),
        buildBodyMetric({
            key: "waistCm",
            label: "Cintura",
            unit: "cm",
            activityGoal: user?.activityGoal ?? null,
            currentEntries,
            previousEntries,
        }),
    ];

    const latestCurrentEntry =
        currentEntries.length > 0 ? currentEntries[currentEntries.length - 1] : null;

    const latestPreviousEntry =
        previousEntries.length > 0 ? previousEntries[previousEntries.length - 1] : null;

    const highlights = buildHighlights(metrics);

    const heroItems: string[] = [];

    if (latestCurrentEntry?.weightKg !== null && latestCurrentEntry?.weightKg !== undefined) {
        heroItems.push(`${round1(latestCurrentEntry.weightKg)} kg`);
    }

    if (
        latestCurrentEntry?.bodyFatPct !== null &&
        latestCurrentEntry?.bodyFatPct !== undefined
    ) {
        heroItems.push(`${round1(latestCurrentEntry.bodyFatPct)}% grasa`);
    }

    if (latestCurrentEntry?.waistCm !== null && latestCurrentEntry?.waistCm !== undefined) {
        heroItems.push(`${round1(latestCurrentEntry.waistCm)} cm cintura`);
    }

    const weeksCovered = Math.max(1, Math.round(range.daysCount / 7));

    return {
        mode: query.mode,
        compareTo: query.compareTo,

        range,
        compareRange: compareRange
            ? buildComparisonRange(compareRange.from, compareRange.to)
            : null,

        summary: {
            entriesCurrent: currentEntries.length,
            entriesPrevious: previousEntries.length,
            daysTrackedCurrent: currentEntries.length,
            daysTrackedPrevious: previousEntries.length,
        },

        metrics,

        timelineCurrent: buildTimeline(currentEntries),
        timelinePrevious: buildTimeline(previousEntries),

        latestCurrentEntry,
        latestPreviousEntry,

        highlights,

        hero: {
            title: "Progreso corporal",
            subtitle: `En ${weeksCovered} semana(s), registraste tu evolución corporal y se comparó contra el periodo previo.`,
            items: heroItems,
            message:
                latestCurrentEntry
                    ? "Estas métricas ayudan a complementar el progreso de entrenamiento, sueño y adherencia."
                    : "Aún no hay suficientes métricas corporales en el periodo actual para generar una lectura más profunda.",
            bullets: highlights.map((item) => item.title),
        },
    };
};