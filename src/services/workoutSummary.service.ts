import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";
import { getWeekRangeFromKey } from "../utils/workoutDayBuilders";
import type {
    DaySummaryResponse,
    ISODate,
    MediaStatsResponse,
    PlanVsActualWeekResponse,
    RangeSummaryResponse,
    SummarySleep,
    SummaryTrainingTotals,
    WeekKey,
    WeekSummaryResponse,
    WeeksTrendResponse,
    WeekTrendPoint,
} from "../types/workoutSummary.types";

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const parseMinutesLoose = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (isNumber(v)) return v;

    if (typeof v === "string") {
        const s = v.trim().toLowerCase();

        // "6 hr 29 min" / "6h 29m"
        const hrMatch = s.match(/(\d+)\s*h/);
        const minMatch = s.match(/(\d+)\s*m/);

        const hr = hrMatch ? Number(hrMatch[1]) : 0;
        const min = minMatch ? Number(minMatch[1]) : 0;

        if ((hrMatch || minMatch) && Number.isFinite(hr) && Number.isFinite(min)) {
            return hr * 60 + min;
        }

        // "389" (string number)
        const n = Number(s);
        if (Number.isFinite(n)) return n;
    }

    return null;
};

const sumNullable = (values: Array<number | null>): number | null => {
    const nums = values.filter((v): v is number => isNumber(v));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0);
};

const avgNullable = (values: Array<number | null>): number | null => {
    const nums = values.filter((v): v is number => isNumber(v));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const maxNullable = (values: Array<number | null>): number | null => {
    const nums = values.filter((v): v is number => isNumber(v));
    if (!nums.length) return null;
    return Math.max(...nums);
};

const buildSleepSummaryFromDay = (day: any): SummarySleep | null => {
    // We try a few common shapes:
    // - day.sleep: { totalMinutes/timeAsleepMinutes, awakeMinutes, remMinutes, coreMinutes, deepMinutes, score }
    // - day.sleep: { timeAsleep: "6 hr 29 min", awake: 7, rem: "2 hr 6 min", core: "...", deep: "...", score: 90 }
    const sleep = day?.sleep ?? day?.sleepSummary ?? null;
    if (!sleep || typeof sleep !== "object") return null;

    const totalMinutes =
        parseMinutesLoose((sleep as any).totalMinutes) ??
        parseMinutesLoose((sleep as any).timeAsleepMinutes) ??
        parseMinutesLoose((sleep as any).timeAsleep);

    const awakeMinutes = parseMinutesLoose((sleep as any).awakeMinutes) ?? parseMinutesLoose((sleep as any).awake);
    const remMinutes = parseMinutesLoose((sleep as any).remMinutes) ?? parseMinutesLoose((sleep as any).rem);
    const coreMinutes = parseMinutesLoose((sleep as any).coreMinutes) ?? parseMinutesLoose((sleep as any).core);
    const deepMinutes = parseMinutesLoose((sleep as any).deepMinutes) ?? parseMinutesLoose((sleep as any).deep);

    const scoreRaw = (sleep as any).score ?? (sleep as any).sleepScore ?? null;
    const score = isNumber(scoreRaw) ? scoreRaw : typeof scoreRaw === "string" ? Number(scoreRaw) : null;

    // If we have *none* of the useful fields, treat it as absent.
    const hasAny =
        totalMinutes !== null ||
        awakeMinutes !== null ||
        remMinutes !== null ||
        coreMinutes !== null ||
        deepMinutes !== null ||
        score !== null;

    if (!hasAny) return null;

    return {
        totalMinutes,
        awakeMinutes,
        remMinutes,
        coreMinutes,
        deepMinutes,
        score: isNumber(score) ? score : null,
    };
};

const buildTrainingTotalsFromDay = (day: any): SummaryTrainingTotals => {
    const sessions: any[] = (day?.training?.sessions ?? []).filter(Boolean);

    const sessionsCount = sessions.length;

    const durationSeconds = sessions.reduce((sum, s) => sum + (isNumber(s?.durationSeconds) ? s.durationSeconds : 0), 0);

    const activeKcal = sumNullable(sessions.map((s) => (isNumber(s?.activeKcal) ? s.activeKcal : null)));
    const totalKcal = sumNullable(sessions.map((s) => (isNumber(s?.totalKcal) ? s.totalKcal : null)));

    // Weighted avgHr by duration when possible
    const weighted = sessions
        .map((s) => ({
            dur: isNumber(s?.durationSeconds) ? s.durationSeconds : 0,
            hr: isNumber(s?.avgHr) ? s.avgHr : null,
        }))
        .filter((x) => x.dur > 0 && x.hr !== null) as Array<{ dur: number; hr: number }>;

    const avgHr =
        weighted.length > 0
            ? Math.round(weighted.reduce((a, b) => a + b.hr * b.dur, 0) / weighted.reduce((a, b) => a + b.dur, 0))
            : avgNullable(sessions.map((s) => (isNumber(s?.avgHr) ? s.avgHr : null)));

    const maxHr = maxNullable(sessions.map((s) => (isNumber(s?.maxHr) ? s.maxHr : null)));

    const distanceKm = sumNullable(sessions.map((s) => (isNumber(s?.distanceKm) ? s.distanceKm : null)));
    const steps = sumNullable(sessions.map((s) => (isNumber(s?.steps) ? s.steps : null)));

    const mediaCount = sessions.reduce((sum, s) => sum + (Array.isArray(s?.media) ? s.media.length : 0), 0);

    return {
        sessionsCount,
        durationSeconds,
        activeKcal,
        totalKcal,
        avgHr: avgHr === null ? null : avgHr,
        maxHr,
        distanceKm,
        steps,
        mediaCount,
    };
};

const mergeTrainingTotals = (totals: SummaryTrainingTotals[]): SummaryTrainingTotals => {
    const sessionsCount = totals.reduce((a, b) => a + b.sessionsCount, 0);
    const durationSeconds = totals.reduce((a, b) => a + b.durationSeconds, 0);

    const activeKcal = sumNullable(totals.map((t) => t.activeKcal));
    const totalKcal = sumNullable(totals.map((t) => t.totalKcal));

    // Recompute avgHr weighted by durationSeconds from each day-level average
    const weighted = totals
        .map((t) => ({ dur: t.durationSeconds, hr: t.avgHr }))
        .filter((x) => x.dur > 0 && x.hr !== null) as Array<{ dur: number; hr: number }>;

    const avgHr =
        weighted.length > 0
            ? Math.round(weighted.reduce((a, b) => a + (b.hr as number) * b.dur, 0) / weighted.reduce((a, b) => a + b.dur, 0))
            : avgNullable(totals.map((t) => t.avgHr));

    const maxHr = maxNullable(totals.map((t) => t.maxHr));
    const distanceKm = sumNullable(totals.map((t) => t.distanceKm));
    const steps = sumNullable(totals.map((t) => t.steps));
    const mediaCount = totals.reduce((a, b) => a + b.mediaCount, 0);

    return {
        sessionsCount,
        durationSeconds,
        activeKcal,
        totalKcal,
        avgHr,
        maxHr,
        distanceKm,
        steps,
        mediaCount,
    };
};

export const getDaySummary = async (userId: string, date: ISODate): Promise<DaySummaryResponse> => {
    const userObjectId = toObjectId(userId);

    const day = await WorkoutDayModel.findOne({ userId: userObjectId, date }).lean();
    if (!day) {
        return {
            date,
            weekKey: null,
            sleep: null,
            training: {
                sessionsCount: 0,
                durationSeconds: 0,
                activeKcal: null,
                totalKcal: null,
                avgHr: null,
                maxHr: null,
                distanceKm: null,
                steps: null,
                mediaCount: 0,
            },
            notes: null,
            tags: null,
        };
    }

    const sleep = buildSleepSummaryFromDay(day);
    const training = buildTrainingTotalsFromDay(day);

    return {
        date: String((day as any).date),
        weekKey: String((day as any).weekKey ?? null),
        sleep,
        training,
        notes: (day as any).notes ?? null,
        tags: (day as any).tags ?? null,
    };
};

const getDaysInRange = async (userId: string, from: ISODate, to: ISODate) => {
    const userObjectId = toObjectId(userId);
    return WorkoutDayModel.find({ userId: userObjectId, date: { $gte: from, $lte: to } }).lean();
};

export const getRangeSummary = async (userId: string, from: ISODate, to: ISODate): Promise<RangeSummaryResponse> => {
    const days = await getDaysInRange(userId, from, to);

    const daysCount = days.length;

    const sleepSummaries = days.map((d) => buildSleepSummaryFromDay(d)).filter(Boolean) as SummarySleep[];
    const daysWithSleep = sleepSummaries.length;

    const avgTotalMinutes = avgNullable(sleepSummaries.map((s) => s.totalMinutes));
    const avgDeepMinutes = avgNullable(sleepSummaries.map((s) => s.deepMinutes));
    const avgRemMinutes = avgNullable(sleepSummaries.map((s) => s.remMinutes));
    const avgScore = avgNullable(sleepSummaries.map((s) => s.score));

    const dayTrainingTotals = days.map((d) => buildTrainingTotalsFromDay(d));
    const training = mergeTrainingTotals(dayTrainingTotals);

    // bySessionType (aggregate from docs directly)
    const bySessionTypeMap = new Map<string, { sessionsCount: number; durationSeconds: number; activeKcal: number | null }>();
    for (const d of days) {
        const sessions: any[] = (d as any)?.training?.sessions ?? [];
        for (const s of sessions) {
            const type = String(s?.type ?? "Unknown");
            const prev = bySessionTypeMap.get(type) ?? { sessionsCount: 0, durationSeconds: 0, activeKcal: null };

            const dur = isNumber(s?.durationSeconds) ? s.durationSeconds : 0;
            const kcal = isNumber(s?.activeKcal) ? s.activeKcal : null;

            bySessionTypeMap.set(type, {
                sessionsCount: prev.sessionsCount + 1,
                durationSeconds: prev.durationSeconds + dur,
                activeKcal: sumNullable([prev.activeKcal, kcal]),
            });
        }
    }

    const bySessionType = Array.from(bySessionTypeMap.entries())
        .map(([sessionType, v]) => ({ sessionType, ...v }))
        .sort((a, b) => b.durationSeconds - a.durationSeconds);

    const out: RangeSummaryResponse = {
        range: { from, to },
        daysCount,
        sleep: {
            daysWithSleep,
            avgTotalMinutes,
            avgDeepMinutes,
            avgRemMinutes,
            avgScore,
        },
        training: {
            ...training,
            bySessionType,
        },
        mediaCount: training.mediaCount,
    };

    return out;
};

export const getWeekSummary = async (userId: string, weekKey: WeekKey): Promise<WeekSummaryResponse> => {
    const range = getWeekRangeFromKey(weekKey);
    const rangeSummary = await getRangeSummary(userId, range.from, range.to);

    return {
        weekKey,
        range,
        daysCount: rangeSummary.daysCount,
        sleep: rangeSummary.sleep,
        training: rangeSummary.training,
        mediaCount: rangeSummary.mediaCount,
    };
};

export const getWeeksTrend = async (
    userId: string,
    fromWeek: WeekKey,
    toWeek: WeekKey,
    limitWeeks?: number
): Promise<WeeksTrendResponse> => {
    const fromRange = getWeekRangeFromKey(fromWeek);
    const toRange = getWeekRangeFromKey(toWeek);

    const days = await getDaysInRange(userId, fromRange.from, toRange.to);

    // group by weekKey
    const groups = new Map<string, any[]>();
    for (const d of days) {
        const wk = String((d as any).weekKey ?? "");
        if (!wk) continue;
        const arr = groups.get(wk) ?? [];
        arr.push(d);
        groups.set(wk, arr);
    }

    let points: WeekTrendPoint[] = Array.from(groups.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([weekKey, ds]) => {
            const daysCount = ds.length;

            const sleepSummaries = ds.map((d) => buildSleepSummaryFromDay(d)).filter(Boolean) as SummarySleep[];
            const daysWithSleep = sleepSummaries.length;

            const avgTotalMinutes = avgNullable(sleepSummaries.map((s) => s.totalMinutes));
            const avgDeepMinutes = avgNullable(sleepSummaries.map((s) => s.deepMinutes));
            const avgRemMinutes = avgNullable(sleepSummaries.map((s) => s.remMinutes));
            const avgScore = avgNullable(sleepSummaries.map((s) => s.score));

            const dayTrainingTotals = ds.map((d) => buildTrainingTotalsFromDay(d));
            const trainingTotals = mergeTrainingTotals(dayTrainingTotals);

            const range = getWeekRangeFromKey(weekKey);

            return {
                weekKey,
                range,
                daysCount,
                sleep: { daysWithSleep, avgTotalMinutes, avgDeepMinutes, avgRemMinutes, avgScore },
                training: {
                    sessionsCount: trainingTotals.sessionsCount,
                    durationSeconds: trainingTotals.durationSeconds,
                    activeKcal: trainingTotals.activeKcal,
                    avgHr: trainingTotals.avgHr,
                    maxHr: trainingTotals.maxHr,
                },
                mediaCount: trainingTotals.mediaCount,
            };
        });

    // Apply optional limit (keep the most recent N weeks in the computed window)
    if (typeof limitWeeks === "number" && Number.isFinite(limitWeeks) && limitWeeks > 0) {
        if (points.length > limitWeeks) {
            points = points.slice(points.length - limitWeeks);
        }
    }

    return { fromWeek, toWeek, points };
};

export const getPlanVsActualWeek = async (userId: string, weekKey: WeekKey): Promise<PlanVsActualWeekResponse> => {
    const userObjectId = toObjectId(userId);
    const range = getWeekRangeFromKey(weekKey);

    const routine = await WorkoutRoutineWeekModel.findOne({ userId: userObjectId, weekKey }).lean();

    const days = await getDaysInRange(userId, range.from, range.to);

    const byDate = new Map<string, any>();
    for (const d of days) byDate.set(String((d as any).date), d);

    // Routine has canonical 7 days in your init.
    const routineDays: any[] = routine?.days ?? [];

    // fallback: build a 7-day skeleton from range if no routine template exists
    const dayKeys = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
    const enumerateWeekDates = (from: string, to: string) => {
        const out: string[] = [];
        const start = new Date(`${from}T00:00:00.000Z`);
        const end = new Date(`${to}T00:00:00.000Z`);
        for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
            out.push(d.toISOString().slice(0, 10));
        }
        return out;
    };

    const dates = enumerateWeekDates(range.from, range.to);

    const outDays = dates.map((date, idx) => {
        const dayKey = dayKeys[idx];
        const dayDoc = byDate.get(date);

        const actualSessions: Array<{ id: string; type: string }> = ((dayDoc as any)?.training?.sessions ?? []).map((s: any) => ({
            id: String(s?._id),
            type: String(s?.type ?? "Unknown"),
        }));

        const routineDay =
            routineDays.find((d: any) => String(d?.date) === date) ??
            routineDays.find((d: any) => String(d?.dayKey) === dayKey) ??
            null;

        const plannedSessionType = routineDay ? (routineDay.sessionType ?? null) : null;

        // status logic (simple, predictable)
        // - if no planned session and no actual => rest
        // - planned and none actual => missed
        // - planned and has actual => done (or planned_and_extra if >1 and planned exists)
        // - not planned but has actual => extra
        let status: any = "rest";
        if (!plannedSessionType && actualSessions.length === 0) status = "rest";
        else if (plannedSessionType && actualSessions.length === 0) status = "missed";
        else if (!plannedSessionType && actualSessions.length > 0) status = "extra";
        else if (plannedSessionType && actualSessions.length > 0) status = actualSessions.length > 1 ? "planned_and_extra" : "done";

        return {
            date,
            dayKey,
            planned: routineDay
                ? {
                    sessionType: routineDay.sessionType ?? null,
                    focus: routineDay.focus ?? null,
                    tags: routineDay.tags ?? null,
                }
                : null,
            actual: { sessions: actualSessions },
            status,
        };
    });

    return {
        weekKey,
        range,
        hasRoutineTemplate: Boolean(routine),
        days: outDays,
    };
};

export const getMediaStats = async (
    userId: string,
    from: ISODate,
    to: ISODate,
    source: "day" | "routine" | "all" = "all"
): Promise<MediaStatsResponse> => {
    const userObjectId = toObjectId(userId);

    const byDayMap = new Map<string, { items: number; images: number; videos: number }>();

    let totalItems = 0;
    let totalImages = 0;
    let totalVideos = 0;

    const add = (date: string, rt: string) => {
        const prev = byDayMap.get(date) ?? { items: 0, images: 0, videos: 0 };
        prev.items += 1;
        totalItems += 1;

        if (rt === "image") {
            prev.images += 1;
            totalImages += 1;
        } else if (rt === "video") {
            prev.videos += 1;
            totalVideos += 1;
        }

        byDayMap.set(date, prev);
    };

    /**
     * ---------------------------------------------------------
     * 1) WorkoutDay session media (grouped by WorkoutDay.date)
     * ---------------------------------------------------------
     */
    if (source === "day" || source === "all") {
        const dayRows = await WorkoutDayModel.aggregate([
            { $match: { userId: userObjectId, date: { $gte: from, $lte: to } } },
            { $unwind: { path: "$training.sessions", preserveNullAndEmptyArrays: false } },
            { $unwind: { path: "$training.sessions.media", preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    _id: 0,
                    date: "$date",
                    resourceType: "$training.sessions.media.resourceType",
                },
            },
        ]);

        for (const r of dayRows as Array<{ date?: string; resourceType?: string }>) {
            if (!r.date || !r.resourceType) continue;
            add(r.date, r.resourceType);
        }
    }

    /**
     * ---------------------------------------------------------
     * 2) Routine attachments (grouped by attachments.createdAt date)
     *    - createdAt is ISO datetime string in your schema
     *    - we bucket to YYYY-MM-DD using substr
     * ---------------------------------------------------------
     */
    if (source === "routine" || source === "all") {
        const routineRows = await WorkoutRoutineWeekModel.aggregate([
            { $match: { userId: userObjectId } },
            { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    _id: 0,
                    createdDate: { $substrBytes: ["$attachments.createdAt", 0, 10] }, // "YYYY-MM-DD"
                    resourceType: "$attachments.resourceType",
                },
            },
            { $match: { createdDate: { $gte: from, $lte: to } } },
        ]);

        for (const r of routineRows as Array<{ createdDate?: string; resourceType?: string }>) {
            if (!r.createdDate || !r.resourceType) continue;
            add(r.createdDate, r.resourceType);
        }
    }

    const byDay = Array.from(byDayMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    return {
        range: { from, to },
        totals: { items: totalItems, images: totalImages, videos: totalVideos },
        byDay,
    };
};

