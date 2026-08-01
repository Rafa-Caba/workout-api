// /src/services/workoutExport.service.ts
// Backward-compatible JSON/CSV exporter for the existing GET endpoint.

import mongoose from "mongoose";

import { WorkoutDayModel } from "../models/WorkoutDay.model";
import type {
    ExportResponsePayload,
    WorkoutExportOptions,
} from "../types/workoutExport.types";
import {
    averageNumbers,
    isRecord,
    readArray,
    readNumber,
    readString,
    round,
    sumNumbers,
    valueToId,
    type UnknownRecord,
} from "./workoutExport/workoutExport.utils";

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";

    const text = String(value);

    return /[",\n\r]/.test(text)
        ? `"${text.replace(/"/g, '""')}"`
        : text;
}

function formatFilename(
    from: string,
    to: string,
    scope: string,
    format: string,
): string {
    return `workout-export_${scope}_${from}_to_${to}.${format}`;
}

function readRecordFrom(
    record: UnknownRecord,
    key: string,
): UnknownRecord | null {
    const value = record[key];
    return isRecord(value) ? value : null;
}

function readNumberFrom(
    record: UnknownRecord | null,
    key: string,
): number | null {
    return record ? readNumber(record[key]) : null;
}

function readStringFrom(
    record: UnknownRecord | null,
    key: string,
): string | null {
    return record ? readString(record[key]) : null;
}

function readRecordArray(value: unknown): UnknownRecord[] {
    return readArray(value).filter(isRecord);
}

async function getDaysLean(
    userId: string,
    from: string,
    to: string,
): Promise<UnknownRecord[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw Object.assign(new Error("Invalid authenticated user id."), {
            statusCode: 401,
            code: "INVALID_AUTH_USER",
        });
    }

    const docs: readonly unknown[] = await WorkoutDayModel.find({
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: from, $lte: to },
    })
        .select({
            userId: 1,
            date: 1,
            weekKey: 1,
            sleep: 1,
            training: 1,
            notes: 1,
            tags: 1,
            meta: 1,
        })
        .sort({ date: 1 })
        .lean();

    return docs
        .filter(isRecord)
        .map((document): UnknownRecord => {
            const { _id, ...rest } = document;

            return {
                ...rest,
                id: valueToId(_id) ?? "",
            };
        });
}

function stripRawDeep(day: UnknownRecord): UnknownRecord {
    const output: UnknownRecord = { ...day };
    const sleep = readRecordFrom(output, "sleep");

    if (sleep) {
        output.sleep = {
            ...sleep,
            raw: null,
        };
    }

    const training = readRecordFrom(output, "training");

    if (training) {
        const sessions = Array.isArray(training.sessions)
            ? readRecordArray(training.sessions).map(
                (session): UnknownRecord => ({
                    ...session,
                    raw: null,
                }),
            )
            : training.sessions ?? null;

        output.training = {
            ...training,
            raw: null,
            sessions,
        };
    }

    return output;
}

function buildJsonBody(
    days: readonly UnknownRecord[],
    includeRaw: boolean,
): string {
    return JSON.stringify(
        includeRaw ? days : days.map(stripRawDeep),
        null,
        2,
    );
}

function buildDayCsv(days: readonly UnknownRecord[]): string {
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
    const lines = [header.join(",")];

    for (const day of days) {
        const sleep = readRecordFrom(day, "sleep");
        const training = readRecordFrom(day, "training");
        const sessions = readRecordArray(training?.sessions);
        const maxHrValues = sessions
            .map((session) => readNumber(session.maxHr))
            .filter((value): value is number => value !== null);
        const tags = readArray(day.tags)
            .map(readString)
            .filter((tag): tag is string => tag !== null);

        const row = [
            readString(day.date),
            readString(day.weekKey),
            readNumberFrom(sleep, "score"),
            readNumberFrom(sleep, "timeAsleepMinutes"),
            readNumberFrom(sleep, "awakeMinutes"),
            readNumberFrom(sleep, "remMinutes"),
            readNumberFrom(sleep, "coreMinutes"),
            readNumberFrom(sleep, "deepMinutes"),
            sessions.length,
            round(
                sumNumbers(
                    sessions.map((session) =>
                        readNumber(session.activeKcal),
                    ),
                ),
                2,
            ),
            round(
                sumNumbers(
                    sessions.map((session) =>
                        readNumber(session.durationSeconds),
                    ),
                ),
                0,
            ),
            averageNumbers(
                sessions.map((session) =>
                    readNumber(session.avgHr),
                ),
            ),
            maxHrValues.length > 0
                ? Math.max(...maxHrValues)
                : null,
            readNumberFrom(training, "dayEffortRpe"),
            tags.join("|"),
            readString(day.notes),
        ].map(csvEscape);

        lines.push(row.join(","));
    }

    return lines.join("\n");
}

function buildSessionCsv(days: readonly UnknownRecord[]): string {
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
    const lines = [header.join(",")];

    for (const day of days) {
        const training = readRecordFrom(day, "training");
        const sessions = readRecordArray(training?.sessions);

        for (const session of sessions) {
            const cardioMetrics = readRecordFrom(
                session,
                "cardioMetrics",
            );
            const mediaCount = readArray(session.media).length;

            const row = [
                readString(day.date),
                readString(day.weekKey),
                valueToId(session.id ?? session._id),
                readString(session.type),
                readString(session.startAt),
                readString(session.endAt),
                readNumber(session.durationSeconds),
                readNumber(session.activeKcal),
                readNumber(session.totalKcal),
                readNumber(session.avgHr),
                readNumber(session.maxHr),
                readNumber(session.distanceKm) ??
                readNumberFrom(cardioMetrics, "distanceKm"),
                readNumber(session.steps) ??
                readNumberFrom(cardioMetrics, "steps"),
                readNumber(session.paceSecPerKm) ??
                readNumberFrom(cardioMetrics, "paceSecPerKm"),
                readNumber(session.effortRpe),
                mediaCount,
                readString(session.notes),
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
    options: WorkoutExportOptions,
): Promise<ExportResponsePayload> {
    if (options.scope === "exercise") {
        throw Object.assign(
            new Error(
                "Exercise-level legacy export is not available. " +
                "Use the complete XLSX export instead.",
            ),
            {
                statusCode: 409,
                code: "NOT_AVAILABLE",
            },
        );
    }

    const days = await getDaysLean(userId, from, to);

    if (options.format === "json") {
        return {
            filename: formatFilename(
                from,
                to,
                options.scope,
                "json",
            ),
            contentType: "application/json; charset=utf-8",
            body: buildJsonBody(days, options.includeRaw),
        };
    }

    return {
        filename: formatFilename(
            from,
            to,
            options.scope,
            "csv",
        ),
        contentType: "text/csv; charset=utf-8",
        body:
            options.scope === "session"
                ? buildSessionCsv(days)
                : buildDayCsv(days),
    };
}
