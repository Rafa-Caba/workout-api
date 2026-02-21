import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

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

        createdAt: { type: String, required: true }, // ISO datetime string

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

        // Future-proofing: optional link to a canonical movement registry later
        movementId: { type: String, default: null, trim: true, maxlength: 120 },

        notes: { type: String, default: null, maxlength: 5000 },

        // IMPORTANT:
        // - default null keeps “no block” semantics
        // - [] means explicitly set to empty list
        sets: { type: [WorkoutExerciseSetSchema], default: null },

        meta: { type: Schema.Types.Mixed, default: null },
    },
    { _id: true }
);

const WorkoutSessionSchema = new Schema(
    {
        type: { type: String, required: true, trim: true, maxlength: 120 },

        startAt: { type: String, default: null }, // ISO datetime string
        endAt: { type: String, default: null }, // ISO datetime string

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

        effortRpe: { type: Number, default: null, min: 1, max: 10 },
        notes: { type: String, default: null, maxlength: 5000 },

        /**
         * Media attached to THIS session
         * - default null keeps previous "no block" semantics
         */
        media: { type: [WorkoutMediaItemSchema], default: null },

        /**
         * Exercises performed in THIS session (NEW)
         * - default null keeps previous "no block" semantics
         * - [] means explicitly set to empty list
         */
        exercises: { type: [WorkoutExerciseSchema], default: null },

        meta: { type: Schema.Types.Mixed, default: null },
    },
    { _id: true }
);

const TrainingBlockSchema = new Schema(
    {
        sessions: { type: [WorkoutSessionSchema], default: null },

        source: { type: String, default: null, maxlength: 120 },
        dayEffortRpe: { type: Number, default: null, min: 1, max: 10 },

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

/**
 * Planned routine (trainer-owned / template-owned) - mirrors routine-day shape.
 */
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
        plannedAt: { type: String, required: true }, // ISO datetime string
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

        date: { type: String, required: true, index: true }, // YYYY-MM-DD
        weekKey: { type: String, required: true, index: true }, // e.g. 2026-W03

        sleep: { type: SleepBlockSchema, default: null },

        /**
         * Actual training (trainee-owned). Kept as-is (existing field).
         */
        training: { type: TrainingBlockSchema, default: null },

        /**
         * Planned routine (trainer-owned / template-owned).
         */
        plannedRoutine: {
            type: PlannedRoutineSchema,
            default: null,
            validate: {
                // MVP locking rule:
                // If actual training exists for that day, block overwrite of plannedRoutine
                // (allow on new doc creation; block on modifications to plannedRoutine).
                validator: function (this: any, _v: unknown) {
                    const hasActualTraining =
                        !!this.training &&
                        (Array.isArray(this.training.sessions)
                            ? this.training.sessions.length > 0
                            : true);

                    if (!hasActualTraining) return true;

                    // If actual training exists, do not allow changing plannedRoutine
                    // once the document already exists.
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

                // Map session _id -> id
                if (rest.training?.sessions?.length) {
                    rest.training.sessions = rest.training.sessions.map((s: any) => {
                        const { _id: sId, ...sRest } = s;

                        // Map exercise _id -> id (inside session)
                        if (sRest.exercises?.length) {
                            sRest.exercises = sRest.exercises.map((ex: any) => {
                                const { _id: exId, ...exRest } = ex;
                                return { id: String(exId), ...exRest };
                            });
                        }

                        return { id: String(sId), ...sRest };
                    });
                }

                return { id: String(_id), ...rest };
            },
        },
    }
);

// Unique constraint: one day per user per date
WorkoutDaySchema.index({ userId: 1, date: 1 }, { unique: true });

export type WorkoutDayDocument = InferSchemaType<typeof WorkoutDaySchema> & {
    id: string;
};

export const WorkoutDayModel: Model<WorkoutDayDocument> =
    mongoose.models.WorkoutDay ||
    mongoose.model<WorkoutDayDocument>("WorkoutDay", WorkoutDaySchema);