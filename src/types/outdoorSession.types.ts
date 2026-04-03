// src/types/outdoorSession.types.ts

/**
 * Central outdoor session types for backend workout module.
 * These types are shared-oriented so they can be reused by:
 * - models
 * - services
 * - controllers
 * - validators / request schemas
 */

/**
 * Supported outdoor activity families for the first module scope.
 */
export type OutdoorActivityType = "walking" | "running";

/**
 * Normalized outdoor metrics persisted on a workout session.
 * Keep this separated from the generic session root shape so the outdoor
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
 * Shared optional patch helper for outdoor metrics updates.
 * Useful for merge/upsert flows in services.
 */
export type WorkoutOutdoorMetricsPatch = Partial<WorkoutOutdoorMetrics>;

/**
 * Shared optional patch helper for route summary updates.
 * Useful for merge/upsert flows in services.
 */
export type WorkoutRouteSummaryPatch = Partial<WorkoutRouteSummary>;

/**
 * Shared helper for session-level outdoor fields in upsert/patch flows.
 * This is intentionally reusable across controller/service boundaries.
 */
export type OutdoorSessionFieldsPatch = {
    activityType?: OutdoorActivityType | null;
    hasRoute?: boolean;
    outdoorMetrics?: WorkoutOutdoorMetricsPatch | null;
    routeSummary?: WorkoutRouteSummaryPatch | null;
};

/**
 * Output-oriented helper when a fully normalized outdoor shape is needed
 * by services or response mappers.
 */
export type OutdoorSessionFields = {
    activityType: OutdoorActivityType | null;
    hasRoute: boolean;
    outdoorMetrics: WorkoutOutdoorMetrics | null;
    routeSummary: WorkoutRouteSummary | null;
};