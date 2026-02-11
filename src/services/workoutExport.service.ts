import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import type { ExportResponsePayload, WorkoutExportOptions } from "../types/workoutExport.types";

type MinimalDay = any;

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function sum(nums: Array<number | null | undefined>): number {
    return nums.reduce<number>(
        (acc, n) => acc + (typeof n === "number" && Number.isFinite(n) ? n : 0),
        0
    );
}

function avg(nums: Array<number | null | undefined>): number | null {
    const filtered = nums.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (filtered.length === 0) return null;
    return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

function formatFilename(from: string, to: string, scope: string, format: string) {
    return `workout-export_${scope}_${from}_to_${to}.${format}`;
}

async function getDaysLean(userId: string, from: string, to: string): Promise<MinimalDay[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Projection is conservative but includes needed blocks.
    const projection = {
        userId: 1,
        date: 1,
        weekKey: 1,
        sleep: 1,
        training: 1,
        notes: 1,
        tags: 1,
        meta: 1,
    };

    const docs = await WorkoutDayModel.find({
        userId: userObjectId,
        date: { $gte: from, $lte: to },
    })
        .select(projection)
        .sort({ date: 1 })
        .lean();

    const days = docs.map((d: any) => {
        const { _id, ...rest } = d;
        return { id: String(_id), ...rest };
    });

    return days;
}

function stripRawDeep(day: any): any {
    if (!day || typeof day !== "object") return day;

    const out: any = { ...day };

    if (out.sleep && typeof out.sleep === "object") {
        out.sleep = { ...out.sleep };
        if ("raw" in out.sleep) out.sleep.raw = null;
    }

    if (out.training && typeof out.training === "object") {
        out.training = { ...out.training };
        if ("raw" in out.training) out.training.raw = null;

        if (Array.isArray(out.training.sessions)) {
            out.training.sessions = out.training.sessions.map((s: any) => {
                if (!s || typeof s !== "object") return s;
                const sOut: any = { ...s };
                if ("raw" in sOut) sOut.raw = null;
                return sOut;
            });
        }
    }

    return out;
}

function buildJsonBody(days: any[], includeRaw: boolean): string {
    const finalDays = includeRaw ? days : days.map(stripRawDeep);
    return JSON.stringify(finalDays, null, 2);
}

function buildDayCsv(days: any[]): string {
    const header = [
        "date",
        "weekKey",
        "sleepScore",
        "timeAsleepMinutes",
        "awakeMinutes",
        "remMinutes",
        "coreMinutes",
        "deepMinutes",
        "sessionsCount",
        "totalActiveKcal",
        "totalDurationSeconds",
        "avgSessionAvgHr",
        "maxSessionMaxHr",
        "dayEffortRpe",
        "tags",
        "notes",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const d of days) {
        const sessions = d?.training?.sessions ?? [];
        const sessionsCount = Array.isArray(sessions) ? sessions.length : 0;

        const totalActiveKcal = sum((Array.isArray(sessions) ? sessions : []).map((s: any) => s?.activeKcal ?? null));
        const totalDurationSeconds = sum(
            (Array.isArray(sessions) ? sessions : []).map((s: any) => s?.durationSeconds ?? null)
        );

        const avgSessionAvgHr = avg((Array.isArray(sessions) ? sessions : []).map((s: any) => s?.avgHr ?? null));

        const maxHr = (Array.isArray(sessions) ? sessions : [])
            .map((s: any) => (typeof s?.maxHr === "number" ? s.maxHr : null))
            .filter((x: any) => typeof x === "number") as number[];

        const maxSessionMaxHr = maxHr.length ? Math.max(...maxHr) : null;

        const row = [
            d?.date ?? "",
            d?.weekKey ?? "",
            d?.sleep?.score ?? "",
            d?.sleep?.timeAsleepMinutes ?? "",
            d?.sleep?.awakeMinutes ?? "",
            d?.sleep?.remMinutes ?? "",
            d?.sleep?.coreMinutes ?? "",
            d?.sleep?.deepMinutes ?? "",
            sessionsCount,
            totalActiveKcal,
            totalDurationSeconds,
            avgSessionAvgHr ?? "",
            maxSessionMaxHr ?? "",
            d?.training?.dayEffortRpe ?? "",
            Array.isArray(d?.tags) ? d.tags.join("|") : "",
            d?.notes ?? "",
        ].map(csvEscape);

        lines.push(row.join(","));
    }

    return lines.join("\n");
}

function buildSessionCsv(days: any[]): string {
    const header = [
        "date",
        "weekKey",
        "sessionId",
        "type",
        "startAt",
        "endAt",
        "durationSeconds",
        "activeKcal",
        "totalKcal",
        "avgHr",
        "maxHr",
        "distanceKm",
        "steps",
        "paceSecPerKm",
        "effortRpe",
        "mediaCount",
        "notes",
    ];

    const lines: string[] = [];
    lines.push(header.join(","));

    for (const d of days) {
        const sessions = d?.training?.sessions ?? [];
        if (!Array.isArray(sessions)) continue;

        for (const s of sessions) {
            const mediaCount = Array.isArray(s?.media) ? s.media.length : 0;

            // In lean docs, session id might be _id; in toJSON it becomes id.
            const sid = s?.id ?? (s?._id ? String(s._id) : "");

            const row = [
                d?.date ?? "",
                d?.weekKey ?? "",
                sid,
                s?.type ?? "",
                s?.startAt ?? "",
                s?.endAt ?? "",
                s?.durationSeconds ?? "",
                s?.activeKcal ?? "",
                s?.totalKcal ?? "",
                s?.avgHr ?? "",
                s?.maxHr ?? "",
                s?.distanceKm ?? "",
                s?.steps ?? "",
                s?.paceSecPerKm ?? "",
                s?.effortRpe ?? "",
                mediaCount,
                s?.notes ?? "",
            ].map(csvEscape);

            lines.push(row.join(","));
        }
    }

    return lines.join("\n");
}

export async function exportWorkoutData(
    userId: string,
    from: string,
    to: string,
    options: WorkoutExportOptions
): Promise<ExportResponsePayload> {
    if (options.scope === "exercise") {
        const err: any = new Error("Exercise-level export is not available yet (exercise tracking not implemented).");
        err.statusCode = 409;
        throw err;
    }

    const days = await getDaysLean(userId, from, to);

    if (options.format === "json") {
        const body = buildJsonBody(days, options.includeRaw);
        return {
            filename: formatFilename(from, to, options.scope, "json"),
            contentType: "application/json; charset=utf-8",
            body,
        };
    }

    const csv = options.scope === "session" ? buildSessionCsv(days) : buildDayCsv(days);

    return {
        filename: formatFilename(from, to, options.scope, "csv"),
        contentType: "text/csv; charset=utf-8",
        body: csv,
    };
}
