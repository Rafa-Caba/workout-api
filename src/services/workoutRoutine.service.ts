import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";
import { assertMovementsExist } from "./movement.service";
import { MovementModel } from "../models/Movement.model";
import { GymCheckDayPatch, GymCheckExercisePatch, GymCheckMetricsPatch } from "../types/gymCheck.types"

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const DAY_KEYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type RoutineExercise = {
    id: string; // ✅ stable per-exercise id
    name: string;

    // ✅ Movement catalog link + snapshot
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
    date?: string; // YYYY-MM-DD
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

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

function toIsoDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function newId(): string {
    return randomUUID();
}

function cleanStringOrNull(v: unknown): string | null {
    if (v === null) return null;
    if (typeof v !== "string") return null;
    const s = v.trim();
    return s.length ? s : null;
}

function collectMovementIdsFromDays(days?: RoutineDay[] | null): string[] {
    const out: string[] = [];
    (days ?? []).forEach((d) => {
        (d?.exercises ?? []).forEach((e: any) => {
            const id = cleanStringOrNull(e?.movementId);
            if (id) out.push(id);
        });
    });
    return out;
}

async function buildMovementNameMap(args: { userId: string; movementIds: string[] }) {
    const { userId, movementIds } = args;

    const unique = Array.from(
        new Set((movementIds ?? []).filter(Boolean).filter((id) => mongoose.Types.ObjectId.isValid(id)))
    );

    if (unique.length === 0) return new Map<string, string>();

    // ✅ validate first (ensures they belong to this user)
    await assertMovementsExist({ userId, movementIds: unique });

    const docs = await MovementModel.find({
        _id: { $in: unique.map((x) => new mongoose.Types.ObjectId(x)) },
        userId: new mongoose.Types.ObjectId(userId),
    }).select({ _id: 1, name: 1 });

    const map = new Map<string, string>();
    docs.forEach((d: any) => map.set(String(d._id), String(d.name ?? "").trim()));

    return map;
}

/**
 * Normalize one exercise, ensuring stable id.
 * This acts as a migration step for older stored plans without id.
 */
function normalizeExercise(e: any, movementNameById?: Map<string, string>): RoutineExercise {
    const id = typeof e?.id === "string" && e.id.trim() ? e.id.trim() : newId();

    const name = String(e?.name ?? "").trim();

    const sets = typeof e?.sets === "number" ? e.sets : e?.sets === null ? null : null;
    const reps = typeof e?.reps === "string" ? e.reps : e?.reps === null ? null : null;
    const rpe = typeof e?.rpe === "number" ? e.rpe : e?.rpe === null ? null : null;

    const load = typeof e?.load === "string" ? e.load : e?.load === null ? null : null;
    const notes = typeof e?.notes === "string" ? e.notes : e?.notes === null ? null : null;

    const attachmentPublicIds = Array.isArray(e?.attachmentPublicIds)
        ? e.attachmentPublicIds.map((x: any) => String(x).trim()).filter(Boolean)
        : e?.attachmentPublicIds === null
            ? null
            : null;

    const movementId = cleanStringOrNull(e?.movementId);

    // ✅ Snapshot movement name from DB whenever possible
    const dbName = movementId ? (movementNameById?.get(movementId) ?? null) : null;

    // If FE provides movementName, we still prefer DB snapshot to avoid spoofing/drift
    const movementName = dbName ?? cleanStringOrNull(e?.movementName) ?? (movementId ? (name || null) : null);

    return {
        id,
        name,
        movementId,
        movementName,
        sets,
        reps,
        rpe,
        load,
        notes,
        attachmentPublicIds,
    };
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

function ensure7Days(
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
}> {
    const { from } = weekKeyToRange(weekKey);
    const start = new Date(`${from}T00:00:00.000Z`);

    const map = new Map<DayKey, RoutineDay>();
    (incoming ?? []).forEach((d) => {
        if (d && DAY_KEYS.includes(d.dayKey)) map.set(d.dayKey, d);
    });

    return DAY_KEYS.map((dayKey, idx) => {
        const baseDate = new Date(start);
        baseDate.setUTCDate(start.getUTCDate() + idx);

        const raw = map.get(dayKey);

        const date =
            typeof raw?.date === "string" && raw.date.trim()
                ? raw.date.trim()
                : toIsoDate(baseDate);

        const exercises =
            Array.isArray(raw?.exercises) && raw.exercises.length > 0
                ? raw.exercises.map((e: any) => normalizeExercise(e, movementNameById))
                : raw?.exercises === null
                    ? null
                    : null;

        return {
            dayKey,
            date,
            sessionType:
                typeof raw?.sessionType === "string"
                    ? raw.sessionType
                    : raw?.sessionType === null
                        ? null
                        : null,
            focus:
                typeof raw?.focus === "string"
                    ? raw.focus
                    : raw?.focus === null
                        ? null
                        : null,
            exercises,
            notes:
                typeof raw?.notes === "string"
                    ? raw.notes
                    : raw?.notes === null
                        ? null
                        : null,
            tags: Array.isArray(raw?.tags)
                ? raw.tags.map((x) => String(x)).filter(Boolean)
                : raw?.tags === null
                    ? null
                    : null,
        };
    });
}

// =========================================================
// Public service API used by controller
// =========================================================

export async function getRoutineWeek(userId: string, weekKey: string) {
    // ✅ IMPORTANT: do NOT use .lean() here, or `id` will be missing.
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    return doc ? doc.toJSON() : null;
}

export async function initRoutineWeek(
    userId: string,
    weekKey: string,
    opts?: { title?: string; split?: string; unarchive?: boolean }
) {
    const existing = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });

    if (existing) {
        let changed = false;

        if (existing.status === "archived" && opts?.unarchive) {
            existing.status = "active";
            changed = true;
        }
        if (typeof opts?.title === "string" && opts.title !== existing.title) {
            existing.title = opts.title;
            changed = true;
        }
        if (typeof opts?.split === "string" && opts.split !== existing.split) {
            existing.split = opts.split;
            changed = true;
        }

        // snapshot movementName for whatever exists in DB already
        const existingMovementIds = collectMovementIdsFromDays(existing.days as any);
        const movementNameById = await buildMovementNameMap({ userId, movementIds: existingMovementIds });

        // enforce 7 full-shape days even for older routines
        const normalizedDays = ensure7Days(weekKey, existing.days as any, movementNameById);
        const before = JSON.stringify(existing.days ?? []);
        const after = JSON.stringify(normalizedDays);
        if (before !== after) {
            existing.days = normalizedDays as any;
            changed = true;
        }

        if (changed) await existing.save();
        return existing.toJSON();
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
        const movementIds = collectMovementIdsFromDays(payload.days);
        const movementNameById = await buildMovementNameMap({ userId, movementIds });

        doc.days = ensure7Days(weekKey, payload.days, movementNameById) as any;
    } else if (payload.day && isRecord(payload.day) && DAY_KEYS.includes(payload.day.dayKey as any)) {
        const current = Array.isArray(doc.days) ? (doc.days as any[]) : [];

        // If exercises are provided in this patch, build a map just for them (optional)
        let patchMovementNameById: Map<string, string> | undefined = undefined;
        if ("exercises" in payload.day && Array.isArray(payload.day.exercises)) {
            const movementIds = (payload.day.exercises ?? [])
                .map((e: any) => cleanStringOrNull(e?.movementId))
                .filter(Boolean) as string[];

            patchMovementNameById = await buildMovementNameMap({ userId, movementIds });
        }

        const merged = current.map((d: any) => {
            if (d?.dayKey !== payload.day!.dayKey) return d;

            const date =
                typeof payload.day!.date === "string" && payload.day!.date.trim()
                    ? payload.day!.date.trim()
                    : d.date;

            let nextExercises = d.exercises;
            if ("exercises" in payload.day!) {
                if (Array.isArray(payload.day!.exercises)) {
                    nextExercises = payload.day!.exercises.map((e: any) =>
                        normalizeExercise(e, patchMovementNameById)
                    );
                } else {
                    nextExercises = payload.day!.exercises ?? null;
                }
            }

            return {
                ...d,
                date,
                sessionType: "sessionType" in payload.day! ? (payload.day!.sessionType ?? null) : d.sessionType,
                focus: "focus" in payload.day! ? (payload.day!.focus ?? null) : d.focus,
                exercises: nextExercises,
                notes: "notes" in payload.day! ? (payload.day!.notes ?? null) : d.notes,
                tags: "tags" in payload.day! ? (payload.day!.tags ?? null) : d.tags,
            };
        });

        // Re-snapshot for the whole merged week (and validate all movementIds)
        const mergedMovementIds = collectMovementIdsFromDays(merged as any);
        const mergedMovementNameById = await buildMovementNameMap({ userId, movementIds: mergedMovementIds });

        doc.days = ensure7Days(weekKey, merged as any, mergedMovementNameById) as any;
    }

    await doc.save();
    return doc.toJSON();
}

// =========================================================
// Attachments (week-level)
// =========================================================

type CloudinaryLike = {
    publicId: string;
    url: string;
    resourceType: "image" | "video";
    format: string | null;
    createdAt: string;
    originalName: string | null;
};

function inferResourceTypeFromMimetype(mimetype?: string): "image" | "video" {
    const mt = (mimetype ?? "").toLowerCase();
    if (mt.startsWith("video/")) return "video";
    return "image";
}

function inferFormatFromOriginalName(originalName?: string): string | null {
    const n = (originalName ?? "").trim().toLowerCase();
    const m = /\.([a-z0-9]{2,6})(\?.*)?$/.exec(n);
    return m ? m[1] : null;
}

function extractCloudinaryInfo(file: Express.Multer.File): CloudinaryLike | null {
    const anyFile: any = file as any;

    const publicId =
        anyFile.filename ??
        anyFile.public_id ??
        anyFile.publicId ??
        anyFile.cloudinary?.public_id ??
        anyFile.cloudinary?.publicId;

    const url =
        anyFile.path ??
        anyFile.secure_url ??
        anyFile.url ??
        anyFile.cloudinary?.secure_url ??
        anyFile.cloudinary?.url;

    const resourceTypeRaw =
        anyFile.resource_type ??
        anyFile.resourceType ??
        anyFile.cloudinary?.resource_type ??
        anyFile.cloudinary?.resourceType;

    const resourceType: "image" | "video" =
        resourceTypeRaw === "video" || resourceTypeRaw === "image"
            ? resourceTypeRaw
            : inferResourceTypeFromMimetype(anyFile.mimetype);

    const format =
        (typeof anyFile.format === "string" && anyFile.format) ||
        (typeof anyFile.cloudinary?.format === "string" && anyFile.cloudinary.format) ||
        inferFormatFromOriginalName(anyFile.originalname);

    const createdAt =
        anyFile.created_at ??
        anyFile.createdAt ??
        anyFile.cloudinary?.created_at ??
        anyFile.cloudinary?.createdAt ??
        new Date().toISOString();

    if (!publicId || !url) return null;

    return {
        publicId: String(publicId),
        url: String(url),
        resourceType,
        format: format ? String(format) : null,
        createdAt: String(createdAt),
        originalName: anyFile.originalname ? String(anyFile.originalname) : null,
    };
}

export async function addRoutineAttachments(userId: string, weekKey: string, files: Express.Multer.File[]) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    const next = (doc.attachments ?? []).slice();

    for (const f of files) {
        const info = extractCloudinaryInfo(f);
        if (!info) continue;

        const exists = next.some((a: any) => a?.publicId === info.publicId);
        if (exists) continue;

        next.push({
            publicId: info.publicId,
            url: info.url,
            resourceType: info.resourceType,
            format: info.format,
            createdAt: info.createdAt,
            meta: null,
            originalName: info.originalName,
        } as any);
    }

    doc.attachments = next as any;
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

    doc.attachments = (doc.attachments ?? []).filter((a: any) => a?.publicId !== publicId) as any;

    doc.days = (doc.days ?? []).map((d: any) => {
        if (!Array.isArray(d?.exercises)) return d;
        const exercises = d.exercises.map((e: any) => {
            if (!Array.isArray(e?.attachmentPublicIds)) return e;
            return {
                ...e,
                attachmentPublicIds: e.attachmentPublicIds.filter((x: any) => x !== publicId),
            };
        });
        return { ...d, exercises };
    }) as any;

    await doc.save();
    return doc.toJSON();
}

// =========================================================
// Gym Check (sync checklist + day metrics) - persisted in RoutineWeek.meta.gymCheck
// =========================================================

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cleanIsoOrNull(v: unknown): string | null {
    return cleanStringOrNull(v);
}

function cleanNumberOrNull(v: unknown): number | null {
    if (v === null) return null;
    if (typeof v !== "number") return null;
    return Number.isFinite(v) ? v : null;
}

function cleanStringArrayOrNull(v: unknown): string[] | null {
    if (v === null) return null;
    if (!Array.isArray(v)) return null;
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : null;
}

function mergeGymCheckExercise(prev: Record<string, unknown> | null, patch: GymCheckExercisePatch): Record<string, unknown> {
    const base: Record<string, unknown> = { ...(prev ?? {}) };

    if ("done" in patch) base.done = patch.done ?? null;
    if ("notes" in patch) base.notes = patch.notes ?? null;
    if ("durationMin" in patch) base.durationMin = patch.durationMin ?? null;
    if ("mediaPublicIds" in patch) base.mediaPublicIds = patch.mediaPublicIds ?? null;

    return base;
}

function normalizeGymCheckMetricsPatch(payload: unknown): GymCheckMetricsPatch {
    if (!isPlainObject(payload)) return {};

    const out: GymCheckMetricsPatch = {};

    if ("startAt" in payload) out.startAt = cleanIsoOrNull((payload as any).startAt);
    if ("endAt" in payload) out.endAt = cleanIsoOrNull((payload as any).endAt);

    if ("activeKcal" in payload) out.activeKcal = cleanNumberOrNull((payload as any).activeKcal);
    if ("totalKcal" in payload) out.totalKcal = cleanNumberOrNull((payload as any).totalKcal);

    if ("avgHr" in payload) out.avgHr = cleanNumberOrNull((payload as any).avgHr);
    if ("maxHr" in payload) out.maxHr = cleanNumberOrNull((payload as any).maxHr);

    if ("distanceKm" in payload) out.distanceKm = cleanNumberOrNull((payload as any).distanceKm);
    if ("steps" in payload) out.steps = cleanNumberOrNull((payload as any).steps);
    if ("elevationGainM" in payload) out.elevationGainM = cleanNumberOrNull((payload as any).elevationGainM);

    if ("paceSecPerKm" in payload) out.paceSecPerKm = cleanNumberOrNull((payload as any).paceSecPerKm);
    if ("cadenceRpm" in payload) out.cadenceRpm = cleanNumberOrNull((payload as any).cadenceRpm);

    if ("effortRpe" in payload) out.effortRpe = cleanNumberOrNull((payload as any).effortRpe);

    if ("trainingSource" in payload) out.trainingSource = cleanStringOrNull((payload as any).trainingSource);
    if ("dayEffortRpe" in payload) out.dayEffortRpe = cleanNumberOrNull((payload as any).dayEffortRpe);

    return out;
}

function normalizeGymCheckDayPatch(payload: unknown): GymCheckDayPatch {
    if (!isPlainObject(payload)) return {};

    const out: GymCheckDayPatch = {};

    if ("durationMin" in payload) out.durationMin = cleanNumberOrNull((payload as any).durationMin);
    if ("notes" in payload) out.notes = cleanStringOrNull((payload as any).notes);

    if ("metrics" in payload) {
        const raw = (payload as any).metrics;
        if (raw === null) out.metrics = null;
        else if (isPlainObject(raw)) out.metrics = normalizeGymCheckMetricsPatch(raw);
    }

    if ("exercises" in payload) {
        const raw = (payload as any).exercises;

        if (raw === null) {
            out.exercises = null;
        } else if (isPlainObject(raw)) {
            const map: Record<string, GymCheckExercisePatch> = {};
            for (const [k, v] of Object.entries(raw)) {
                if (!k || typeof k !== "string") continue;

                if (v === null) {
                    map[k] = { done: null, notes: null, durationMin: null, mediaPublicIds: null };
                    continue;
                }

                if (!isPlainObject(v)) continue;

                const p: GymCheckExercisePatch = {};
                if ("done" in v)
                    p.done =
                        typeof (v as any).done === "boolean"
                            ? (v as any).done
                            : (v as any).done === null
                                ? null
                                : undefined;

                if ("notes" in v) p.notes = cleanStringOrNull((v as any).notes);
                if ("durationMin" in v) p.durationMin = cleanNumberOrNull((v as any).durationMin);
                if ("mediaPublicIds" in v) p.mediaPublicIds = cleanStringArrayOrNull((v as any).mediaPublicIds);

                map[k] = p;
            }
            out.exercises = map;
        }
    }

    return out;
}

export async function patchGymCheckDay(userId: string, weekKey: string, dayKey: DayKey, payload: unknown) {
    const doc = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (!doc) return null;

    const patch = normalizeGymCheckDayPatch(payload);

    const metaAny: any = isPlainObject(doc.meta) ? { ...(doc.meta as any) } : {};
    const gymCheckAny: any = isPlainObject(metaAny.gymCheck) ? { ...(metaAny.gymCheck as any) } : {};

    const prevDay: any = isPlainObject(gymCheckAny[dayKey]) ? { ...(gymCheckAny[dayKey] as any) } : {};
    const nextDay: any = { ...prevDay };

    if ("durationMin" in patch) nextDay.durationMin = patch.durationMin ?? null;
    if ("notes" in patch) nextDay.notes = patch.notes ?? null;

    if ("metrics" in patch) {
        if (patch.metrics === null) {
            nextDay.metrics = null;
        } else if (patch.metrics && typeof patch.metrics === "object") {
            const prevMetrics = isPlainObject(prevDay.metrics) ? { ...(prevDay.metrics as any) } : {};
            nextDay.metrics = { ...prevMetrics, ...patch.metrics };
        }
    }

    if ("exercises" in patch) {
        if (patch.exercises === null) {
            nextDay.exercises = null;
        } else if (patch.exercises && typeof patch.exercises === "object") {
            const prevExercises: any = isPlainObject(prevDay.exercises) ? { ...(prevDay.exercises as any) } : {};
            const nextExercises: any = { ...prevExercises };

            for (const [exerciseId, exPatch] of Object.entries(patch.exercises)) {
                const prevEx = isPlainObject(prevExercises[exerciseId]) ? (prevExercises[exerciseId] as any) : null;
                nextExercises[exerciseId] = mergeGymCheckExercise(prevEx, exPatch);
            }

            nextDay.exercises = nextExercises;
        }
    }

    gymCheckAny[dayKey] = nextDay;
    metaAny.gymCheck = gymCheckAny;

    doc.meta = metaAny as any;

    await doc.save();
    return doc.toJSON();
}

export async function patchRoutineGymCheckDay(userId: string, weekKey: string, dayKey: DayKey, payload: unknown) {
    return patchGymCheckDay(userId, weekKey, dayKey, payload);
}

export async function listRoutineWeeks(userId: string, opts?: { status?: "active" | "archived"; limit?: number }) {
    const filter: any = { userId };
    if (opts?.status) filter.status = opts.status;

    const limit = typeof opts?.limit === "number" ? opts.limit : 20;

    // Return lightweight summaries (no heavy days/attachments)
    const docs = await WorkoutRoutineWeekModel.find(filter)
        .sort({ "range.from": -1 }) // newest week first
        .limit(limit)
        .select("weekKey range status title split plannedDays createdAt updatedAt")
        .lean();

    return docs.map((d: any) => ({
        id: String(d._id),
        weekKey: d.weekKey,
        range: d.range,
        status: d.status,
        title: d.title ?? null,
        split: d.split ?? null,
        plannedDays: d.plannedDays ?? null,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : undefined,
    }));
}
