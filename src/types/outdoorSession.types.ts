// src/types/outdoorSession.types.ts
// Shared cardio/outdoor session domain types used by WorkoutDay models,
// services, validators, and future live workout OS sync flows.

/**
 * Supported cardio activity families for the current module scope.
 * Kept as OutdoorActivityType for backwards compatibility with existing
 * Outdoor imports; the value itself also supports indoor cardio sessions.
 */
export type OutdoorActivityType = "walking" | "running";

/**
 * Distinguishes GPS-based outdoor workouts from treadmill/indoor sessions.
 * Old sessions can keep this as null until they are normalized/migrated.
 */
export type CardioEnvironment = "outdoor" | "indoor";

/**
 * Status of writing an app-created workout into Apple Health / Health Connect.
 * Null means the session was not created by the app live writer or has not
 * entered the write flow yet.
 */
export type WorkoutHealthWriteStatus = "pending" | "synced" | "failed";

/**
 * Normalized cardio/outdoor metrics persisted on a workout session.
 * Keep this separated from the generic session root shape so the cardio
 * module can evolve without overloading the base session contract.
 */
export type WorkoutOutdoorMetrics = {
    distanceKm: number | null;
    steps: number | null;
    elevationGainM: number | null;

    paceSecPerKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;

    cadenceRpm: number | null;
    strideLengthM: number | null;
};

/**
 * Lightweight persisted route summary for an outdoor session.
 * This allows the app to:
 * - know if a route exists
 * - show preview/detail metadata
 * - prepare future map rendering without storing route points here
 */
export type WorkoutRouteSummary = {
    pointCount: number;

    startLatitude: number | null;
    startLongitude: number | null;

    endLatitude: number | null;
    endLongitude: number | null;

    minLatitude: number | null;
    maxLatitude: number | null;

    minLongitude: number | null;
    maxLongitude: number | null;
};

/**
 * Shared optional patch helper for cardio metrics updates.
 * Useful for merge/upsert flows in services.
 */
export type WorkoutOutdoorMetricsPatch = Partial<WorkoutOutdoorMetrics>;

/**
 * Shared optional patch helper for route summary updates.
 * Useful for merge/upsert flows in services.
 */
export type WorkoutRouteSummaryPatch = Partial<WorkoutRouteSummary>;

/**
 * Shared helper for session-level cardio fields in upsert/patch flows.
 * This is intentionally reusable across controller/service boundaries.
 */
export type OutdoorSessionFieldsPatch = {
    activityType?: OutdoorActivityType | null;
    cardioEnvironment?: CardioEnvironment | null;
    hasRoute?: boolean;
    outdoorMetrics?: WorkoutOutdoorMetricsPatch | null;
    routeSummary?: WorkoutRouteSummaryPatch | null;
};

/**
 * Output-oriented helper when a fully normalized cardio shape is needed
 * by services or response mappers.
 */
export type OutdoorSessionFields = {
    activityType: OutdoorActivityType | null;
    cardioEnvironment: CardioEnvironment | null;
    hasRoute: boolean;
    outdoorMetrics: WorkoutOutdoorMetrics | null;
    routeSummary: WorkoutRouteSummary | null;
};
