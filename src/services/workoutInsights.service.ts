import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import type {
    InsightMetric,
    PrRecord,
    PrsResponse,
    RecoveryPoint,
    RecoveryResponse,
    StreakMode,
    StreaksResponse,
} from "../types/workoutInsights.types";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const parseMetrics = (metricsRaw?: string): InsightMetric[] => {
    const all: InsightMetric[] = [
        "activeKcal",
        "durationSeconds",
        "avgHr",
        "maxHr",
        "distanceKm",
        "steps",
        "paceSecPerKm",
    ];
    if (!metricsRaw) return all;

    const set = new Set(
        metricsRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
    );

    return all.filter((m) => set.has(m));
};

const safeNum = (v: any): number | null => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

const diffDays = (aIso: string, bIso: string): number => {
    // Both are YYYY-MM-DD
    const a = new Date(`${aIso}T00:00:00.000Z`).getTime();
    const b = new Date(`${bIso}T00:00:00.000Z`).getTime();
    return Math.round((a - b) / 86400000);
};

export const getSessionPrs = async (
    userId: string,
    from: string,
    to: string,
    metricsRaw?: string
): Promise<PrsResponse> => {
    const userObjectId = toObjectId(userId);
    const metrics = parseMetrics(metricsRaw);

    // Flatten sessions in range
    const rows = await WorkoutDayModel.aggregate([
        { $match: { userId: userObjectId, date: { $gte: from, $lte: to } } },
        { $unwind: { path: "$training.sessions", preserveNullAndEmptyArrays: false } },
        {
            $project: {
                _id: 0,
                date: "$date",
                weekKey: "$weekKey",
                sessionId: { $toString: "$training.sessions._id" },
                sessionType: "$training.sessions.type",
                durationSeconds: "$training.sessions.durationSeconds",
                activeKcal: "$training.sessions.activeKcal",
                avgHr: "$training.sessions.avgHr",
                maxHr: "$training.sessions.maxHr",
                distanceKm: "$training.sessions.distanceKm",
                steps: "$training.sessions.steps",
                paceSecPerKm: "$training.sessions.paceSecPerKm",
            },
        },
    ]);

    const prs: PrRecord[] = [];

    const pickMax = (metric: InsightMetric) => {
        let best: any = null;
        for (const r of rows) {
            const v = safeNum(r[metric]);
            if (v === null) continue;
            if (!best || v > best.value) best = { value: v, row: r };
        }
        if (best) {
            prs.push({
                metric,
                mode: "max",
                value: best.value,
                date: best.row.date,
                weekKey: best.row.weekKey,
                sessionId: best.row.sessionId,
                sessionType: best.row.sessionType,
            });
        }
    };

    const pickMin = (metric: InsightMetric) => {
        let best: any = null;
        for (const r of rows) {
            const v = safeNum(r[metric]);
            if (v === null) continue;
            if (!best || v < best.value) best = { value: v, row: r };
        }
        if (best) {
            prs.push({
                metric,
                mode: "min",
                value: best.value,
                date: best.row.date,
                weekKey: best.row.weekKey,
                sessionId: best.row.sessionId,
                sessionType: best.row.sessionType,
            });
        }
    };

    for (const m of metrics) {
        // pace is “better when lower”
        if (m === "paceSecPerKm") pickMin(m);
        else pickMax(m);
    }

    return { range: { from, to }, prs };
};

export const getStreaks = async (
    userId: string,
    asOf: string,
    mode: StreakMode,
    gapDays: number
): Promise<StreaksResponse> => {
    const userObjectId = toObjectId(userId);

    const days = await WorkoutDayModel.find(
        { userId: userObjectId, date: { $lte: asOf } },
        { date: 1, sleep: 1, training: 1 }
    ).sort({ date: 1 });

    const qualifies = (d: any) => {
        const hasTraining = Array.isArray(d?.training?.sessions) && d.training.sessions.length > 0;
        const hasSleep = d?.sleep && (d.sleep.totalMinutes ?? null) !== null;

        if (mode === "training") return hasTraining;
        if (mode === "sleep") return hasSleep;
        return hasTraining && hasSleep;
    };

    const gap = clamp(Number(gapDays ?? 0), 0, 365);

    const daysDiff = (a: string, b: string): number => {
        const da = new Date(`${a}T00:00:00.000Z`).getTime();
        const db = new Date(`${b}T00:00:00.000Z`).getTime();
        return Math.round((db - da) / 86400000);
    };


    let lastQualifiedDate: string | null = null;
    for (let i = days.length - 1; i >= 0; i--) {
        const d = days[i];
        if (d.date > asOf) continue;
        if (qualifies(d)) {
            lastQualifiedDate = String(d.date);
            break;
        }
    }

    let currentStreakDays = 0;

    if (lastQualifiedDate) {
        let anchor = lastQualifiedDate;
        currentStreakDays = 1;

        for (let i = days.length - 1; i >= 0; i--) {
            const d = days[i];
            const date = String(d.date);

            if (date >= anchor) continue;
            if (!qualifies(d)) continue;

            const diff = daysDiff(date, anchor);
            if (diff <= 0) continue;

            // break if too far apart
            if (diff > gap + 1) break;

            currentStreakDays += 1;
            anchor = date;
        }
    }

    let longestStreakDays = 0;
    let run = 0;
    let prevQual: string | null = null;

    for (const d of days) {
        if (!qualifies(d)) continue;

        const date = String(d.date);

        if (!prevQual) {
            run = 1;
            prevQual = date;
            longestStreakDays = Math.max(longestStreakDays, run);
            continue;
        }

        const diff = daysDiff(prevQual, date);

        if (diff <= gap + 1) {
            run += 1;
        } else {
            run = 1;
        }

        prevQual = date;
        if (run > longestStreakDays) longestStreakDays = run;
    }

    return {
        asOf,
        mode,
        gapDays: gap,
        currentStreakDays,
        longestStreakDays,
        lastQualifiedDate,
    };
};

export const getRecovery = async (userId: string, from: string, to: string): Promise<RecoveryResponse> => {
    const userObjectId = toObjectId(userId);

    const days = await WorkoutDayModel.find(
        { userId: userObjectId, date: { $gte: from, $lte: to } },
        { date: 1, weekKey: 1, sleep: 1, training: 1 }
    ).sort({ date: 1 });

    const points: RecoveryPoint[] = days.map((d: any) => {
        const sleepScore = safeNum(d?.sleep?.score);
        const deepMinutes = safeNum(d?.sleep?.deepMinutes);
        const totalSleepMinutes = safeNum(d?.sleep?.totalMinutes);

        const hasAnySleepSignal = sleepScore !== null || deepMinutes !== null || totalSleepMinutes !== null;

        // trainingLoad proxy (0..)
        const sessions: any[] = Array.isArray(d?.training?.sessions) ? d.training.sessions : [];
        const load = sessions.reduce((acc, s) => {
            const kcal = safeNum(s?.activeKcal) ?? 0;
            const dur = safeNum(s?.durationSeconds) ?? 0;
            // kcal dominates, duration adds small weight
            return acc + kcal + dur * 0.05;
        }, 0);

        // If no sleep data at all, mark as unknown instead of "red 50"
        if (!hasAnySleepSignal) {
            return {
                date: d.date,
                weekKey: d.weekKey,
                sleepScore: null,
                deepMinutes: null,
                totalSleepMinutes: null,
                trainingLoad: Math.round(load),
                recoveryScore: null,
                level: "unknown",
            };
        }

        let score = sleepScore !== null ? sleepScore : 50;

        if (deepMinutes !== null) score += clamp((deepMinutes - 30) * 0.4, -10, 15);
        if (totalSleepMinutes !== null) score += clamp((totalSleepMinutes - 420) * 0.03, -10, 10);

        score -= clamp(load * 0.02, 0, 25);
        score = clamp(score, 0, 100);

        const level = score >= 75 ? "green" : score >= 55 ? "yellow" : "red";

        return {
            date: d.date,
            weekKey: d.weekKey,
            sleepScore: sleepScore !== null ? sleepScore : null,
            deepMinutes: deepMinutes !== null ? deepMinutes : null,
            totalSleepMinutes: totalSleepMinutes !== null ? totalSleepMinutes : null,
            trainingLoad: Math.round(load),
            recoveryScore: Math.round(score),
            level,
        };
    });

    return { range: { from, to }, points };
};
