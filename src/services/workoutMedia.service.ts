import mongoose from "mongoose";
import { WorkoutDayModel } from "../models/WorkoutDay.model";
import { WorkoutRoutineWeekModel } from "../models/WorkoutRoutineWeek.model";
import { deleteFromCloudinary } from "../utils/cloudinaryDelete";
import type {
    MediaDeleteResponse,
    MediaFeedItem,
    MediaFeedResponse,
    MediaGroupedResponse,
    MediaGroupBy,
    MediaResourceType,
} from "../types/workoutMedia.types";

type MediaSource = "day" | "routine" | "all";

type MediaFeedArgs = {
    userId: string;

    source?: MediaSource;

    from?: string;
    to?: string;
    date?: string;
    weekKey?: string;
    sessionId?: string;
    resourceType?: MediaResourceType;

    limit?: number;
    cursor?: string | null;
};

type MediaGroupedArgs = MediaFeedArgs & {
    groupBy?: MediaGroupBy;
    perGroupLimit?: number;
};

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

type ParsedCursor = { createdAt: string; publicId: string; source: "day" | "routine" };

const parseCursor = (cursor: string | null | undefined): ParsedCursor | null => {
    if (!cursor) return null;
    const parts = cursor.split("|").map((x) => x.trim());
    if (parts.length !== 2 && parts.length !== 3) return null;

    const createdAt = parts[0];
    const publicId = parts[1];
    const source = (parts[2] ?? "day") as ParsedCursor["source"];

    if (!createdAt || !publicId) return null;
    if (source !== "day" && source !== "routine") return null;

    return { createdAt, publicId, source };
};

const makeCursor = (createdAt: string, publicId: string, source: ParsedCursor["source"]) =>
    `${createdAt}|${publicId}|${source}`;

const buildDateMatch = (args: MediaFeedArgs) => {
    const match: any = {};
    if (args.date) match.date = args.date;
    else if (args.weekKey) match.weekKey = args.weekKey;
    else if (args.from && args.to) match.date = { $gte: args.from, $lte: args.to };
    return match;
};

const buildWeekKeyMatch = (args: MediaFeedArgs) => {
    const match: any = {};
    if (args.weekKey) match.weekKey = args.weekKey;
    // if date/from-to are provided, we can still filter routine attachments by weekKey only
    // because routines are week-scoped. We’ll only apply weekKey if present.
    return match;
};

const dayPipeline = (args: MediaFeedArgs, cursorObj: ParsedCursor | null, limit: number) => {
    const userObjectId = toObjectId(args.userId);
    const dayMatch = buildDateMatch(args);

    const pipeline: any[] = [
        { $match: { userId: userObjectId, ...dayMatch } },
        { $unwind: { path: "$training.sessions", preserveNullAndEmptyArrays: false } },
        { $unwind: { path: "$training.sessions.media", preserveNullAndEmptyArrays: false } },
    ];

    if (args.sessionId) {
        pipeline.push({
            $match: { "training.sessions._id": new mongoose.Types.ObjectId(args.sessionId) },
        });
    }

    if (args.resourceType) {
        pipeline.push({ $match: { "training.sessions.media.resourceType": args.resourceType } });
    }

    // cursor only applies to day items when cursor.source === "day"
    if (cursorObj && cursorObj.source === "day") {
        pipeline.push({
            $match: {
                $or: [
                    { "training.sessions.media.createdAt": { $lt: cursorObj.createdAt } },
                    {
                        "training.sessions.media.createdAt": cursorObj.createdAt,
                        "training.sessions.media.publicId": { $lt: cursorObj.publicId },
                    },
                ],
            },
        });
    }

    pipeline.push(
        { $sort: { "training.sessions.media.createdAt": -1, "training.sessions.media.publicId": -1 } },
        { $limit: limit + 1 },
        {
            $project: {
                _id: 0,
                source: { $literal: "day" },

                date: "$date",
                weekKey: "$weekKey",
                dayNotes: "$notes",
                dayTags: "$tags",

                sessionId: { $toString: "$training.sessions._id" },
                sessionType: "$training.sessions.type",

                publicId: "$training.sessions.media.publicId",
                url: "$training.sessions.media.url",
                resourceType: "$training.sessions.media.resourceType",
                format: "$training.sessions.media.format",
                createdAt: "$training.sessions.media.createdAt",
                meta: "$training.sessions.media.meta",
            },
        }
    );

    return pipeline;
};

const routinePipeline = (args: MediaFeedArgs, cursorObj: ParsedCursor | null, limit: number) => {
    const userObjectId = toObjectId(args.userId);
    const wkMatch = buildWeekKeyMatch(args);

    const pipeline: any[] = [
        { $match: { userId: userObjectId, ...wkMatch } },
        { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
    ];

    if (args.resourceType) {
        pipeline.push({ $match: { "attachments.resourceType": args.resourceType } });
    }

    // cursor only applies to routine items when cursor.source === "routine"
    if (cursorObj && cursorObj.source === "routine") {
        pipeline.push({
            $match: {
                $or: [
                    { "attachments.createdAt": { $lt: cursorObj.createdAt } },
                    { "attachments.createdAt": cursorObj.createdAt, "attachments.publicId": { $lt: cursorObj.publicId } },
                ],
            },
        });
    }

    pipeline.push(
        { $sort: { "attachments.createdAt": -1, "attachments.publicId": -1 } },
        { $limit: limit + 1 },
        {
            $project: {
                _id: 0,
                source: { $literal: "routine" },

                // routine is week-scoped, not day-scoped
                date: { $literal: null },
                weekKey: "$weekKey",
                dayNotes: { $literal: null },
                dayTags: { $literal: null },

                sessionId: { $literal: null },
                sessionType: { $literal: "Routine Attachment" },

                publicId: "$attachments.publicId",
                url: "$attachments.url",
                resourceType: "$attachments.resourceType",
                format: "$attachments.format",
                createdAt: "$attachments.createdAt",
                meta: "$attachments.meta",
            },
        }
    );

    return pipeline;
};

const compareFeedItemsDesc = (a: any, b: any) => {
    // primary: createdAt desc
    if (a.createdAt !== b.createdAt) return a.createdAt > b.createdAt ? -1 : 1;
    // secondary: publicId desc
    if (a.publicId !== b.publicId) return a.publicId > b.publicId ? -1 : 1;
    // tertiary: source desc (stable)
    return String(a.source) > String(b.source) ? -1 : 1;
};

export const getMediaFeed = async (args: MediaFeedArgs): Promise<MediaFeedResponse> => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    // ✅ Align default behavior with Stats: default to "all"
    const source: MediaSource = args.source ?? "all";

    const cursorObj = parseCursor(args.cursor ?? null);

    // Fetch slightly more per source so merge has enough to fill the page
    const perSourceLimit = source === "all" ? Math.min(limit, 200) : limit;

    let dayRows: any[] = [];
    let routineRows: any[] = [];

    if (source === "day" || source === "all") {
        dayRows = (await WorkoutDayModel.aggregate(dayPipeline(args, cursorObj, perSourceLimit))) as any[];
    }

    if (source === "routine" || source === "all") {
        routineRows = (await WorkoutRoutineWeekModel.aggregate(routinePipeline(args, cursorObj, perSourceLimit))) as any[];
    }

    // Determine which sources have more (they each returned limit+1)
    const dayHasMore = dayRows.length > perSourceLimit;
    const routineHasMore = routineRows.length > perSourceLimit;

    const dayItems = dayHasMore ? dayRows.slice(0, perSourceLimit) : dayRows;
    const routineItems = routineHasMore ? routineRows.slice(0, perSourceLimit) : routineRows;

    // Merge and paginate in memory for source=all
    let merged =
        source === "all"
            ? [...dayItems, ...routineItems].sort(compareFeedItemsDesc)
            : source === "day"
                ? dayItems
                : routineItems;

    const hasMore =
        source === "all"
            ? dayHasMore || routineHasMore || merged.length > limit
            : source === "day"
                ? dayHasMore
                : routineHasMore;

    // Final trim for requested limit
    if (merged.length > limit) merged = merged.slice(0, limit);

    const last = merged.length ? merged[merged.length - 1] : null;
    const nextCursor =
        hasMore && last ? makeCursor(String(last.createdAt), String(last.publicId), (last.source ?? "day") as any) : null;

    return {
        filters: {
            source,

            from: args.from ?? null,
            to: args.to ?? null,
            date: args.date ?? null,
            weekKey: args.weekKey ?? null,
            sessionId: args.sessionId ?? null,
            resourceType: args.resourceType ?? null,
        } as any,
        limit,
        cursor: args.cursor ?? null,
        nextCursor,
        items: merged as MediaFeedItem[],
    };
};

export const getMediaGrouped = async (args: MediaGroupedArgs): Promise<MediaGroupedResponse> => {
    const feed = await getMediaFeed({ ...args, limit: Math.min(args.limit ?? 200, 200) });
    const groupBy: MediaGroupBy = args.groupBy ?? "day";
    const perGroupLimit = Math.min(Math.max(args.perGroupLimit ?? 50, 1), 200);

    const map = new Map<string, MediaFeedItem[]>();

    for (const item of feed.items as any[]) {
        // For routine items, date is null, so grouping-by-day would collapse to "null".
        // We prefer week grouping for routine items; but if groupBy=day, we’ll group routine items under their weekKey.
        const key =
            groupBy === "week" ? String(item.weekKey) : item.date ? String(item.date) : String(item.weekKey);

        const arr = map.get(key) ?? [];
        if (arr.length < perGroupLimit) arr.push(item);
        map.set(key, arr);
    }

    const groups = Array.from(map.entries())
        .map(([key, items]) => ({ key, count: items.length, items }))
        .sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));

    return {
        groupBy,
        filters: (feed as any).filters,
        groups,
    };
};

export const deleteMediaByPublicId = async (
    userId: string,
    publicId: string,
    deleteCloudinary: boolean
): Promise<MediaDeleteResponse> => {
    const userObjectId = toObjectId(userId);

    // 1) Try WorkoutDay first (current behavior)
    const foundDay = await WorkoutDayModel.aggregate([
        { $match: { userId: userObjectId } },
        { $unwind: { path: "$training.sessions", preserveNullAndEmptyArrays: false } },
        { $unwind: { path: "$training.sessions.media", preserveNullAndEmptyArrays: false } },
        { $match: { "training.sessions.media.publicId": publicId } },
        {
            $project: {
                _id: 1,
                date: "$date",
                weekKey: "$weekKey",
                sessionId: { $toString: "$training.sessions._id" },
                sessionType: "$training.sessions.type",
                resourceType: "$training.sessions.media.resourceType",
            },
        },
        { $limit: 1 },
    ]);

    if (foundDay?.length) {
        const ctx = foundDay[0] as {
            _id: mongoose.Types.ObjectId;
            date: string;
            weekKey: string;
            sessionId: string;
            sessionType: string;
            resourceType: "image" | "video";
        };

        const dayDoc = await WorkoutDayModel.findOne({ _id: ctx._id, userId: userObjectId });
        if (!dayDoc) {
            return {
                deleted: false,
                publicId,
                removedFromDb: false,
                cloudinary: null,
                context: { date: ctx.date, weekKey: ctx.weekKey, sessionId: ctx.sessionId, sessionType: ctx.sessionType },
            };
        }

        const sessions: any[] = (dayDoc as any).training?.sessions ?? [];
        const session = sessions.find((s: any) => String(s._id) === ctx.sessionId);
        if (!session || !Array.isArray(session.media)) {
            return {
                deleted: false,
                publicId,
                removedFromDb: false,
                cloudinary: null,
                context: { date: ctx.date, weekKey: ctx.weekKey, sessionId: ctx.sessionId, sessionType: ctx.sessionType },
            };
        }

        const before = session.media.length;
        session.media = session.media.filter((m: any) => m?.publicId !== publicId);
        const after = session.media.length;

        const removedFromDb = after < before;
        await dayDoc.save();

        let cloudinary: MediaDeleteResponse["cloudinary"] = null;
        if (deleteCloudinary) {
            try {
                await deleteFromCloudinary(publicId, { resourceType: ctx.resourceType });
                cloudinary = { deleted: true, error: null };
            } catch (e: any) {
                cloudinary = { deleted: false, error: String(e?.message ?? e) };
            }
        }

        return {
            deleted: removedFromDb,
            publicId,
            removedFromDb,
            cloudinary,
            context: { date: ctx.date, weekKey: ctx.weekKey, sessionId: ctx.sessionId, sessionType: ctx.sessionType },
        };
    }

    // 2) Try WorkoutRoutineWeek.attachments
    const foundRoutine = await WorkoutRoutineWeekModel.aggregate([
        { $match: { userId: userObjectId } },
        { $unwind: { path: "$attachments", preserveNullAndEmptyArrays: false } },
        { $match: { "attachments.publicId": publicId } },
        {
            $project: {
                _id: 1,
                weekKey: "$weekKey",
                resourceType: "$attachments.resourceType",
            },
        },
        { $limit: 1 },
    ]);

    if (!foundRoutine?.length) {
        return { deleted: false, publicId, removedFromDb: false, cloudinary: null, context: null };
    }

    const ctx2 = foundRoutine[0] as {
        _id: mongoose.Types.ObjectId;
        weekKey: string;
        resourceType: "image" | "video";
    };

    const routineDoc = await WorkoutRoutineWeekModel.findOne({ _id: ctx2._id, userId: userObjectId });
    if (!routineDoc) {
        return {
            deleted: false,
            publicId,
            removedFromDb: false,
            cloudinary: null,
            context: { date: null as any, weekKey: ctx2.weekKey, sessionId: null as any, sessionType: "Routine Attachment" },
        };
    }

    const before = (routineDoc as any).attachments?.length ?? 0;
    (routineDoc as any).attachments = ((routineDoc as any).attachments ?? []).filter((a: any) => a?.publicId !== publicId);
    const after = (routineDoc as any).attachments?.length ?? 0;

    const removedFromDb = after < before;
    await routineDoc.save();

    let cloudinary: MediaDeleteResponse["cloudinary"] = null;
    if (deleteCloudinary) {
        try {
            await deleteFromCloudinary(publicId, { resourceType: ctx2.resourceType });
            cloudinary = { deleted: true, error: null };
        } catch (e: any) {
            cloudinary = { deleted: false, error: String(e?.message ?? e) };
        }
    }

    return {
        deleted: removedFromDb,
        publicId,
        removedFromDb,
        cloudinary,
        context: { date: null as any, weekKey: ctx2.weekKey, sessionId: null as any, sessionType: "Routine Attachment" },
    };
};
