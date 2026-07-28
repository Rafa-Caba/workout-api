// src/types/gymCheck.types.ts
// Types used by Gym Check patch/update flows.

import type {
    WorkoutDataSource,
    WorkoutSourceDevice,
} from "./workoutDay.types";

export type GymCheckExerciseSet = {
    setIndex: number;
    reps: number | null;
    weight: number | null;
    unit: "lb" | "kg";
    rpe: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    tempo: string | null;
    restSec: number | null;
    tags: string[] | null;
    meta: Record<string, unknown> | null;
};

export type GymCheckExercisePatch = {
    done?: boolean | null;
    notes?: string | null;
    durationMin?: number | null;
    mediaPublicIds?: string[] | null;
    performedSets?: GymCheckExerciseSet[] | null;
};

export type GymCheckMetricsPatch = {
    startAt?: string | null;
    endAt?: string | null;

    activeKcal?: number | null;
    totalKcal?: number | null;
    totalKcalEstimated?: boolean | null;

    avgHr?: number | null;
    maxHr?: number | null;

    distanceKm?: number | null;
    steps?: number | null;
    elevationGainM?: number | null;

    paceSecPerKm?: number | null;
    cadenceRpm?: number | null;

    effortRpe?: number | null;

    /**
     * Existing day-level training source used by Gym Check flows.
     * Kept for backward compatibility with current code paths.
     */
    trainingSource?: string | null;

    /**
     * Optional provider-level metadata enrichment for health-imported metrics.
     */
    source?: WorkoutDataSource | null;
    sourceDevice?: WorkoutSourceDevice | null;

    dayEffortRpe?: number | null;
};

export type GymCheckDayPatch = {
    durationMin?: number | null;
    notes?: string | null;
    metrics?: GymCheckMetricsPatch | null;
    exercises?: Record<string, GymCheckExercisePatch> | null;
};