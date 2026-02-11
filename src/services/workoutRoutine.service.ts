import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
const DAY_KEYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type RoutineExercise = {
    name: string;
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
    incoming?: RoutineDay[] | null
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
            Array.isArray(raw?.exercises) && raw!.exercises!.length > 0
                ? raw!.exercises!.map((e) => ({
                    name: String(e.name ?? "").trim(),
                    sets: typeof e.sets === "number" ? e.sets : e.sets === null ? null : null,
                    reps: typeof e.reps === "string" ? e.reps : e.reps === null ? null : null,
                    rpe: typeof e.rpe === "number" ? e.rpe : e.rpe === null ? null : null,
                    load: typeof e.load === "string" ? e.load : e.load === null ? null : null,
                    notes: typeof e.notes === "string" ? e.notes : e.notes === null ? null : null,
                    attachmentPublicIds: Array.isArray(e.attachmentPublicIds)
                        ? e.attachmentPublicIds.map((x) => String(x).trim()).filter(Boolean)
                        : e.attachmentPublicIds === null
                            ? null
                            : null,
                }))
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
                ? raw!.tags!.map((x) => String(x)).filter(Boolean)
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
    return WorkoutRoutineWeekModel.findOne({ userId, weekKey }).lean();
}

export async function initRoutineWeek(
    userId: string,
    weekKey: string,
    opts?: { title?: string; split?: string; unarchive?: boolean }
) {
    const existing = await WorkoutRoutineWeekModel.findOne({ userId, weekKey });
    if (existing) {
        if (existing.status === "archived" && opts?.unarchive) {
            existing.status = "active";
            if (typeof opts.title === "string") existing.title = opts.title;
            if (typeof opts.split === "string") existing.split = opts.split;
            await existing.save();
        }
        return existing.toJSON();
    }

    const range = weekKeyToRange(weekKey);
    const days = ensure7Days(weekKey, null);

    const created = await WorkoutRoutineWeekModel.create({
        userId,
        weekKey,
        range,
        status: "active",
        title: typeof opts?.title === "string" ? opts!.title : null,
        split: typeof opts?.split === "string" ? opts!.split : null,
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
        doc.days = ensure7Days(weekKey, payload.days) as any;
    } else if (payload.day && isRecord(payload.day) && DAY_KEYS.includes(payload.day.dayKey as any)) {
        const current = Array.isArray(doc.days) ? (doc.days as any[]) : [];
        const merged = current.map((d: any) => {
            if (d?.dayKey !== payload.day!.dayKey) return d;

            const date =
                typeof payload.day!.date === "string" && payload.day!.date.trim()
                    ? payload.day!.date.trim()
                    : d.date;

            return {
                ...d,
                date,
                sessionType: "sessionType" in payload.day! ? (payload.day!.sessionType ?? null) : d.sessionType,
                focus: "focus" in payload.day! ? (payload.day!.focus ?? null) : d.focus,
                exercises: "exercises" in payload.day! ? (payload.day!.exercises ?? null) : d.exercises,
                notes: "notes" in payload.day! ? (payload.day!.notes ?? null) : d.notes,
                tags: "tags" in payload.day! ? (payload.day!.tags ?? null) : d.tags,
            };
        });

        doc.days = ensure7Days(weekKey, merged as any) as any;
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

/**
 * Robust extraction for multer-storage-cloudinary:
 * - publicId is usually file.filename
 * - url is usually file.path
 */
function extractCloudinaryInfo(file: Express.Multer.File): CloudinaryLike | null {
    const anyFile: any = file as any;

    // Common multer-storage-cloudinary fields:
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

        // Deduplicate by publicId (safety)
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

    // Also remove from planned exercise links
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
