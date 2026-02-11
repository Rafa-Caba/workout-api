export type ISODate = string; // YYYY-MM-DD
export type WeekKey = string; // YYYY-W##

export type SummarySleep = {
    totalMinutes: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;
    score: number | null;
};

export type SummaryTrainingTotals = {
    sessionsCount: number;
    durationSeconds: number;
    activeKcal: number | null;
    totalKcal: number | null;

    avgHr: number | null; // duration-weighted when possible
    maxHr: number | null;

    distanceKm: number | null;
    steps: number | null;

    mediaCount: number;
};

export type DaySummaryResponse = {
    date: ISODate;
    weekKey: WeekKey | null;

    sleep: SummarySleep | null;
    training: SummaryTrainingTotals;

    notes: string | null;
    tags: string[] | null;
};

export type WeekSummaryResponse = {
    weekKey: WeekKey;
    range: { from: ISODate; to: ISODate };

    daysCount: number;

    sleep: {
        daysWithSleep: number;
        avgTotalMinutes: number | null;
        avgDeepMinutes: number | null;
        avgRemMinutes: number | null;
        avgScore: number | null;
    };

    training: SummaryTrainingTotals & {
        bySessionType: Array<{
            sessionType: string;
            sessionsCount: number;
            durationSeconds: number;
            activeKcal: number | null;
        }>;
    };

    mediaCount: number;
};

export type RangeSummaryResponse = {
    range: { from: ISODate; to: ISODate };
    daysCount: number;

    sleep: WeekSummaryResponse["sleep"];
    training: WeekSummaryResponse["training"];
    mediaCount: number;
};

export type WeekTrendPoint = {
    weekKey: WeekKey;
    range: { from: ISODate; to: ISODate };

    daysCount: number;

    sleep: {
        daysWithSleep: number;
        avgTotalMinutes: number | null;
        avgDeepMinutes: number | null;
        avgRemMinutes: number | null;
        avgScore: number | null;
    };

    training: {
        sessionsCount: number;
        durationSeconds: number;
        activeKcal: number | null;
        avgHr: number | null;
        maxHr: number | null;
    };

    mediaCount: number;
};

export type WeeksTrendResponse = {
    fromWeek: WeekKey;
    toWeek: WeekKey;
    points: WeekTrendPoint[];
};

export type PlanVsActualDayStatus =
    | "rest"
    | "planned_only"
    | "done"
    | "missed"
    | "extra"
    | "planned_and_extra";

export type PlanVsActualDay = {
    date: ISODate;
    dayKey: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

    planned: {
        sessionType: string | null;
        focus: string | null;
        tags: string[] | null;
    } | null;

    actual: {
        sessions: Array<{ id: string; type: string }>;
    };

    status: PlanVsActualDayStatus;
};

export type PlanVsActualWeekResponse = {
    weekKey: WeekKey;
    range: { from: ISODate; to: ISODate };

    hasRoutineTemplate: boolean;
    days: PlanVsActualDay[];
};

export type MediaStatsResponse = {
    range: { from: ISODate; to: ISODate };
    totals: {
        items: number;
        images: number;
        videos: number;
    };
    byDay: Array<{
        date: ISODate;
        items: number;
        images: number;
        videos: number;
    }>;
};
