// /src/services/workoutExport/workoutExportRange.ts
// Resolves day/week/month/range selections into inclusive ISO date boundaries.

import type {
    ResolvedWorkoutReportRange,
    WorkoutReportSelection,
} from "../../types/workoutExport.types";
import {
    addUtcDays,
    countInclusiveDays,
    formatIsoDate,
    parseIsoDate,
} from "./workoutExport.utils";

const MAX_EXPORT_DAYS = 366;

function resolveWeek(dateIso: string, weekStartsOn: 0 | 1): { from: string; to: string } {
    const date = parseIsoDate(dateIso);
    const currentDay = date.getUTCDay();
    const daysSinceStart = (currentDay - weekStartsOn + 7) % 7;
    const fromDate = addUtcDays(date, -daysSinceStart);
    const toDate = addUtcDays(fromDate, 6);

    return {
        from: formatIsoDate(fromDate),
        to: formatIsoDate(toDate),
    };
}

function resolveMonth(dateIso: string): { from: string; to: string } {
    const date = parseIsoDate(dateIso);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const fromDate = new Date(Date.UTC(year, month, 1));
    const toDate = new Date(Date.UTC(year, month + 1, 0));

    return {
        from: formatIsoDate(fromDate),
        to: formatIsoDate(toDate),
    };
}

function buildLabel(kind: WorkoutReportSelection["kind"], from: string, to: string): string {
    switch (kind) {
        case "day":
            return from;
        case "week":
            return `Semana ${from} a ${to}`;
        case "month": {
            const date = parseIsoDate(from);
            return new Intl.DateTimeFormat("es-MX", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
            }).format(date);
        }
        case "range":
            return `${from} a ${to}`;
    }
}

function assertValidRange(from: string, to: string): void {
    const fromTime = parseIsoDate(from).getTime();
    const toTime = parseIsoDate(to).getTime();

    if (fromTime > toTime) {
        throw Object.assign(new Error("La fecha inicial no puede ser posterior a la fecha final."), {
            statusCode: 400,
            code: "INVALID_EXPORT_RANGE",
        });
    }

    const dayCount = countInclusiveDays(from, to);

    if (dayCount > MAX_EXPORT_DAYS) {
        throw Object.assign(
            new Error(`El rango máximo por exportación es de ${MAX_EXPORT_DAYS} días.`),
            {
                statusCode: 400,
                code: "EXPORT_RANGE_TOO_LARGE",
                details: {
                    maxDays: MAX_EXPORT_DAYS,
                    requestedDays: dayCount,
                },
            },
        );
    }
}

/**
 * Resolves a user selection using the configured first day of the week.
 */
export function resolveWorkoutReportRange(
    selection: WorkoutReportSelection,
    weekStartsOn: 0 | 1,
): ResolvedWorkoutReportRange {
    let from: string;
    let to: string;

    switch (selection.kind) {
        case "day":
            from = selection.date;
            to = selection.date;
            break;
        case "week": {
            const week = resolveWeek(selection.date, weekStartsOn);
            from = week.from;
            to = week.to;
            break;
        }
        case "month": {
            const month = resolveMonth(selection.date);
            from = month.from;
            to = month.to;
            break;
        }
        case "range":
            from = selection.from;
            to = selection.to;
            break;
    }

    assertValidRange(from, to);

    return {
        kind: selection.kind,
        from,
        to,
        label: buildLabel(selection.kind, from, to),
    };
}
