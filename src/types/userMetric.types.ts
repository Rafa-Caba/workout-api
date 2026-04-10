// src/types/userMetric.types.ts
import type { ISODate } from "./workoutDay.types";

export type UserMetricSource =
    | "manual"
    | "profile"
    | "device"
    | "import"
    | "coach";

export type UserMetricCustomMetric = {
    key: string;
    label: string;
    value: number;
    unit: string;
};

export type UserMetricEntry = {
    id: string;
    userId: string;
    date: ISODate;

    weightKg: number | null;
    bodyFatPct: number | null;
    waistCm: number | null;

    customMetrics: UserMetricCustomMetric[];

    notes: string | null;

    source: UserMetricSource;
    sourceDevice: string | null;
    importedAt: string | null;
    createdFromProfile: boolean;

    meta: Record<string, unknown> | null;

    createdAt: string;
    updatedAt: string;
};

export type UpsertUserMetricRequest = {
    weightKg?: number | null;
    bodyFatPct?: number | null;
    waistCm?: number | null;

    customMetrics?: UserMetricCustomMetric[];
    notes?: string | null;

    source?: UserMetricSource;
    sourceDevice?: string | null;
    importedAt?: string | null;

    meta?: Record<string, unknown> | null;
};

export type UserMetricListQuery = {
    from?: ISODate;
    to?: ISODate;
};

export type UserMetricListResponse = {
    from: ISODate | null;
    to: ISODate | null;
    metrics: UserMetricEntry[];
};

export type UserMetricLatestResponse = {
    latest: UserMetricEntry | null;
};