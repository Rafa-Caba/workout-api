export type ISODate = string; // YYYY-MM-DD
export type WeekKey = string; // YYYY-W##

export type RoutineDayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/**
 * =========================================================
 * CANONICAL Planned Exercise (routine.days[].exercises[])
 * =========================================================
 * - attachmentPublicIds links to routine.attachments[].publicId
 */
export type RoutineExercise = {
    id: string;
    name: string;

    sets: number | null;
    reps: string | null;

    load: string | null;
    rpe: number | null;

    notes: string | null;

    attachmentPublicIds: string[] | null;
};

export type RoutineDayTemplate = {
    date: ISODate;
    dayKey: RoutineDayKey;

    sessionType: string | null;
    focus: string | null;

    exercises: RoutineExercise[] | null;

    notes: string | null;
    tags: string[] | null;
};

export type RoutineAttachment = {
    publicId: string;
    url: string;
    resourceType: "image" | "video";
    format: string | null;
    createdAt: string;
    meta: Record<string, unknown> | null;
};

export type RoutineWeekTemplate = {
    id: string;

    userId: string;
    weekKey: WeekKey;

    range: { from: ISODate; to: ISODate };

    status: "active" | "archived";

    title: string | null;
    split: string | null;
    plannedDays: RoutineDayKey[] | null;

    attachments: RoutineAttachment[];

    // Canonical planned routine storage
    days: RoutineDayTemplate[];

    // UI-helper only (meta.plan, etc.)
    meta: Record<string, unknown> | null;

    createdAt: string;
    updatedAt: string;
};
