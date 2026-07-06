// /src/models/WorkoutDay.model.ts

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

type PlannedRoutineValidatorContext = {
    training?:
    | {
        sessions?: unknown[] | null;
    }
    | null;
    isNew: boolean;
    isModified(path: string): boolean;
};

type JsonObject = Record<string, unknown>;

type JsonWorkoutExercise = JsonObject & {
    _id?: unknown;
};

type JsonWorkoutSession = JsonObject & {
    _id?: unknown;
    exercises?: unknown;
};

type JsonTrainingBlock = JsonObject & {
    sessions?: unknown;
};

type JsonPlannedMeta = JsonObject & {
    plannedBy?: unknown;
};

type JsonTransformRet = JsonObject & {
    _id?: unknown;
    __v?: unknown;
    userId?: unknown;
    training?: JsonTrainingBlock | null;
    plannedMeta?: JsonPlannedMeta | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
};

const WorkoutMediaItemSchema = new Schema(
    {
        publicId: { type: String, required: true, trim: true, maxlength: 300 },
        url: { type: String, required: true, trim: true, maxlength: 2000 },

        resourceType: {
            type: String,
            required: true,
            enum: ["image", "video"],
        },

        format: { type: String, default: null, maxlength: 30 },

        createdAt: { type: String, required: true },

        meta: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const WorkoutExerciseSetSchema = new Schema(
    {
        setIndex: { type: Number, required: true, min: 1, max: 999 },

        reps: { type: Number, default: null, min: 0, max: 9999 },
        weight: { type: Number, default: null, min: 0, max: 99999 },

        unit: { type: String, required: true, enum: ["lb", "kg"] },

        rpe: { type: Number, default: null, min: 0, max: 10 },

        isWarmup: { type: Boolean, default: false },
        isDropSet: { type: Boolean, default: false },

        tempo: { type: String, default: null, maxlength: 50 },
        restSec: { type: Number, default: null, min: 0, max: 36000 },

        tags: { type: [String], default: null },
        meta: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const WorkoutExerciseSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 200 },
        movementId: { type: String, default: null, trim: true, maxlength: 120 },
        movementName: { type: String, default: null, trim: true, maxlength: 200 },
        notes: { type: String, default: null, maxlength: 5000 },
        sets: { type: [WorkoutExerciseSetSchema], default: null },
        meta: { type: Schema.Types.Mixed, default: null },
    },
    { _id: true }
);

const WorkoutCardioMetricsSchema = new Schema(
    {
        distanceKm: { type: Number, default: null, min: 0 },
        steps: { type: Number, default: null, min: 0 },
        elevationGainM: { type: Number, default: null, min: 0 },

        paceSecPerKm: { type: Number, default: null, min: 0 },
        avgSpeedKmh: { type: Number, default: null, min: 0 },
        maxSpeedKmh: { type: Number, default: null, min: 0 },

        cadenceRpm: { type: Number, default: null, min: 0 },
        strideLengthM: { type: Number, default: null, min: 0 },
    },
    { _id: false }
);

const WorkoutRouteSummarySchema = new Schema(
    {
        pointCount: { type: Number, required: true, min: 0 },

        startLatitude: { type: Number, default: null, min: -90, max: 90 },
        startLongitude: { type: Number, default: null, min: -180, max: 180 },

        endLatitude: { type: Number, default: null, min: -90, max: 90 },
        endLongitude: { type: Number, default: null, min: -180, max: 180 },

        minLatitude: { type: Number, default: null, min: -90, max: 90 },
        maxLatitude: { type: Number, default: null, min: -90, max: 90 },

        minLongitude: { type: Number, default: null, min: -180, max: 180 },
        maxLongitude: { type: Number, default: null, min: -180, max: 180 },
    },
    { _id: false }
);

const WorkoutRoutePointSchema = new Schema(
    {
        latitude: { type: Number, required: true, min: -90, max: 90 },
        longitude: { type: Number, required: true, min: -180, max: 180 },

        altitudeM: { type: Number, default: null },
        accuracyM: { type: Number, default: null, min: 0 },
        speedMps: { type: Number, default: null, min: 0 },
        headingDeg: { type: Number, default: null, min: 0, max: 360 },

        recordedAt: { type: String, default: null },
    },
    { _id: false }
);

const WorkoutSessionMetaSchema = new Schema(
    {
        source: {
            type: String,
            default: null,
            enum: ["manual", "healthkit", "health-connect", "app-live"],
        },
        sourceDevice: { type: String, default: null, trim: true, maxlength: 200 },
        importedAt: { type: String, default: null },
        lastSyncedAt: { type: String, default: null },
        sessionKind: {
            type: String,
            default: null,
            enum: ["device-import", "gym-check", "manual-cardio", "live-cardio"],
        },

        /**
         * Helpful metadata fields used by health/cardio/manual flows.
         * These are explicitly declared so the stored shape stays consistent
         * even though the sub-schema remains flexible.
         */
        externalId: { type: String, default: null, trim: true, maxlength: 200 },

        /**
         * OS health write metadata used after an app-created live workout is
         * persisted locally and then written to Apple Health / Health Connect.
         */
        healthWriteStatus: {
            type: String,
            default: null,
            enum: ["pending", "synced", "failed", null],
        },
        healthExternalId: { type: String, default: null, trim: true, maxlength: 200 },
        healthWrittenAt: { type: String, default: null },

        originalType: { type: String, default: null, trim: true, maxlength: 200 },
        provider: { type: String, default: null, trim: true, maxlength: 120 },
        sessionKey: { type: String, default: null, trim: true, maxlength: 120 },
        trainingSource: { type: String, default: null, trim: true, maxlength: 120 },
        dayEffortRpe: { type: Number, default: null, min: 0, max: 10 },
    },
    { _id: false, strict: false }
);

const WorkoutSessionSchema = new Schema(
    {
        type: { type: String, required: true, trim: true, maxlength: 120 },

        activityType: {
            type: String,
            default: null,
            enum: ["walking", "running", null],
        },

        cardioEnvironment: {
            type: String,
            default: null,
            enum: ["outdoor", "indoor", null],
        },

        startAt: { type: String, default: null },
        endAt: { type: String, default: null },

        durationSeconds: { type: Number, default: null, min: 0 },

        activeKcal: { type: Number, default: null, min: 0 },
        totalKcal: { type: Number, default: null, min: 0 },

        avgHr: { type: Number, default: null, min: 0, max: 300 },
        maxHr: { type: Number, default: null, min: 0, max: 300 },

        distanceKm: { type: Number, default: null, min: 0 },
        steps: { type: Number, default: null, min: 0 },
        elevationGainM: { type: Number, default: null, min: 0 },

        paceSecPerKm: { type: Number, default: null, min: 0 },
        cadenceRpm: { type: Number, default: null, min: 0 },

        hasRoute: { type: Boolean, default: false },
        cardioMetrics: { type: WorkoutCardioMetricsSchema, default: null },
        routeSummary: { type: WorkoutRouteSummarySchema, default: null },
        routePoints: { type: [WorkoutRoutePointSchema], default: null },

        effortRpe: { type: Number, default: null, min: 0, max: 10 },
        notes: { type: String, default: null, maxlength: 5000 },

        media: { type: [WorkoutMediaItemSchema], default: null },
        exercises: { type: [WorkoutExerciseSchema], default: null },

        meta: { type: WorkoutSessionMetaSchema, default: null },
    },
    { _id: true }
);

const TrainingBlockSchema = new Schema(
    {
        sessions: { type: [WorkoutSessionSchema], default: null },

        source: { type: String, default: null, maxlength: 120 },
        dayEffortRpe: { type: Number, default: null, min: 0, max: 10 },

        raw: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const SleepBlockSchema = new Schema(
    {
        timeAsleepMinutes: { type: Number, default: null, min: 0 },
        timeInBedMinutes: { type: Number, default: null, min: 0 },
        score: { type: Number, default: null, min: 0, max: 100 },

        awakeMinutes: { type: Number, default: null, min: 0 },
        remMinutes: { type: Number, default: null, min: 0 },
        coreMinutes: { type: Number, default: null, min: 0 },
        deepMinutes: { type: Number, default: null, min: 0 },

        source: { type: String, default: null, maxlength: 120 },
        sourceDevice: { type: String, default: null, trim: true, maxlength: 200 },
        importedAt: { type: String, default: null },
        lastSyncedAt: { type: String, default: null },

        raw: { type: Schema.Types.Mixed, default: null },
    },
    { _id: false }
);

const PlannedRoutineExerciseSchema = new Schema(
    {
        id: { type: String, required: true, trim: true, maxlength: 80 },

        name: { type: String, required: true, trim: true, maxlength: 200 },

        movementId: { type: String, default: null, trim: true, maxlength: 80 },
        movementName: { type: String, default: null, trim: true, maxlength: 200 },

        sets: { type: Number, default: null, min: 0, max: 99 },
        reps: { type: String, default: null, maxlength: 50 },
        rpe: { type: Number, default: null, min: 0, max: 10 },

        load: { type: String, default: null, maxlength: 100 },
        notes: { type: String, default: null, maxlength: 1000 },

        attachmentPublicIds: { type: [String], default: null },
    },
    { _id: false }
);

const PlannedRoutineSchema = new Schema(
    {
        sessionType: { type: String, default: null, maxlength: 200 },
        focus: { type: String, default: null, maxlength: 500 },
        exercises: { type: [PlannedRoutineExerciseSchema], default: null },

        notes: { type: String, default: null, maxlength: 5000 },
        tags: { type: [String], default: null },
    },
    { _id: false }
);

const PlannedMetaSchema = new Schema(
    {
        plannedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        plannedAt: { type: String, required: true },
        source: { type: String, enum: ["trainer", "template"], default: null },
    },
    { _id: false }
);

function toIsoString(value: unknown): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (typeof value === "string") {
        return new Date(value).toISOString();
    }

    return undefined;
}

function mapExerciseForJson(exercise: JsonWorkoutExercise): JsonObject {
    const { _id, ...exerciseRest } = exercise;

    return {
        id: _id !== undefined ? String(_id) : "",
        ...exerciseRest,
    };
}

function mapSessionForJson(session: JsonWorkoutSession): JsonObject {
    const { _id, exercises, ...sessionRest } = session;

    const mappedExercises = Array.isArray(exercises)
        ? exercises.map((exercise) => mapExerciseForJson(exercise as JsonWorkoutExercise))
        : exercises ?? null;

    return {
        id: _id !== undefined ? String(_id) : "",
        ...sessionRest,
        exercises: mappedExercises,
    };
}

const WorkoutDaySchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        date: { type: String, required: true, index: true },
        weekKey: { type: String, required: true, index: true },

        sleep: { type: SleepBlockSchema, default: null },
        training: { type: TrainingBlockSchema, default: null },

        plannedRoutine: {
            type: PlannedRoutineSchema,
            default: null,
            validate: {
                validator(this: PlannedRoutineValidatorContext) {
                    const hasActualTraining =
                        this.training !== null &&
                        this.training !== undefined &&
                        (Array.isArray(this.training.sessions)
                            ? this.training.sessions.length > 0
                            : true);

                    if (!hasActualTraining) {
                        return true;
                    }

                    if (!this.isNew && this.isModified("plannedRoutine")) {
                        return false;
                    }

                    return true;
                },
                message:
                    "plannedRoutine cannot be overwritten when actual training exists for this day.",
            },
        },

        plannedMeta: { type: PlannedMetaSchema, default: null },

        notes: { type: String, default: null, maxlength: 10000 },
        tags: { type: [String], default: null },

        meta: { type: Schema.Types.Mixed, default: null },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc: unknown, ret: JsonTransformRet) => {
                const { _id, __v, ...rest } = ret;

                const mappedTraining =
                    rest.training !== null && rest.training !== undefined
                        ? {
                            ...rest.training,
                            sessions: Array.isArray(rest.training.sessions)
                                ? rest.training.sessions.map((session) =>
                                    mapSessionForJson(session as JsonWorkoutSession)
                                )
                                : rest.training.sessions ?? null,
                        }
                        : rest.training ?? null;

                const mappedPlannedMeta =
                    rest.plannedMeta !== null && rest.plannedMeta !== undefined
                        ? {
                            ...rest.plannedMeta,
                            plannedBy:
                                rest.plannedMeta.plannedBy !== undefined
                                    ? String(rest.plannedMeta.plannedBy)
                                    : rest.plannedMeta.plannedBy,
                        }
                        : rest.plannedMeta ?? null;

                return {
                    id: _id !== undefined ? String(_id) : "",
                    ...rest,
                    userId: rest.userId !== undefined ? String(rest.userId) : rest.userId,
                    training: mappedTraining,
                    plannedMeta: mappedPlannedMeta,
                    createdAt: toIsoString(rest.createdAt),
                    updatedAt: toIsoString(rest.updatedAt),
                };
            },
        },
    }
);

WorkoutDaySchema.index({ userId: 1, date: 1 }, { unique: true });

export type WorkoutDayDocument = InferSchemaType<typeof WorkoutDaySchema> & {
    id: string;
};

export const WorkoutDayModel: Model<WorkoutDayDocument> =
    mongoose.models.WorkoutDay ||
    mongoose.model<WorkoutDayDocument>("WorkoutDay", WorkoutDaySchema);