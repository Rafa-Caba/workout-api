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

const WorkoutSessionSchema = new Schema(
    {
        type: { type: String, required: true, trim: true, maxlength: 120 },

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

        effortRpe: { type: Number, default: null, min: 0, max: 10 },
        notes: { type: String, default: null, maxlength: 5000 },

        media: { type: [WorkoutMediaItemSchema], default: null },
        exercises: { type: [WorkoutExerciseSchema], default: null },

        meta: { type: Schema.Types.Mixed, default: null },
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
                validator: function (this: PlannedRoutineValidatorContext) {
                    const hasActualTraining =
                        !!this.training &&
                        (Array.isArray(this.training.sessions)
                            ? this.training.sessions.length > 0
                            : true);

                    if (!hasActualTraining) return true;

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
            transform: (_doc, ret: any) => {
                const { _id, __v, ...rest } = ret;

                if (Array.isArray(rest.training?.sessions)) {
                    rest.training.sessions = rest.training.sessions.map((session: any) => {
                        const { _id: sessionId, ...sessionRest } = session;

                        if (Array.isArray(sessionRest.exercises)) {
                            sessionRest.exercises = sessionRest.exercises.map((exercise: any) => {
                                const { _id: exerciseId, ...exerciseRest } = exercise;
                                return {
                                    id: String(exerciseId),
                                    ...exerciseRest,
                                };
                            });
                        }

                        return {
                            id: String(sessionId),
                            ...sessionRest,
                        };
                    });
                }

                return {
                    id: String(_id),
                    ...rest,
                    createdAt: new Date(rest.createdAt).toISOString(),
                    updatedAt: new Date(rest.updatedAt).toISOString(),
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