// /src/services/workoutExport/workoutExport.utils.ts
// Shared type guards, formatters, JSON normalization, and date helpers for workout exports.

import type { JsonValue } from "../../types/workoutExport.types";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function readStringFrom(record: UnknownRecord, key: string): string | null {
    return readString(record[key]);
}

export function readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readNumberFrom(record: UnknownRecord, key: string): number | null {
    return readNumber(record[key]);
}

export function readBoolean(value: unknown, fallback = false): boolean {
    return typeof value === "boolean" ? value : fallback;
}

export function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

export function readStringArray(value: unknown): string[] {
    return readArray(value)
        .map(readString)
        .filter((item): item is string => item !== null);
}

type IdentifierKey = "_id" | "id";

const identifierKeys: readonly IdentifierKey[] = ["_id", "id"];
const maxIdentifierDepth = 8;

/**
 * Safely reads a property that may be implemented as a getter.
 */
function readObjectProperty(value: object, key: PropertyKey): unknown {
    try {
        return Reflect.get(value, key);
    } catch {
        return undefined;
    }
}

/**
 * Calls an identifier formatter without trusting the external object shape.
 */
function callIdentifierMethod(
    value: object,
    methodName: "toHexString" | "toString",
): string | null {
    const method = readObjectProperty(value, methodName);

    if (typeof method !== "function") return null;

    try {
        const result: unknown = Reflect.apply(method, value, []);
        const normalized = readString(result);

        if (!normalized || normalized === "[object Object]") return null;

        return normalized;
    } catch {
        return null;
    }
}

/**
 * Resolves primitive, populated-document, and Mongoose/BSON ObjectId values.
 *
 * ObjectId exposes an `_id` getter that returns the same ObjectId instance.
 * Tracking visited objects and skipping self-references prevents infinite recursion.
 */
function valueToIdInternal(
    value: unknown,
    visited: WeakSet<object>,
    depth: number,
): string | null {
    if (typeof value === "string") {
        return readString(value);
    }

    if (typeof value === "number" || typeof value === "bigint") {
        return String(value);
    }

    if (value === null || typeof value !== "object") return null;
    if (depth > maxIdentifierDepth || visited.has(value)) return null;

    visited.add(value);

    // BSON/Mongoose ObjectId should be normalized before inspecting its `id` buffer.
    const hexadecimalId = callIdentifierMethod(value, "toHexString");
    if (hexadecimalId) return hexadecimalId;

    if (isRecord(value)) {
        for (const key of identifierKeys) {
            const nestedValue = readObjectProperty(value, key);

            if (nestedValue === null || nestedValue === undefined || nestedValue === value) {
                continue;
            }

            const nestedId = valueToIdInternal(
                nestedValue,
                visited,
                depth + 1,
            );

            if (nestedId) return nestedId;
        }
    }

    return callIdentifierMethod(value, "toString");
}

export function valueToId(value: unknown): string | null {
    return valueToIdInternal(value, new WeakSet<object>(), 0);
}

export function toIsoString(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();

    if (typeof value === "string" || typeof value === "number") {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    return null;
}

export function toJsonValue(value: unknown, depth = 0): JsonValue | null {
    if (value === null || value === undefined) return null;
    if (depth > 20) return "[depth-limit]";

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        if (typeof value === "number" && !Number.isFinite(value)) return null;
        return value;
    }

    if (value instanceof Date) return value.toISOString();

    if (Array.isArray(value)) {
        return value.map((item) => toJsonValue(item, depth + 1));
    }

    if (isRecord(value)) {
        const normalized: { [key: string]: JsonValue } = {};

        for (const [key, item] of Object.entries(value)) {
            normalized[key] = toJsonValue(item, depth + 1);
        }

        return normalized;
    }

    const id = valueToId(value);
    return id;
}

export function safeJsonStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? "";
    } catch {
        return "[unserializable]";
    }
}

export function round(value: number, decimals = 2): number {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function sumNumbers(values: readonly (number | null | undefined)[]): number {
    return values.reduce<number>(
        (total, value) =>
            total +
            (typeof value === "number" && Number.isFinite(value) ? value : 0),
        0,
    );
}

export function averageNumbers(values: readonly (number | null | undefined)[]): number | null {
    const valid = values.filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
    );

    if (valid.length === 0) return null;
    return sumNumbers(valid) / valid.length;
}

export function parseIsoDate(dateIso: string): Date {
    const date = new Date(`${dateIso}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
        throw Object.assign(new Error(`Invalid ISO date: ${dateIso}`), {
            statusCode: 400,
            code: "INVALID_DATE",
        });
    }

    return date;
}

export function formatIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

export function enumerateIsoDates(from: string, to: string): string[] {
    const start = parseIsoDate(from);
    const end = parseIsoDate(to);
    const dates: string[] = [];

    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addUtcDays(cursor, 1)) {
        dates.push(formatIsoDate(cursor));
    }

    return dates;
}

export function countInclusiveDays(from: string, to: string): number {
    const start = parseIsoDate(from).getTime();
    const end = parseIsoDate(to).getTime();
    return Math.floor((end - start) / 86_400_000) + 1;
}

export function formatDuration(seconds: number | null): string {
    if (seconds === null || !Number.isFinite(seconds)) return "—";

    const totalSeconds = Math.max(0, Math.round(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
    return `${remainingSeconds}s`;
}

export function formatMinutes(minutes: number | null): string {
    if (minutes === null || !Number.isFinite(minutes)) return "—";

    const totalMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(totalMinutes / 60);
    const remainder = totalMinutes % 60;

    return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

export function normalizeFilePart(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
}
