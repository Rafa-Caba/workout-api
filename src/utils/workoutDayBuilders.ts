// src/utils/workoutDayBuilders.ts

import type {
    BuildOpts,
    CalendarDayFull,
    CalendarTotals,
    TrainingTypeTotals,
    WeekRange,
} from "../types/workoutDay.types";

/**
 * =========================================================
 * Small helpers
 * =========================================================
 */

const safeAvg = (sum: number, count: number): number | null => {
    if (count <= 0) return null;
    return sum / count;
};

const addNullable = (a: number | null, b: number | null): number | null => {
    if (a === null && b === null) return null;
    return (a ?? 0) + (b ?? 0);
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const toArr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/**
 * =========================================================
 * Totals + summaries
 * =========================================================
 */

export const computeTrainingTotals = (day: any): CalendarTotals => {
    const sessions = day?.training?.sessions ?? null;

    // sessions must be a non-empty array to contribute totals
    if (!Array.isArray(sessions) || sessions.length === 0) {
        return {
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
        };
    }

    let totalSessions = 0;

    let totalDurationSeconds: number | null = null;
    let totalActiveKcal: number | null = null;
    let totalKcal: number | null = null;

    let totalDistanceKm: number | null = null;
    let totalSteps: number | null = null;
    let totalElevationGainM: number | null = null;

    // weighted averages
    let hrWeightedSum = 0;
    let hrWeight = 0;

    let cadenceWeightedSum = 0;
    let cadenceWeight = 0;

    let paceWeightedSum = 0;
    let paceWeight = 0; // distance weighting

    let maxHr: number | null = null;

    for (const s of sessions) {
        totalSessions += 1;

        totalDurationSeconds = addNullable(totalDurationSeconds, s.durationSeconds ?? null);
        totalActiveKcal = addNullable(totalActiveKcal, s.activeKcal ?? null);
        totalKcal = addNullable(totalKcal, s.totalKcal ?? null);

        totalDistanceKm = addNullable(totalDistanceKm, s.distanceKm ?? null);
        totalSteps = addNullable(totalSteps, s.steps ?? null);
        totalElevationGainM = addNullable(totalElevationGainM, s.elevationGainM ?? null);

        if (isNumber(s.maxHr)) {
            maxHr = maxHr === null ? s.maxHr : Math.max(maxHr, s.maxHr);
        }

        // duration-weighted avgHr
        if (isNumber(s.avgHr)) {
            const w = isNumber(s.durationSeconds) ? s.durationSeconds : 0;
            if (w > 0) {
                hrWeightedSum += s.avgHr * w;
                hrWeight += w;
            }
        }

        // duration-weighted cadence
        if (isNumber(s.cadenceRpm)) {
            const w = isNumber(s.durationSeconds) ? s.durationSeconds : 0;
            if (w > 0) {
                cadenceWeightedSum += s.cadenceRpm * w;
                cadenceWeight += w;
            }
        }

        // distance-weighted pace
        if (isNumber(s.paceSecPerKm)) {
            const w = isNumber(s.distanceKm) ? s.distanceKm : 0;
            if (w > 0) {
                paceWeightedSum += s.paceSecPerKm * w;
                paceWeight += w;
            }
        }
    }

    const avgHr = hrWeight > 0 ? round1(hrWeightedSum / hrWeight) : null;
    const avgCadenceRpm = cadenceWeight > 0 ? round1(cadenceWeightedSum / cadenceWeight) : null;
    const avgPaceSecPerKm = paceWeight > 0 ? round1(paceWeightedSum / paceWeight) : null;

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

export const computeTrainingTypes = (day: any): TrainingTypeTotals[] => {
    const sessions = day?.training?.sessions ?? null;
    if (!Array.isArray(sessions) || sessions.length === 0) return [];

    const map = new Map<string, any>();

    for (const s of sessions) {
        const type = String(s.type ?? "Unknown");

        if (!map.has(type)) {
            map.set(type, {
                type,
                sessions: 0,

                totalDurationSeconds: null,
                totalActiveKcal: null,
                totalKcal: null,

                totalDistanceKm: null,
                totalSteps: null,
                totalElevationGainM: null,

                hrWeightedSum: 0,
                hrWeight: 0,

                cadenceWeightedSum: 0,
                cadenceWeight: 0,

                paceWeightedSum: 0,
                paceWeight: 0,

                maxHr: null as number | null,
            });
        }

        const agg = map.get(type);

        agg.sessions += 1;

        agg.totalDurationSeconds = addNullable(agg.totalDurationSeconds, s.durationSeconds ?? null);
        agg.totalActiveKcal = addNullable(agg.totalActiveKcal, s.activeKcal ?? null);
        agg.totalKcal = addNullable(agg.totalKcal, s.totalKcal ?? null);

        agg.totalDistanceKm = addNullable(agg.totalDistanceKm, s.distanceKm ?? null);
        agg.totalSteps = addNullable(agg.totalSteps, s.steps ?? null);
        agg.totalElevationGainM = addNullable(agg.totalElevationGainM, s.elevationGainM ?? null);

        if (isNumber(s.maxHr)) {
            agg.maxHr = agg.maxHr === null ? s.maxHr : Math.max(agg.maxHr, s.maxHr);
        }

        if (isNumber(s.avgHr)) {
            const w = isNumber(s.durationSeconds) ? s.durationSeconds : 0;
            if (w > 0) {
                agg.hrWeightedSum += s.avgHr * w;
                agg.hrWeight += w;
            }
        }

        if (isNumber(s.cadenceRpm)) {
            const w = isNumber(s.durationSeconds) ? s.durationSeconds : 0;
            if (w > 0) {
                agg.cadenceWeightedSum += s.cadenceRpm * w;
                agg.cadenceWeight += w;
            }
        }

        if (isNumber(s.paceSecPerKm)) {
            const w = isNumber(s.distanceKm) ? s.distanceKm : 0;
            if (w > 0) {
                agg.paceWeightedSum += s.paceSecPerKm * w;
                agg.paceWeight += w;
            }
        }
    }

    const out: TrainingTypeTotals[] = [];

    for (const agg of map.values()) {
        const avgHr = agg.hrWeight > 0 ? round1(agg.hrWeightedSum / agg.hrWeight) : null;
        const avgCadenceRpm =
            agg.cadenceWeight > 0 ? round1(agg.cadenceWeightedSum / agg.cadenceWeight) : null;
        const avgPaceSecPerKm =
            agg.paceWeight > 0 ? round1(agg.paceWeightedSum / agg.paceWeight) : null;

        out.push({
            type: agg.type,
            sessions: agg.sessions,

            totalDurationSeconds: agg.totalDurationSeconds,
            totalActiveKcal: agg.totalActiveKcal,
            totalKcal: agg.totalKcal,

            totalDistanceKm: agg.totalDistanceKm,
            totalSteps: agg.totalSteps,
            totalElevationGainM: agg.totalElevationGainM,

            avgHr,
            maxHr: agg.maxHr,

            avgPaceSecPerKm,
            avgCadenceRpm,
        });
    }

    out.sort((a, b) => {
        if (b.sessions !== a.sessions) return b.sessions - a.sessions;
        return a.type.localeCompare(b.type);
    });

    return out;
};

export const computeSleepSummary = (day: any) => {
    const s = day?.sleep ?? null;
    if (!s) return null;

    const hasAny =
        s.timeAsleepMinutes != null ||
        s.timeInBedMinutes != null ||
        s.score != null ||
        s.awakeMinutes != null ||
        s.remMinutes != null ||
        s.coreMinutes != null ||
        s.deepMinutes != null;

    if (!hasAny) return null;

    return {
        timeAsleepMinutes: s.timeAsleepMinutes ?? null,
        timeInBedMinutes: s.timeInBedMinutes ?? null,
        score: s.score ?? null,
        awakeMinutes: s.awakeMinutes ?? null,
        remMinutes: s.remMinutes ?? null,
        coreMinutes: s.coreMinutes ?? null,
        deepMinutes: s.deepMinutes ?? null,
    };
};

export const computeTrainingSummary = (day: any) => {
    const t = day?.training ?? null;
    const sessions = t?.sessions ?? null;

    const hasSessionsArray = Array.isArray(sessions);
    const hasTrainingSessions = hasSessionsArray && sessions.length > 0;

    // IMPORTANT:
    // - if training exists (even with sessions: []) we still consider summary valid if source/dayEffort exist
    // - we do NOT null-out training just because sessions is []
    const hasAnyTrainingMeta = t?.dayEffortRpe != null || t?.source != null;

    if (!hasTrainingSessions && !hasAnyTrainingMeta) return null;

    return {
        source: t?.source ?? null,
        dayEffortRpe: t?.dayEffortRpe ?? null,
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
    "sleepSummary",
    "trainingSummary",
    "trainingTotals",
    "trainingTypes",
] as const;

export const pickFields = (obj: CalendarDayFull, fields: string[] | null): CalendarDayFull => {
    const allowed = (fields ?? Array.from(DEFAULT_FIELDS_ALL)) as Array<keyof CalendarDayFull>;

    const out: CalendarDayFull = {};
    for (const k of allowed) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            (out as any)[k] = (obj as any)[k];
        }
    }
    return out;
};


/**
 * =========================================================
 * Fill missing days
 * =========================================================
 */

const addDays = (iso: string, deltaDays: number): string => {
    const d = new Date(`${iso}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
};

export const enumerateDays = (from: string, to: string): string[] => {
    const out: string[] = [];
    let cur = from;
    while (cur <= to) {
        out.push(cur);
        cur = addDays(cur, 1);
    }
    return out;
};

/**
 * =========================================================
 * Build day object (calendar/week) - pure
 * NOTE: service provides weekKey(date) function via callback.
 * =========================================================
 */

export const buildCalendarDay = (
    day: any,
    opts: BuildOpts,
    getWeekKeyFromISODate: (isoDate: string) => string
) => {
    // Training existence rules:
    // - hasTraining is TRUE only if sessions array exists and has length > 0
    // - BUT we still return training block if includeTraining=true and day.training exists (even if sessions is [])
    const sessions = day?.training?.sessions ?? null;
    const hasTraining = Array.isArray(sessions) && sessions.length > 0;

    const s = day?.sleep ?? null;
    const hasSleep =
        !!s &&
        (s.timeAsleepMinutes != null ||
            s.score != null ||
            s.awakeMinutes != null ||
            s.remMinutes != null ||
            s.coreMinutes != null ||
            s.deepMinutes != null);

    const sleepSummary = opts.includeSummaries ? computeSleepSummary(day) : undefined;
    const trainingSummary = opts.includeSummaries ? computeTrainingSummary(day) : undefined;

    const trainingTotals = opts.includeTotals ? computeTrainingTotals(day) : undefined;
    const trainingTypes = opts.includeTypes ? computeTrainingTypes(day) : undefined;

    const full: CalendarDayFull = {
        date: day.date,
        weekKey: day.weekKey ?? getWeekKeyFromISODate(day.date),

        hasSleep,
        hasTraining,

        sleep: opts.includeSleep ? day.sleep ?? null : undefined,
        training: opts.includeTraining ? day.training ?? null : undefined,

        notes: day.notes ?? null,
        tags: day.tags ?? null,
        meta: day.meta ?? null,

        sleepSummary: sleepSummary ?? null,
        trainingSummary: trainingSummary ?? null,

        // stable outputs for field-picking; if not included, still compute so existing clients won't break
        trainingTotals: trainingTotals ?? computeTrainingTotals(day),
        trainingTypes: trainingTypes ?? computeTrainingTypes(day),
    };

    // includeRaw=false means strip raw blobs inside sleep/training
    if (!opts.includeRaw) {
        if (full.sleep && typeof full.sleep === "object") {
            full.sleep = { ...(full.sleep as any), raw: null };
        }

        if (full.training && typeof full.training === "object") {
            const t = full.training as any;

            // Always null raw
            full.training = { ...t, raw: null };

            // Normalize sessions to [] for output if it is null (optional)
            // BUT: we should not change semantics inside stored DB, only output shaping.
            const outT = full.training as any;
            if (outT.sessions == null) {
                // keep null as-is to preserve exact state if client cares
                // If you prefer always array in responses, change this to `outT.sessions = []`
            }

            // Ensure session meta exists
            if (Array.isArray(outT.sessions)) {
                outT.sessions = outT.sessions.map((sess: any) => ({
                    ...sess,
                    meta: sess.meta ?? null,
                    media: Array.isArray(sess.media) ? sess.media : [],
                }));
            }
        }
    }

    if (!opts.includeSleep) delete (full as any).sleep;
    if (!opts.includeTraining) delete (full as any).training;

    if (!opts.includeSummaries) {
        delete (full as any).sleepSummary;
        delete (full as any).trainingSummary;
    }
    if (!opts.includeTotals) delete (full as any).trainingTotals;
    if (!opts.includeTypes) delete (full as any).trainingTypes;

    return full;
};

/**
 * =========================================================
 * Rollups (calendar/week) - pure
 * =========================================================
 */

export const rollupFromDays = (days: any[], getWeekKeyFromISODate: (isoDate: string) => string) => {
    // duration-weighted avgHr + cadence
    let hrWeightedSum = 0;
    let hrWeight = 0;

    let cadenceWeightedSum = 0;
    let cadenceWeight = 0;

    let paceWeightedSum = 0;
    let paceWeight = 0; // distance weighting

    // totals
    const totals: CalendarTotals = {
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
    };

    const typeAgg = new Map<string, any>();

    // sleep averages
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

    for (const d of days) {
        // ---- Sleep ----
        if (d.sleep) {
            const s = d.sleep;
            const hasAny =
                s.timeAsleepMinutes != null ||
                s.score != null ||
                s.awakeMinutes != null ||
                s.remMinutes != null ||
                s.coreMinutes != null ||
                s.deepMinutes != null;

            if (hasAny) daysWithSleep++;

            if (s.timeAsleepMinutes != null) {
                sleepTimeSum += s.timeAsleepMinutes;
                sleepTimeCount++;
            }
            if (s.score != null) {
                sleepScoreSum += s.score;
                sleepScoreCount++;
            }
            if (s.awakeMinutes != null) {
                awakeSum += s.awakeMinutes;
                awakeCount++;
            }
            if (s.remMinutes != null) {
                remSum += s.remMinutes;
                remCount++;
            }
            if (s.coreMinutes != null) {
                coreSum += s.coreMinutes;
                coreCount++;
            }
            if (s.deepMinutes != null) {
                deepSum += s.deepMinutes;
                deepCount++;
            }
        }

        const sessions = d.training?.sessions ?? null;
        if (!Array.isArray(sessions) || sessions.length === 0) continue;

        for (const s of sessions) {
            totals.totalSessions += 1;

            totals.totalDurationSeconds = addNullable(totals.totalDurationSeconds, s.durationSeconds ?? null);
            totals.totalActiveKcal = addNullable(totals.totalActiveKcal, s.activeKcal ?? null);
            totals.totalKcal = addNullable(totals.totalKcal, s.totalKcal ?? null);

            totals.totalDistanceKm = addNullable(totals.totalDistanceKm, s.distanceKm ?? null);
            totals.totalSteps = addNullable(totals.totalSteps, s.steps ?? null);
            totals.totalElevationGainM = addNullable(totals.totalElevationGainM, s.elevationGainM ?? null);

            if (isNumber(s.maxHr)) {
                totals.maxHr = totals.maxHr === null ? s.maxHr : Math.max(totals.maxHr, s.maxHr);
            }

            const dur = isNumber(s.durationSeconds) ? s.durationSeconds : 0;
            if (isNumber(s.avgHr) && dur > 0) {
                hrWeightedSum += s.avgHr * dur;
                hrWeight += dur;
            }
            if (isNumber(s.cadenceRpm) && dur > 0) {
                cadenceWeightedSum += s.cadenceRpm * dur;
                cadenceWeight += dur;
            }

            const dist = isNumber(s.distanceKm) ? s.distanceKm : 0;
            if (isNumber(s.paceSecPerKm) && dist > 0) {
                paceWeightedSum += s.paceSecPerKm * dist;
                paceWeight += dist;
            }

            const type = String(s.type ?? "Unknown");
            if (!typeAgg.has(type)) {
                typeAgg.set(type, {
                    type,
                    sessions: 0,
                    totalDurationSeconds: null,
                    totalActiveKcal: null,
                    totalKcal: null,
                    totalDistanceKm: null,
                    totalSteps: null,
                    totalElevationGainM: null,
                    maxHr: null as number | null,
                    hrWeightedSum: 0,
                    hrWeight: 0,
                    cadenceWeightedSum: 0,
                    cadenceWeight: 0,
                    paceWeightedSum: 0,
                    paceWeight: 0,
                });
            }

            const agg = typeAgg.get(type);
            agg.sessions += 1;

            agg.totalDurationSeconds = addNullable(agg.totalDurationSeconds, s.durationSeconds ?? null);
            agg.totalActiveKcal = addNullable(agg.totalActiveKcal, s.activeKcal ?? null);
            agg.totalKcal = addNullable(agg.totalKcal, s.totalKcal ?? null);

            agg.totalDistanceKm = addNullable(agg.totalDistanceKm, s.distanceKm ?? null);
            agg.totalSteps = addNullable(agg.totalSteps, s.steps ?? null);
            agg.totalElevationGainM = addNullable(agg.totalElevationGainM, s.elevationGainM ?? null);

            if (isNumber(s.maxHr)) {
                agg.maxHr = agg.maxHr === null ? s.maxHr : Math.max(agg.maxHr, s.maxHr);
            }

            if (isNumber(s.avgHr) && dur > 0) {
                agg.hrWeightedSum += s.avgHr * dur;
                agg.hrWeight += dur;
            }
            if (isNumber(s.cadenceRpm) && dur > 0) {
                agg.cadenceWeightedSum += s.cadenceRpm * dur;
                agg.cadenceWeight += dur;
            }
            if (isNumber(s.paceSecPerKm) && dist > 0) {
                agg.paceWeightedSum += s.paceSecPerKm * dist;
                agg.paceWeight += dist;
            }
        }
    }

    totals.avgHr = hrWeight > 0 ? round1(hrWeightedSum / hrWeight) : null;
    totals.avgCadenceRpm = cadenceWeight > 0 ? round1(cadenceWeightedSum / cadenceWeight) : null;
    totals.avgPaceSecPerKm = paceWeight > 0 ? round1(paceWeightedSum / paceWeight) : null;

    const trainingTypes: TrainingTypeTotals[] = Array.from(typeAgg.values()).map((agg) => ({
        type: agg.type,
        sessions: agg.sessions,

        totalDurationSeconds: agg.totalDurationSeconds,
        totalActiveKcal: agg.totalActiveKcal,
        totalKcal: agg.totalKcal,

        totalDistanceKm: agg.totalDistanceKm,
        totalSteps: agg.totalSteps,
        totalElevationGainM: agg.totalElevationGainM,

        avgHr: agg.hrWeight > 0 ? round1(agg.hrWeightedSum / agg.hrWeight) : null,
        maxHr: agg.maxHr,

        avgPaceSecPerKm: agg.paceWeight > 0 ? round1(agg.paceWeightedSum / agg.paceWeight) : null,
        avgCadenceRpm: agg.cadenceWeight > 0 ? round1(agg.cadenceWeightedSum / agg.cadenceWeight) : null,
    }));

    trainingTypes.sort((a, b) => {
        if (b.sessions !== a.sessions) return b.sessions - a.sessions;
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
    return { trainingTotals: totals, trainingTypes, sleepAverages };
};

/**
 * =========================================================
 * Week parsing helpers
 * =========================================================
 */

const WEEK_KEY_REGEX = /^(\d{4})-W(\d{2})$/;

export const parseWeekKey = (weekKey: string): { year: number; week: number } => {
    const m = WEEK_KEY_REGEX.exec(weekKey);
    if (!m) {
        throw new Error(`Invalid weekKey "${weekKey}". Expected format: YYYY-W##`);
    }
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) {
        throw new Error(`Invalid weekKey "${weekKey}". Week must be 01..53`);
    }
    return { year, week };
};

// ISO week start (Monday) for a given year/week in UTC
export const isoWeekStart = (year: number, week: number): Date => {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7; // Mon=1..Sun=7
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1)); // Monday of week 1
    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
    return monday;
};

export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

export const getWeekRangeFromKey = (weekKey: string): WeekRange => {
    const { year, week } = parseWeekKey(weekKey);
    const start = isoWeekStart(year, week);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { from: toISODate(start), to: toISODate(end) };
};
