import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { getWeekKeyFromISODate } from "../utils/weekKey";
import {
    pickFields,
    enumerateDays,
    buildCalendarDay,
    rollupFromDays,
    getWeekRangeFromKey,
} from "../utils/workoutDayBuilders";
import type { BuildOpts, StatsRangeArgs, UpsertArgs, WeekViewResponse } from "../types/workoutDay.types";

/**
 * =========================================================
 * Small helpers (service-local)
 * =========================================================
 */

const safeAvg = (sum: number, count: number): number | null => {
    if (count <= 0) return null;
    return sum / count;
};

const safeSumOrNull = (sum: number, count: number): number | null => {
    return count > 0 ? sum : null;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
    return typeof v === "object" && v !== null && !Array.isArray(v);
};

const hasOwn = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Canonical defaults for a WorkoutDay document (user + date scoped).
 * NOTE: weekKey is derived from date and always enforced.
 */
const buildCanonicalDefaults = (userObjectId: mongoose.Types.ObjectId, date: string) => {
    const weekKey = getWeekKeyFromISODate(date);

    return {
        userId: userObjectId,
        date,
        weekKey,

        sleep: null,
        training: null,

        notes: null,
        tags: null,
        meta: null,
    };
};

/**
 * Merge rules (mode="merge"):
 * - if field is undefined => keep existing
 * - if field is null => set null (clear)
 * - if field is object => shallow merge (existing + incoming)
 * - training.sessions (array): if provided (even empty array) => replace; if undefined => keep
 */
const mergeTrainingBlock = (existing: any, incoming: any): any => {
    if (incoming === undefined) return existing;
    if (incoming === null) return null;
    if (!isPlainObject(incoming)) return incoming;

    const out: any = isPlainObject(existing) ? { ...existing } : {};

    // sessions: replace only if explicitly provided (empty array is valid)
    if (hasOwn(incoming, "sessions")) {
        out.sessions = (incoming as any).sessions ?? null;
    }

    // merge the rest shallowly
    for (const [k, v] of Object.entries(incoming)) {
        if (k === "sessions") continue;
        out[k] = v as any;
    }

    return out;
};

const mergeSleepBlock = (existing: any, incoming: any): any => {
    if (incoming === undefined) return existing;
    if (incoming === null) return null;
    if (!isPlainObject(incoming)) return incoming;
    const base = isPlainObject(existing) ? existing : {};
    return { ...base, ...incoming };
};

const mergeGeneric = (existing: any, incoming: any): any => {
    if (incoming === undefined) return existing;
    if (incoming === null) return null;
    if (isPlainObject(existing) && isPlainObject(incoming)) return { ...existing, ...incoming };
    return incoming;
};

/**
 * Replace rules (mode="replace") — TRUE FULL REPLACE:
 * - any field NOT PRESENT in payload is reset to canonical default (null)
 * - weekKey is always recomputed from date
 * - does not allow overwriting userId/date/weekKey
 */
const applyFullReplace = (userObjectId: mongoose.Types.ObjectId, date: string, payload: any) => {
    const base = buildCanonicalDefaults(userObjectId, date);
    const out: any = { ...base };

    if (hasOwn(payload, "sleep")) out.sleep = payload.sleep;
    if (hasOwn(payload, "training")) out.training = payload.training;

    if (hasOwn(payload, "notes")) out.notes = payload.notes;
    if (hasOwn(payload, "tags")) out.tags = payload.tags;
    if (hasOwn(payload, "meta")) out.meta = payload.meta;

    out.weekKey = getWeekKeyFromISODate(date);
    return out;
};

/**
 * =========================================================
 * Stats
 * =========================================================
 */

export const getStatsInRange = async ({ userId, from, to }: StatsRangeArgs) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const days = await WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: from, $lte: to },
    })
        .sort({ date: 1 })
        .lean();

    // ------------------
    // Sleep aggregation
    // ------------------
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

    // ------------------
    // Training aggregation
    // ------------------
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

    for (const d of days as any[]) {
        // ---- Sleep ----
        if (d.sleep) {
            const hasAnySleepValue =
                d.sleep.timeAsleepMinutes != null ||
                d.sleep.score != null ||
                d.sleep.awakeMinutes != null ||
                d.sleep.remMinutes != null ||
                d.sleep.coreMinutes != null ||
                d.sleep.deepMinutes != null;

            if (hasAnySleepValue) daysWithSleep++;

            if (d.sleep.timeAsleepMinutes != null) {
                sleepTimeSum += d.sleep.timeAsleepMinutes;
                sleepTimeCount++;
            }
            if (d.sleep.score != null) {
                sleepScoreSum += d.sleep.score;
                sleepScoreCount++;
            }
            if (d.sleep.awakeMinutes != null) {
                awakeSum += d.sleep.awakeMinutes;
                awakeCount++;
            }
            if (d.sleep.remMinutes != null) {
                remSum += d.sleep.remMinutes;
                remCount++;
            }
            if (d.sleep.coreMinutes != null) {
                coreSum += d.sleep.coreMinutes;
                coreCount++;
            }
            if (d.sleep.deepMinutes != null) {
                deepSum += d.sleep.deepMinutes;
                deepCount++;
            }
        }

        // ---- Training ----
        const sessions = d.training?.sessions ?? null;

        if (sessions && Array.isArray(sessions) && sessions.length > 0) {
            daysWithTraining++;
            totalSessions += sessions.length;

            if (d.training?.dayEffortRpe != null) {
                dayEffortSum += d.training.dayEffortRpe;
                dayEffortCount++;
            }

            for (const s of sessions) {
                if (s.activeKcal != null) {
                    activeKcalSum += s.activeKcal;
                    activeKcalCount++;
                }
                if (s.distanceKm != null) {
                    distanceKmSum += s.distanceKm;
                    distanceKmCount++;
                }
                if (s.avgHr != null) {
                    avgHrSum += s.avgHr;
                    avgHrCount++;
                }
                if (s.maxHr != null) {
                    maxHrSum += s.maxHr;
                    maxHrCount++;
                }
            }
        } else if (d.training) {
            // training block exists but no sessions
            if (d.training.dayEffortRpe != null) {
                dayEffortSum += d.training.dayEffortRpe;
                dayEffortCount++;
            }
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

    return day ? day.toJSON() : null;
};

export const getDaysInRange = async (userId: string, from: string, to: string) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const days = await WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: from, $lte: to },
    }).sort({ date: 1 });

    return days.map((d) => d.toJSON());
};

/**
 * =========================================================
 * Upsert Day
 * =========================================================
 */

export const upsertWorkoutDay = async ({ userId, date, payload, mode }: UpsertArgs) => {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const weekKey = getWeekKeyFromISODate(date);

    const existing = await WorkoutDayModel.findOne({ userId: userObjectId, date });

    if (!existing) {
        // Create new
        if (mode === "replace") {
            const createDoc = applyFullReplace(userObjectId, date, payload);
            const created = await WorkoutDayModel.create(createDoc);
            return created.toJSON();
        }

        // merge mode create: apply defaults then merge in
        const base = buildCanonicalDefaults(userObjectId, date);
        const createDoc: any = { ...base };

        createDoc.sleep = mergeSleepBlock(createDoc.sleep, payload.sleep);
        createDoc.training = mergeTrainingBlock(createDoc.training, payload.training);

        createDoc.notes = mergeGeneric(createDoc.notes, payload.notes);
        createDoc.tags = mergeGeneric(createDoc.tags, payload.tags);
        createDoc.meta = mergeGeneric(createDoc.meta, payload.meta);

        createDoc.weekKey = weekKey;

        const created = await WorkoutDayModel.create(createDoc);
        return created.toJSON();
    }

    // Update existing
    if (mode === "replace") {
        const next = applyFullReplace(userObjectId, date, payload);

        (existing as any).sleep = next.sleep;
        (existing as any).training = next.training;

        (existing as any).notes = next.notes;
        (existing as any).tags = next.tags;
        (existing as any).meta = next.meta;

        (existing as any).weekKey = weekKey;

        const saved = await existing.save();
        return saved.toJSON();
    }

    // merge mode
    (existing as any).sleep = mergeSleepBlock((existing as any).sleep, payload.sleep);
    (existing as any).training = mergeTrainingBlock((existing as any).training, payload.training);

    (existing as any).notes = mergeGeneric((existing as any).notes, payload.notes);
    (existing as any).tags = mergeGeneric((existing as any).tags, payload.tags);
    (existing as any).meta = mergeGeneric((existing as any).meta, payload.meta);

    (existing as any).weekKey = weekKey;

    const saved = await existing.save();
    return saved.toJSON();
};

/**
 * =========================================================
 * Calendar endpoint (used by /calendar)
 * =========================================================
 */

export const getCalendarInRange = async (
    userId: string,
    from: string,
    to: string,
    fields: string[] | null,
    opts: Omit<BuildOpts, "fields">
) => {
    const docs = await WorkoutDayModel.find({
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: from, $lte: to },
    }).sort({ date: 1 });

    const byDate = new Map<string, any>();
    for (const doc of docs) {
        const day = doc.toJSON();
        byDate.set(day.date, day);
    }

    const dates = opts.fillMissingDays ? enumerateDays(from, to) : Array.from(byDate.keys()).sort();

    const builtDays = dates.map((date) => {
        const day =
            byDate.get(date) ??
            ({
                date,
                weekKey: getWeekKeyFromISODate(date),
                sleep: null,
                training: null,
                notes: null,
                tags: null,
                meta: null,
            } as any);

        const full = buildCalendarDay(day, { ...opts, fields } as BuildOpts, getWeekKeyFromISODate);
        return pickFields(full, fields);
    });

    const response: any = {
        from,
        to,
        fields: fields ?? null,
        fillMissingDays: opts.fillMissingDays,
        days: builtDays,
    };

    if (opts.includeRollups) {
        const rollupDays = dates.map((date) => {
            return (
                byDate.get(date) ?? {
                    date,
                    weekKey: getWeekKeyFromISODate(date),
                    sleep: null,
                    training: null,
                    notes: null,
                    tags: null,
                    meta: null,
                }
            );
        });

        response.rollups = rollupFromDays(rollupDays, getWeekKeyFromISODate);
    }

    return response;
};

/**
 * =========================================================
 * Week endpoint
 * - weekKey: "YYYY-W##"
 * - Returns Monday..Sunday range (UTC) with same options as calendar
 * =========================================================
 */

export const getWeekViewByKey = async (
    userId: string,
    weekKey: string,
    fields: string[] | null,
    opts: Omit<BuildOpts, "fields">
): Promise<WeekViewResponse> => {
    const range = getWeekRangeFromKey(weekKey);

    const calendar = await getCalendarInRange(userId, range.from, range.to, fields, opts);

    const out: WeekViewResponse = {
        weekKey,
        range,
        fields: calendar.fields,
        fillMissingDays: calendar.fillMissingDays,
        days: calendar.days,
        ...(calendar.rollups ? { rollups: calendar.rollups } : {}),
    };

    return out;
};
