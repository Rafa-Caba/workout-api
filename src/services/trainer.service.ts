import mongoose from "mongoose";
import { UserModel } from "../models/User.model";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";
import type { BuildOpts } from "../types/workoutDay.types";
import { getWeekViewByKey } from "./workoutDay.service";

type Role = "admin" | "user";
type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

const DAY_KEYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toIsoDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * WeekKey format: YYYY-W##
 * Compute ISO week Monday as "from", Sunday as "to".
 */
function weekKeyToRange(weekKey: string): { from: string; to: string } {
    const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
    if (!m) throw new Error(`Invalid weekKey: ${weekKey}`);
    const year = Number(m[1]);
    const week = Number(m[2]);

    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // Mon=1..Sun=7
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return { from: toIsoDate(monday), to: toIsoDate(sunday) };
}

function isoDateToWeekKey(dateStr: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) throw new Error(`Invalid date: ${dateStr}`);

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);

    const date = new Date(Date.UTC(y, mo - 1, da));
    const dayOfWeek = date.getUTCDay() || 7; // Mon=1..Sun=7
    const thursday = new Date(date);
    thursday.setUTCDate(date.getUTCDate() + (4 - dayOfWeek));

    const isoYear = thursday.getUTCFullYear();

    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const jan4Dow = jan4.getUTCDay() || 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));

    const diffMs = thursday.getTime() - week1Monday.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const week = Math.floor(diffDays / 7) + 1;

    return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function isEmptyPlannedDay(day: any): boolean {
    const sessionType = typeof day?.sessionType === "string" ? day.sessionType.trim() : "";
    const focus = typeof day?.focus === "string" ? day.focus.trim() : "";
    const notes = typeof day?.notes === "string" ? day.notes.trim() : "";
    const tags = Array.isArray(day?.tags) ? day.tags.filter(Boolean) : [];
    const exercises = Array.isArray(day?.exercises) ? day.exercises : null;

    const hasExercises = Array.isArray(exercises) && exercises.length > 0;
    const hasTags = Array.isArray(tags) && tags.length > 0;

    return !sessionType && !focus && !notes && !hasTags && !hasExercises;
}

function mapRoutineDayToPlannedRoutine(day: any) {
    return {
        sessionType: typeof day?.sessionType === "string" ? day.sessionType : null,
        focus: typeof day?.focus === "string" ? day.focus : null,
        exercises: Array.isArray(day?.exercises) ? day.exercises : null,
        notes: typeof day?.notes === "string" ? day.notes : null,
        tags: Array.isArray(day?.tags) ? day.tags : null,
    };
}

export async function listTrainees(trainerId: string, role: Role) {
    if (role === "admin") {
        const docs = await UserModel.find({ coachMode: "TRAINEE" }).sort({ createdAt: -1 }).exec();
        return docs.map((d) => d.toJSON());
    }

    const docs = await UserModel.find({
        coachMode: "TRAINEE",
        assignedTrainer: new mongoose.Types.ObjectId(trainerId),
    })
        .sort({ createdAt: -1 })
        .exec();

    return docs.map((d) => d.toJSON());
}

export async function getTraineeDayByDate(traineeId: string, date: string) {
    const doc = await WorkoutDayModel.findOne({ userId: traineeId, date }).exec();
    return { day: doc ? doc.toJSON() : null };
}

export async function getTraineeWeekViewByKey(traineeId: string, weekKey: string, q: any) {
    const fields = Array.isArray(q.fields) ? q.fields : q.fields ? String(q.fields).split(",") : null;

    const opts: Omit<BuildOpts, "fields"> = {
        fillMissingDays: q.fillMissingDays === "true" || q.fillMissingDays === true,
        includeRollups: q.includeRollups === "true" || q.includeRollups === true,

        includeSleep: q.includeSleep === "false" ? false : true,
        includeTraining: q.includeTraining === "false" ? false : true,

        includeSummaries: q.includeSummaries === "false" ? false : true,
        includeTotals: q.includeTotals === "true" || q.includeTotals === true,
        includeTypes: q.includeTypes === "true" || q.includeTypes === true,

        includeRaw: q.includeRaw === "true" || q.includeRaw === true,
    };

    return await getWeekViewByKey(traineeId, weekKey, fields, opts);
}

export async function getTraineeRecovery(traineeId: string, from: string, to: string) {
    const docs = await WorkoutDayModel.find({
        userId: new mongoose.Types.ObjectId(traineeId),
        date: { $gte: from, $lte: to },
    })
        .sort({ date: 1 })
        .exec();

    return {
        from,
        to,
        days: docs.map((d) => {
            const j: any = d.toJSON();
            return {
                date: j.date,
                sleep: j.sleep ?? null,
                training: j.training ?? null,
                hasTraining: !!j.training,
            };
        }),
    };
}

export async function patchTraineePlannedRoutine(args: {
    trainerId: string;
    trainerRole: Role;
    traineeId: string;
    date: string;
    plannedRoutine: any | null;
    plannedMeta: { plannedAt: string; source?: "trainer" | "template" } | null;
}) {
    const { trainerId, traineeId, date, plannedRoutine, plannedMeta } = args;

    const trainee = await UserModel.findById(traineeId).select("_id").lean().exec();
    if (!trainee) {
        throw { statusCode: 404, code: "TRAINEE_NOT_FOUND", message: "Trainee not found" };
    }

    const existing = await WorkoutDayModel.findOne({ userId: traineeId, date }).exec();

    if (existing) {
        if (existing.training) {
            throw {
                statusCode: 409,
                code: "PLANNED_LOCKED_BY_TRAINING",
                message: "Cannot modify planned routine because actual training exists for this day.",
            };
        }

        existing.plannedRoutine = plannedRoutine as any;

        if (plannedRoutine) {
            existing.plannedMeta = {
                plannedBy: new mongoose.Types.ObjectId(trainerId),
                plannedAt: plannedMeta?.plannedAt ?? new Date().toISOString(),
                source: plannedMeta?.source ?? "trainer",
            } as any;
        } else {
            existing.plannedMeta = null as any;
        }

        await existing.save();
        return existing.toJSON();
    }

    const weekKey = isoDateToWeekKey(date);

    const created = await WorkoutDayModel.create({
        userId: new mongoose.Types.ObjectId(traineeId),
        date,
        weekKey,

        sleep: null,
        training: null,

        plannedRoutine: plannedRoutine ?? null,
        plannedMeta: plannedRoutine
            ? {
                plannedBy: new mongoose.Types.ObjectId(trainerId),
                plannedAt: plannedMeta?.plannedAt ?? new Date().toISOString(),
                source: plannedMeta?.source ?? "trainer",
            }
            : null,

        notes: null,
        tags: null,
        meta: null,
    });

    return created.toJSON();
}

/**
 * Weekly Assign (MVP)
 * - ALWAYS processes 7 days (Mon..Sun) for the target weekKey.
 * - Source: trainer's own WorkoutRoutineWeek (template)
 * - Target: trainee's WorkoutDay.plannedRoutine for each day in the week
 * - Lock: if training exists -> do not modify plannedRoutine/meta
 * - Report counts
 *
 * NOTE:
 * We key the template by dayKey (Mon..Sun), not by date, to be robust
 * against older/partial templates that might miss date fields.
 */
export async function assignWeekToTrainee(args: {
    trainerId: string;
    trainerRole: Role;

    traineeId: string;
    weekKey: string;

    clearEmptyDays: boolean;
    plannedAt: string | null;
}) {
    const { trainerId, traineeId, weekKey, clearEmptyDays, plannedAt } = args;

    const template = await WorkoutRoutineWeekModel.findOne({
        userId: new mongoose.Types.ObjectId(trainerId),
        weekKey,
    }).exec();

    if (!template) {
        throw {
            statusCode: 404,
            code: "TEMPLATE_WEEK_NOT_FOUND",
            message: "Routine week template not found for trainer",
        };
    }

    const templateDays = Array.isArray((template as any).days) ? (template as any).days : [];

    // Map template day by dayKey
    const templateByDayKey = new Map<DayKey, any>();
    for (const d of templateDays) {
        const dk = typeof d?.dayKey === "string" ? (d.dayKey as DayKey) : null;
        if (!dk) continue;
        if (!DAY_KEYS.includes(dk)) continue;
        templateByDayKey.set(dk, d);
    }

    const range = weekKeyToRange(weekKey);
    const start = new Date(`${range.from}T00:00:00.000Z`);

    const plannedAtIso = plannedAt ?? new Date().toISOString();

    const report = {
        weekKey,
        traineeId,
        templateWeekId: String((template as any).id ?? (template as any)._id),

        totalWeekDays: 7,
        totalTemplateDays: templateDays.length,

        createdPlanned: 0,
        createdRest: 0,
        updatedPlanned: 0,
        clearedToRest: 0,

        skippedLockedByTraining: 0,
        skippedNoop: 0,
    };

    // Always iterate 7 days (Mon..Sun)
    for (let i = 0; i < 7; i++) {
        const dayKey = DAY_KEYS[i];
        const d = new Date(start);
        d.setUTCDate(start.getUTCDate() + i);
        const date = toIsoDate(d);

        const tpl = templateByDayKey.get(dayKey) ?? null;

        // If template doesn't have that day, treat as empty/rest
        const empty = tpl ? isEmptyPlannedDay(tpl) : true;
        const desiredPlannedRoutine = empty ? null : mapRoutineDayToPlannedRoutine(tpl);

        const existing = await WorkoutDayModel.findOne({
            userId: new mongoose.Types.ObjectId(traineeId),
            date,
        }).exec();

        if (existing) {
            if (existing.training) {
                report.skippedLockedByTraining += 1;
                continue;
            }

            // If rest day and we are not clearing, do nothing
            if (desiredPlannedRoutine === null && !clearEmptyDays) {
                report.skippedNoop += 1;
                continue;
            }

            const before = JSON.stringify(existing.plannedRoutine ?? null);
            const after = JSON.stringify(desiredPlannedRoutine);

            if (before === after) {
                report.skippedNoop += 1;
                continue;
            }

            existing.plannedRoutine = desiredPlannedRoutine as any;

            if (desiredPlannedRoutine) {
                existing.plannedMeta = {
                    plannedBy: new mongoose.Types.ObjectId(trainerId),
                    plannedAt: plannedAtIso,
                    source: "template",
                } as any;
            } else {
                existing.plannedMeta = null as any;
            }

            await existing.save();

            if (desiredPlannedRoutine) report.updatedPlanned += 1;
            else report.clearedToRest += 1;

            continue;
        }

        // Create even if rest day (plannedRoutine null)
        await WorkoutDayModel.create({
            userId: new mongoose.Types.ObjectId(traineeId),
            date,
            weekKey,

            sleep: null,
            training: null,

            plannedRoutine: desiredPlannedRoutine,
            plannedMeta: desiredPlannedRoutine
                ? {
                    plannedBy: new mongoose.Types.ObjectId(trainerId),
                    plannedAt: plannedAtIso,
                    source: "template",
                }
                : null,

            notes: null,
            tags: null,
            meta: null,
        });

        if (desiredPlannedRoutine) report.createdPlanned += 1;
        else report.createdRest += 1;
    }

    return { report };
}