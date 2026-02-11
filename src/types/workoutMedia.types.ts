export type MediaResourceType = "image" | "video";
export type MediaSource = "day" | "routine" | "all";

export type MediaFeedItem = {
    publicId: string;
    url: string;
    resourceType: MediaResourceType;
    format: string | null;
    createdAt: string;
    meta: Record<string, unknown> | null;

    // context
    date: string | null; // routine items can be null
    weekKey: string;
    sessionId: string | null; // routine items can be null
    sessionType: string;

    dayNotes: string | null;
    dayTags: string[] | null;

    // helpful for UI + pagination debugging
    source?: MediaSource;
};

export type MediaFeedResponse = {
    filters: {
        source: MediaSource;

        from: string | null;
        to: string | null;
        date: string | null;
        weekKey: string | null;
        sessionId: string | null;
        resourceType: MediaResourceType | null;
    };
    limit: number;
    cursor: string | null;
    nextCursor: string | null;
    items: MediaFeedItem[];
};

export type MediaGroupBy = "day" | "week";

export type MediaGroup = {
    key: string;
    count: number;
    items: MediaFeedItem[];
};

export type MediaGroupedResponse = {
    groupBy: MediaGroupBy;
    filters: MediaFeedResponse["filters"];
    groups: MediaGroup[];
};

export type MediaDeleteResponse = {
    deleted: boolean;
    publicId: string;

    removedFromDb: boolean;
    cloudinary: { deleted: boolean; error: string | null } | null;

    context: {
        date: string | null;
        weekKey: string;
        sessionId: string | null;
        sessionType: string;
    } | null;
};
