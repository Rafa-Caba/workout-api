// src/services/workoutRoutine.service.ts
// Service for routine-week CRUD, attachments, and Gym Check patch state.
// Kept compatible with WorkoutDay automatic minimal sessions by not mutating
// WorkoutDay directly from Gym Check persistence here.

import { randomUUID } from "crypto";
import mongoose from "mongoose";

import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";
import { MovementModel } from "../models/Movement.model";
import { assertMovementsExist } from "./movement.service";

import type {
    GymCheckDayPatch,
    GymCheckExercisePatch,
    GymCheckExerciseSet,
    GymCheckMetricsPatch,
} from "../types/gymCheck.types";
import type { WorkoutDataSource } from "../types/workoutDay.types";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const DAY_KEYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PlainObject = Record<string, unknown>;

type RoutineExercise = {
    id: string;
    name: string;
    movementId?: string | null;
    movementName?: string | null;
    sets?: number | null;
    reps?: string | null;
    rpe?: number | null;
    load?: string | null;
    notes?: string | null;
    attachmentPublicIds?: string[] | null;
};

type RoutineDay = {
    dayKey: DayKey;
    date?: string;
    sessionType?: string | null;
    focus?: string | null;
    exercises?: RoutineExercise[] | null;
    notes?: string | null;
    tags?: string[] | null;
};

type UpsertPayload = {
    title?: string | null;
    split?: string | null;
    plannedDays?: DayKey[] | null;
    meta?: Record<string, unknown> | null;
    day?: RoutineDay;
    days?: RoutineDay[];
};

type RoutineAttachment = {
    publicId: string;
    url: string;
    resourceType: "image" | "video";
    format: string | null;
    createdAt: string;
    meta: Record<string, unknown> | null;
    originalName?: string | null;
};

type CloudinaryLike = {
    publicId: string;
    url: string;
    resourceType: "image" | "video";
    format: string | null;
    createdAt: string;
    originalName: string | null;
};

type StoredGymCheckExercise = {
    done?: boolean | null;
    notes?: string | null;
    durationMin?: number | null;
    mediaPublicIds?: string[] | null;
    performedSets?: GymCheckExerciseSet[] | null;
    updatedAt?: string | null;
};

type StoredGymCheckMetrics = {
    startAt?: string | null;
    endAt?: string | null;

    activeKcal?: number | null;
    totalKcal?: number | null;

    avgHr?: number | null;
    maxHr?: number | null;

    distanceKm?: number | null;
    steps?: number | null;
    elevationGainM?: number | null;

    paceSecPerKm?: number | null;
    cadenceRpm?: number | null;

    effortRpe?: number | null;

    trainingSource?: string | null;
    source?: WorkoutDataSource | null;
    sourceDevice?: string | null;

    dayEffortRpe?: number | null;
};

type StoredGymCheckDay = {
    durationMin?: number | null;
    notes?: string | null;
    metrics?: StoredGymCheckMetrics | null;
    exercises?: Record<string, StoredGymCheckExercise> | null;
    updatedAt?: string | null;
};

type StoredGymCheckMap = Partial<Record<DayKey, StoredGymCheckDay>>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const isPlainObject = (value: unknown): value is PlainObject => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isDayKey = (value: unknown): value is DayKey => {
    return (
        value === "Mon" ||
        value === "Tue" ||
        value === "Wed" ||
        value === "Thu" ||
        value === "Fri" ||
        value === "Sat" ||
        value === "Sun"
    );
};

const toIsoDate = (value: Date): string => {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

const newId = (): string => {
    return randomUUID();
};

const cleanStringOrNull = (value: unknown): string | null => {
    if (value === null) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const cleanNumberOrNull = (value: unknown): number | null => {
    if (value === null) return null;
    if (typeof value !== "number") return null;
    return Number.isFinite(value) ? value : null;
};

const cleanBooleanOrNull = (value: unknown): boolean | null | undefined => {
    if (typeof value === "boolean") return value;
    if (value === null) return null;
    return undefined;
};

const cleanIsoOrNull = (value: unknown): string | null => {
    return cleanStringOrNull(value);
};

const cleanStringArrayOrNull = (value: unknown): string[] | null => {
    if (value === null) return null;
    if (!Array.isArray(value)) return null;

    const out = value
        .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
        .filter((item) => item.length > 0);

    return out.length > 0 ? out : null;
};

const toNullableWorkoutDataSource = (value: unknown): WorkoutDataSource | null => {
    return value === "manual" || value === "healthkit" || value === "health-connect"
        ? value
        : null;
};

const normalizeUnknownRoutineExercise = (
    value: unknown,
    movementNameById?: Map<string, string>
): RoutineExercise | null => {
    if (!isPlainObject(value)) return null;

    const providedId = cleanStringOrNull(value.id);
    const id = providedId ?? newId();

    const name = cleanStringOrNull(value.name);
    if (!name) return null;

    const movementId = cleanStringOrNull(value.movementId);
    const dbName = movementId ? movementNameById?.get(movementId) ?? null : null;
    const fallbackMovementName = cleanStringOrNull(value.movementName);
    const movementName = dbName ?? fallbackMovementName ?? (movementId ? name : null);

    return {
        id,
        name,
        movementId,
        movementName,
        sets: cleanNumberOrNull(value.sets),
        reps: cleanStringOrNull(value.reps),
        rpe: cleanNumberOrNull(value.rpe),
        load: cleanStringOrNull(value.load),
        notes: cleanStringOrNull(value.notes),
        attachmentPublicIds: cleanStringArrayOrNull(value.attachmentPublicIds),
    };
};

const normalizeUnknownRoutineDay = (value: unknown): RoutineDay | null => {
    if (!isPlainObject(value)) return null;
    if (!isDayKey(value.dayKey)) return null;

    const exercises = Array.isArray(value.exercises)
        ? value.exercises
            .map((item) => normalizeUnknownRoutineExercise(item))
            .filter((item): item is RoutineExercise => item !== null)
        : value.exercises === null
            ? null
            : null;

    return {
        dayKey: value.dayKey,
        date: cleanStringOrNull(value.date) ?? undefined,
        sessionType: cleanStringOrNull(value.sessionType),
        focus: cleanStringOrNull(value.focus),
        exercises,
        notes: cleanStringOrNull(value.notes),
        tags: cleanStringArrayOrNull(value.tags),
    };
};

const normalizeRoutineAttachment = (value: unknown): RoutineAttachment | null => {
    if (!isPlainObject(value)) return null;

    const publicId = cleanStringOrNull(value.publicId);
    const url = cleanStringOrNull(value.url);

    if (!publicId || !url) return null;

    return {
        publicId,
        url,
        resourceType: value.resourceType === "video" ? "video" : "image",
        format: cleanStringOrNull(value.format),
        createdAt: cleanStringOrNull(value.createdAt) ?? new Date().toISOString(),
        meta: isPlainObject(value.meta) ? value.meta : null,
        originalName: cleanStringOrNull(value.originalName),
    };
};

const collectMovementIdsFromDays = (days?: RoutineDay[] | null): string[] => {
    const out: string[] = [];

    for (const day of days ?? []) {
        for (const exercise of day.exercises ?? []) {
            const movementId = cleanStringOrNull(exercise.movementId);
            if (movementId) {
                out.push(movementId);
            }
        }
    }

    return out;
};

const buildMovementNameMap = async (args: {
    userId: string;
    movementIds: string[];
}): Promise<Map<string, string>> => {
    const { userId, movementIds } = args;

    const unique = Array.from(
        new Set(
            movementIds
                .filter((id) => typeof id === "string" && id.trim().length > 0)
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
        )
    );

    if (unique.length === 0) {
        return new Map<string, string>();
    }

    await assertMovementsExist({ userId, movementIds: unique });

    const docs = await MovementModel.find({
        _id: { $in: unique.map((id) => new mongoose.Types.ObjectId(id)) },
        userId: new mongoose.Types.ObjectId(userId),
    })
        .select({ _id: 1, name: 1 })
        .lean();

    const map = new Map<string, string>();

    for (const doc of docs) {
        if (!isPlainObject(doc)) continue;

        const id = cleanStringOrNull(doc._id?.toString?.());
        const name = cleanStringOrNull(doc.name);

        if (id && name) {
            map.set(id, name);
        }
    }

    return map;
};

const weekKeyToRange = (weekKey: string): { from: string; to: string } => {
    const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
    if (!match) {
        throw new Error(`Invalid weekKey: ${weekKey}`);
    }

    const year = Number(match[1]);
    const week = Number(match[2]);

    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;

    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

    const monday = new Date(mondayWeek1);
    monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);

    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    return { from: toIsoDate(monday), to: toIsoDate(sunday) };
};

const ensure7Days = (
    weekKey: string,
    incoming?: RoutineDay[] | null,
    movementNameById?: Map<string, string>
): Array<{
    dayKey: DayKey;
    date: string;
    sessionType: string | null;
    focus: string | null;
    exercises: RoutineExercise[] | null;
    notes: string | null;
    tags: string[] | null;
}> => {
    const { from } = weekKeyToRange(weekKey);
    const start = new Date(`${from}T00:00:00.000Z`);

    const byDayKey = new Map<DayKey, RoutineDay>();
    for (const day of incoming ?? []) {
        if (day && isDayKey(day.dayKey)) {
            byDayKey.set(day.dayKey, day);
        }
    }

    return DAY_KEYS.map((dayKey, index) => {
        const baseDate = new Date(start);
        baseDate.setUTCDate(start.getUTCDate() + index);

        const raw = byDayKey.get(dayKey);
        const normalizedExercises =
            Array.isArray(raw?.exercises) && raw.exercises.length > 0
                ? raw.exercises
                    .map((exercise) =>
                        normalizeUnknownRoutineExercise(exercise, movementNameById)
                    )
                    .filter((exercise): exercise is RoutineExercise => exercise !== null)
                : raw?.exercises === null
                    ? null
                    : null;

        return {
            dayKey,
            date:
                typeof raw?.date === "string" && raw.date.trim().length > 0
                    ? raw.date.trim()
                    : toIsoDate(baseDate),
            sessionType: raw?.sessionType ?? null,
            focus: raw?.focus ?? null,
            exercises: normalizedExercises,
            notes: raw?.notes ?? null,
            tags: raw?.tags ?? null,
        };
    });
};

const inferResourceTypeFromMimetype = (mimetype?: string): "image" | "video" => {
    const lower = (mimetype ?? "").toLowerCase();
    return lower.startsWith("video/") ? "video" : "image";
};

const inferFormatFromOriginalName = (originalName?: string): string | null => {
    const normalized = (originalName ?? "").trim().toLowerCase();
    const match = /\.([a-z0-9]{2,6})(\?.*)?$/.exec(normalized);
    return match ? match[1] : null;
};

const extractCloudinaryInfo = (file: Express.Multer.File): CloudinaryLike | null => {
    const candidate = file as unknown as Record<string, unknown>;

    const publicId =
        cleanStringOrNull(candidate.filename) ??
        cleanStringOrNull(candidate.public_id) ??
        cleanStringOrNull(candidate.publicId);

    const pathUrl =
        cleanStringOrNull(candidate.path) ??
        cleanStringOrNull(candidate.secure_url) ??
        cleanStringOrNull(candidate.url);

    const resourceTypeRaw =
        cleanStringOrNull(candidate.resource_type) ??
        cleanStringOrNull(candidate.resourceType);

    const format =
        cleanStringOrNull(candidate.format) ??
        inferFormatFromOriginalName(file.originalname);

    const createdAt =
        cleanStringOrNull(candidate.created_at) ??
        cleanStringOrNull(candidate.createdAt) ??
        new Date().toISOString();

    if (!publicId || !pathUrl) {
        return null;
    }

    return {
        publicId,
        url: pathUrl,
        resourceType:
            resourceTypeRaw === "video" || resourceTypeRaw === "image"
                ? resourceTypeRaw
                : inferResourceTypeFromMimetype(file.mimetype),
        format,
        createdAt,
        originalName: cleanStringOrNull(file.originalname),
    };
};

const normalizeGymCheckExerciseSet = (
    value: unknown,
    fallbackIndex: number
): GymCheckExerciseSet | null => {
    if (!isPlainObject(value)) return null;

    const setIndex =
        typeof value.setIndex === "number" && Number.isFinite(value.setIndex) && value.setIndex > 0
            ? Math.trunc(value.setIndex)
            : fallbackIndex;

    return {
        setIndex,
        reps:
            value.reps === null
                ? null
                : typeof value.reps === "number" && Number.isFinite(value.reps)
                    ? Math.trunc(value.reps)
                    : null,
        weight:
            value.weight === null
                ? null
                : typeof value.weight === "number" && Number.isFinite(value.weight)
                    ? value.weight
                    : null,
        unit: value.unit === "kg" ? "kg" : "lb",
        rpe:
            value.rpe === null
                ? null
                : typeof value.rpe === "number" && Number.isFinite(value.rpe)
                    ? value.rpe
                    : null,
        isWarmup: value.isWarmup === true,
        isDropSet: value.isDropSet === true,
        tempo: value.tempo === null ? null : cleanStringOrNull(value.tempo),
        restSec:
            value.restSec === null
                ? null
                : typeof value.restSec === "number" && Number.isFinite(value.restSec)
                    ? Math.trunc(value.restSec)
                    : null,
        tags: value.tags === null ? null : cleanStringArrayOrNull(value.tags),
        meta: value.meta === null ? null : isPlainObject(value.meta) ? value.meta : null,
    };
};

const normalizeGymCheckExerciseSets = (input: unknown): GymCheckExerciseSet[] | null => {
    if (input === null) return null;
    if (!Array.isArray(input)) return null;

    const normalized: GymCheckExerciseSet[] = [];

    input.forEach((item, index) => {
        const parsed = normalizeGymCheckExerciseSet(item, index + 1);
        if (parsed) {
            normalized.push({
                ...parsed,
                setIndex: normalized.length + 1,
            });
        }
    });

    return normalized.length > 0 ? normalized : null;
};

const mergeGymCheckExercise = (
    prev: StoredGymCheckExercise | null,
    patch: GymCheckExercisePatch
): StoredGymCheckExercise => {
    const base: StoredGymCheckExercise = { ...(prev ?? {}) };

    if ("done" in patch) base.done = patch.done ?? null;
    if ("notes" in patch) base.notes = patch.notes ?? null;
    if ("durationMin" in patch) base.durationMin = patch.durationMin ?? null;
    if ("mediaPublicIds" in patch) base.mediaPublicIds = patch.mediaPublicIds ?? null;
    if ("performedSets" in patch) base.performedSets = patch.performedSets ?? null;
    base.updatedAt = new Date().toISOString();

    return base;
};

const normalizeGymCheckMetricsPatch = (payload: unknown): GymCheckMetricsPatch => {
    if (!isPlainObject(payload)) return {};

    const out: GymCheckMetricsPatch = {};

    if ("startAt" in payload) out.startAt = cleanIsoOrNull(payload.startAt);
    if ("endAt" in payload) out.endAt = cleanIsoOrNull(payload.endAt);

    if ("activeKcal" in payload) out.activeKcal = cleanNumberOrNull(payload.activeKcal);
    if ("totalKcal" in payload) out.totalKcal = cleanNumberOrNull(payload.totalKcal);

    if ("avgHr" in payload) out.avgHr = cleanNumberOrNull(payload.avgHr);
    if ("maxHr" in payload) out.maxHr = cleanNumberOrNull(payload.maxHr);

    if ("distanceKm" in payload) out.distanceKm = cleanNumberOrNull(payload.distanceKm);
    if ("steps" in payload) out.steps = cleanNumberOrNull(payload.steps);
    if ("elevationGainM" in payload) out.elevationGainM = cleanNumberOrNull(payload.elevationGainM);

    if ("paceSecPerKm" in payload) out.paceSecPerKm = cleanNumberOrNull(payload.paceSecPerKm);
    if ("cadenceRpm" in payload) out.cadenceRpm = cleanNumberOrNull(payload.cadenceRpm);

    if ("effortRpe" in payload) out.effortRpe = cleanNumberOrNull(payload.effortRpe);

    if ("trainingSource" in payload) out.trainingSource = cleanStringOrNull(payload.trainingSource);
    if ("source" in payload) out.source = toNullableWorkoutDataSource(payload.source);
    if ("sourceDevice" in payload) out.sourceDevice = cleanStringOrNull(payload.sourceDevice);

    if ("dayEffortRpe" in payload) out.dayEffortRpe = cleanNumberOrNull(payload.dayEffortRpe);

    return out;
};

const normalizeGymCheckExercisePatch = (payload: unknown): GymCheckExercisePatch | null => {
    if (!isPlainObject(payload)) return null;

    const out: GymCheckExercisePatch = {};

    if ("done" in payload) out.done = cleanBooleanOrNull(payload.done);
    if ("notes" in payload) out.notes = cleanStringOrNull(payload.notes);
    if ("durationMin" in payload) out.durationMin = cleanNumberOrNull(payload.durationMin);
    if ("mediaPublicIds" in payload) out.mediaPublicIds = cleanStringArrayOrNull(payload.mediaPublicIds);
    if ("performedSets" in payload) out.performedSets = normalizeGymCheckExerciseSets(payload.performedSets);

    return out;
};

const normalizeGymCheckDayPatch = (payload: unknown): GymCheckDayPatch => {
    if (!isPlainObject(payload)) return {};

    const out: GymCheckDayPatch = {};

    if ("durationMin" in payload) out.durationMin = cleanNumberOrNull(payload.durationMin);
    if ("notes" in payload) out.notes = cleanStringOrNull(payload.notes);

    if ("metrics" in payload) {
        const rawMetrics = payload.metrics;

        if (rawMetrics === null) {
            out.metrics = null;
        } else if (isPlainObject(rawMetrics)) {
            out.metrics = normalizeGymCheckMetricsPatch(rawMetrics);
        }
    }

    if ("exercises" in payload) {
        const rawExercises = payload.exercises;

        if (rawExercises === null) {
            out.exercises = null;
        } else if (isPlainObject(rawExercises)) {
            const map: Record<string, GymCheckExercisePatch> = {};

            for (const [exerciseId, rawExercisePatch] of Object.entries(rawExercises)) {
                if (!exerciseId) continue;

                if (rawExercisePatch === null) {
                    map[exerciseId] = {
                        done: null,
                        notes: null,
                        durationMin: null,
                        mediaPublicIds: null,
                        performedSets: null,
                    };
                    continue;
                }

                const parsedExercisePatch = normalizeGymCheckExercisePatch(rawExercisePatch);
                if (!parsedExercisePatch) continue;

                map[exerciseId] = parsedExercisePatch;
            }

            out.exercises = map;
        }
    }

    return out;
};

// =========================================================
// Public service API used by controller
// =========================================================

export async function getRoutineWeek(userId: string, weekKey: string) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    return doc ? doc.toJSON() : null;
}

export async function initRoutineWeek(
    userId: string,
    weekKey: string,
    opts?: { title?: string; split?: string; unarchive?: boolean }
) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });

    if (doc) {
        let changed = false;

        if (doc.status === "archived" && opts?.unarchive) {
            doc.status = "active";
            changed = true;
        }
        if (typeof opts?.title === "string" && opts.title !== doc.title) {
            doc.title = opts.title;
            changed = true;
        }
        if (typeof opts?.split === "string" && opts.split !== doc.split) {
            doc.split = opts.split;
            changed = true;
        }

        const existingDays = Array.from(doc.days ?? [])
            .map((day) => normalizeUnknownRoutineDay(day))
            .filter((day): day is RoutineDay => day !== null);

        const existingMovementIds = collectMovementIdsFromDays(existingDays);
        const movementNameById = await buildMovementNameMap({
            userId,
            movementIds: existingMovementIds,
        });

        const normalizedDays = ensure7Days(weekKey, existingDays, movementNameById);

        const before = JSON.stringify(existingDays);
        const after = JSON.stringify(normalizedDays);

        if (before !== after) {
            doc.set("days", normalizedDays);
            changed = true;
        }

        if (changed) {
            await doc.save();
        }

        return doc.toJSON();
    }

    const range = weekKeyToRange(weekKey);
    const days = ensure7Days(weekKey, null);

    const created = await WorkoutRoutineWeekModel.create({
        userId,
        weekKey,
        range,
        status: "active",
        title: typeof opts?.title === "string" ? opts.title : null,
        split: typeof opts?.split === "string" ? opts.split : null,
        plannedDays: null,
        attachments: [],
        days,
        meta: null,
    });

    return created.toJSON();
}

export async function setRoutineArchived(userId: string, weekKey: string, archived: boolean) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    doc.status = archived ? "archived" : "active";
    await doc.save();

    return doc.toJSON();
}

export async function upsertRoutineWeek(userId: string, weekKey: string, payload: UpsertPayload) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    if ("title" in payload) doc.title = payload.title ?? null;
    if ("split" in payload) doc.split = payload.split ?? null;
    if ("plannedDays" in payload) doc.plannedDays = payload.plannedDays ?? null;
    if ("meta" in payload) doc.meta = payload.meta ?? null;

    if (Array.isArray(payload.days)) {
        const normalizedDays = payload.days
            .map((day) => normalizeUnknownRoutineDay(day))
            .filter((day): day is RoutineDay => day !== null);

        const movementIds = collectMovementIdsFromDays(normalizedDays);
        const movementNameById = await buildMovementNameMap({ userId, movementIds });

        doc.set("days", ensure7Days(weekKey, normalizedDays, movementNameById));
    } else if (payload.day && isRecord(payload.day) && isDayKey(payload.day.dayKey)) {
        const currentDays = Array.from(doc.days ?? [])
            .map((day) => normalizeUnknownRoutineDay(day))
            .filter((day): day is RoutineDay => day !== null);

        let patchMovementNameById: Map<string, string> | undefined;

        if ("exercises" in payload.day && Array.isArray(payload.day.exercises)) {
            const normalizedPatchExercises = payload.day.exercises
                .map((exercise) => normalizeUnknownRoutineExercise(exercise))
                .filter((exercise): exercise is RoutineExercise => exercise !== null);

            const movementIds = normalizedPatchExercises
                .map((exercise) => cleanStringOrNull(exercise.movementId))
                .filter((id): id is string => id !== null);

            patchMovementNameById = await buildMovementNameMap({ userId, movementIds });
        }

        const mergedDays: RoutineDay[] = currentDays.map((day) => {
            if (day.dayKey !== payload.day?.dayKey) {
                return day;
            }

            let nextExercises = day.exercises ?? null;

            if ("exercises" in payload.day) {
                if (Array.isArray(payload.day.exercises)) {
                    nextExercises = payload.day.exercises
                        .map((exercise) =>
                            normalizeUnknownRoutineExercise(exercise, patchMovementNameById)
                        )
                        .filter((exercise): exercise is RoutineExercise => exercise !== null);
                } else {
                    nextExercises = payload.day.exercises ?? null;
                }
            }

            return {
                ...day,
                date:
                    typeof payload.day.date === "string" && payload.day.date.trim().length > 0
                        ? payload.day.date.trim()
                        : day.date,
                sessionType:
                    "sessionType" in payload.day
                        ? payload.day.sessionType ?? null
                        : day.sessionType,
                focus: "focus" in payload.day ? payload.day.focus ?? null : day.focus,
                exercises: nextExercises,
                notes: "notes" in payload.day ? payload.day.notes ?? null : day.notes,
                tags: "tags" in payload.day ? payload.day.tags ?? null : day.tags,
            };
        });

        const mergedMovementIds = collectMovementIdsFromDays(mergedDays);
        const mergedMovementNameById = await buildMovementNameMap({
            userId,
            movementIds: mergedMovementIds,
        });

        doc.set("days", ensure7Days(weekKey, mergedDays, mergedMovementNameById));
    }

    await doc.save();
    return doc.toJSON();
}

// =========================================================
// Attachments (week-level)
// =========================================================

export async function addRoutineAttachments(
    userId: string,
    weekKey: string,
    files: Express.Multer.File[]
) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    const existingAttachments = Array.from(doc.attachments ?? [])
        .map((attachment) => normalizeRoutineAttachment(attachment))
        .filter((attachment): attachment is RoutineAttachment => attachment !== null);

    const next: RoutineAttachment[] = [...existingAttachments];

    for (const file of files) {
        const info = extractCloudinaryInfo(file);
        if (!info) continue;

        const exists = next.some((attachment) => attachment.publicId === info.publicId);
        if (exists) continue;

        next.push({
            publicId: info.publicId,
            url: info.url,
            resourceType: info.resourceType,
            format: info.format,
            createdAt: info.createdAt,
            meta: null,
            originalName: info.originalName,
        });
    }

    doc.set("attachments", next);
    await doc.save();

    return doc.toJSON();
}

export async function deleteRoutineAttachment(
    userId: string,
    weekKey: string,
    publicId: string,
    _deleteCloudinary: boolean
) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    const currentAttachments = Array.from(doc.attachments ?? [])
        .map((attachment) => normalizeRoutineAttachment(attachment))
        .filter((attachment): attachment is RoutineAttachment => attachment !== null);

    const nextAttachments = currentAttachments.filter(
        (attachment) => attachment.publicId !== publicId
    );

    const currentDays = Array.from(doc.days ?? []);

    const nextDays = currentDays.map((day) => {
        const normalizedDay = normalizeUnknownRoutineDay(day);
        if (!normalizedDay || !Array.isArray(normalizedDay.exercises)) {
            return normalizedDay;
        }

        return {
            ...normalizedDay,
            exercises: normalizedDay.exercises.map((exercise) => ({
                ...exercise,
                attachmentPublicIds:
                    exercise.attachmentPublicIds?.filter((item) => item !== publicId) ?? null,
            })),
        };
    });

    doc.set("attachments", nextAttachments);
    doc.set(
        "days",
        nextDays.filter(
            (
                day
            ): day is {
                dayKey: DayKey;
                date?: string;
                sessionType?: string | null;
                focus?: string | null;
                exercises?: RoutineExercise[] | null;
                notes?: string | null;
                tags?: string[] | null;
            } => day !== null
        )
    );

    await doc.save();
    return doc.toJSON();
}

// =========================================================
// Gym Check (sync checklist + day metrics) - persisted in RoutineWeek.meta.gymCheck
// =========================================================

export async function patchGymCheckDay(
    userId: string,
    weekKey: string,
    dayKey: DayKey,
    payload: unknown
) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    const patch = normalizeGymCheckDayPatch(payload);

    const currentMeta = isPlainObject(doc.meta) ? doc.meta : {};
    const currentGymCheck = isPlainObject(currentMeta.gymCheck)
        ? (currentMeta.gymCheck as StoredGymCheckMap)
        : {};

    const previousDay = isPlainObject(currentGymCheck[dayKey])
        ? (currentGymCheck[dayKey] as StoredGymCheckDay)
        : {};

    const nextDay: StoredGymCheckDay = { ...previousDay };

    if ("durationMin" in patch) {
        nextDay.durationMin = patch.durationMin ?? null;
    }

    if ("notes" in patch) {
        nextDay.notes = patch.notes ?? null;
    }

    if ("metrics" in patch) {
        if (patch.metrics === null) {
            nextDay.metrics = null;
        } else if (patch.metrics) {
            const previousMetrics: StoredGymCheckMetrics = isPlainObject(previousDay.metrics)
                ? { ...(previousDay.metrics as StoredGymCheckMetrics) }
                : {};

            nextDay.metrics = {
                ...previousMetrics,
                ...patch.metrics,
            };
        }
    }

    if ("exercises" in patch) {
        if (patch.exercises === null) {
            nextDay.exercises = null;
        } else if (patch.exercises) {
            const previousExercises: Record<string, StoredGymCheckExercise> =
                isPlainObject(previousDay.exercises)
                    ? { ...(previousDay.exercises as Record<string, StoredGymCheckExercise>) }
                    : {};

            const nextExercises: Record<string, StoredGymCheckExercise> = {
                ...previousExercises,
            };

            for (const [exerciseId, exercisePatch] of Object.entries(patch.exercises)) {
                const previousExercise = isPlainObject(previousExercises[exerciseId])
                    ? previousExercises[exerciseId]
                    : null;

                nextExercises[exerciseId] = mergeGymCheckExercise(
                    previousExercise,
                    exercisePatch
                );
            }

            nextDay.exercises = nextExercises;
        }
    }

    nextDay.updatedAt = new Date().toISOString();

    const nextGymCheck: StoredGymCheckMap = {
        ...currentGymCheck,
        [dayKey]: nextDay,
    };

    doc.meta = {
        ...currentMeta,
        gymCheck: nextGymCheck,
    };

    await doc.save();
    return doc.toJSON();
}

export async function patchRoutineGymCheckDay(
    userId: string,
    weekKey: string,
    dayKey: DayKey,
    payload: unknown
) {
    return patchGymCheckDay(userId, weekKey, dayKey, payload);
}

export async function listRoutineWeeks(
    userId: string,
    opts?: { status?: "active" | "archived"; limit?: number }
) {
    const filter: Record<string, unknown> = { userId };

    if (opts?.status) {
        filter.status = opts.status;
    }

    const limit = typeof opts?.limit === "number" ? opts.limit : 20;

    const docs = await WorkoutRoutineWeekModel.find(filter)
        .sort({ "range.from": -1 })
        .limit(limit)
        .select("weekKey range status title split plannedDays createdAt updatedAt")
        .lean();

    return docs.map((doc) => ({
        id: doc._id?.toString?.() ?? "",
        weekKey: cleanStringOrNull(doc.weekKey) ?? "",
        range: isPlainObject(doc.range)
            ? {
                from: cleanStringOrNull(doc.range.from) ?? "",
                to: cleanStringOrNull(doc.range.to) ?? "",
            }
            : { from: "", to: "" },
        status: doc.status === "archived" ? "archived" : "active",
        title: cleanStringOrNull(doc.title),
        split: cleanStringOrNull(doc.split),
        plannedDays: Array.isArray(doc.plannedDays)
            ? doc.plannedDays.filter((item): item is DayKey => isDayKey(item))
            : null,
        createdAt:
            doc.createdAt instanceof Date
                ? doc.createdAt.toISOString()
                : typeof doc.createdAt === "string"
                    ? new Date(doc.createdAt).toISOString()
                    : undefined,
        updatedAt:
            doc.updatedAt instanceof Date
                ? doc.updatedAt.toISOString()
                : typeof doc.updatedAt === "string"
                    ? new Date(doc.updatedAt).toISOString()
                    : undefined,
    }));
}