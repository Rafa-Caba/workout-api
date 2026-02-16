import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const RoutineExerciseSchema = new Schema(
    {
        id: { type: String, required: true, trim: true },

        name: { type: String, required: true, trim: true, maxlength: 200 },

        // Movement catalog link + snapshot (Option A)
        movementId: { type: String, default: null, trim: true, maxlength: 80 },
        movementName: { type: String, default: null, trim: true, maxlength: 200 },

        sets: { type: Number, default: null, min: 0, max: 99 },
        reps: { type: String, default: null, maxlength: 50 },
        rpe: { type: Number, default: null, min: 0, max: 10 },

        // Canonical planned fields (match Zod)
        load: { type: String, default: null, maxlength: 100 },
        notes: { type: String, default: null, maxlength: 1000 },

        // Link to routine-level attachments
        attachmentPublicIds: { type: [String], default: null },
    },
    { _id: false }
);

const RoutineDaySchema = new Schema(
    {
        date: { type: String, required: true, index: true }, // YYYY-MM-DD
        dayKey: {
            type: String,
            required: true,
            enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },

        sessionType: { type: String, default: null, maxlength: 200 },
        focus: { type: String, default: null, maxlength: 500 },
        exercises: { type: [RoutineExerciseSchema], default: null },

        notes: { type: String, default: null, maxlength: 5000 },
        tags: { type: [String], default: null },
    },
    { _id: false }
);

const RoutineAttachmentSchema = new Schema(
    {
        publicId: { type: String, required: true, trim: true, maxlength: 300 },
        url: { type: String, required: true, trim: true, maxlength: 2000 },
        resourceType: { type: String, required: true, enum: ["image", "video"] },
        format: { type: String, default: null, maxlength: 30 },
        createdAt: { type: String, required: true }, // ISO datetime string
        meta: { type: Schema.Types.Mixed, default: null },

        // Optional but useful for FE labels
        originalName: { type: String, default: null, trim: true, maxlength: 300 },
    },
    { _id: false }
);

const WorkoutRoutineWeekSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        weekKey: { type: String, required: true, index: true }, // YYYY-W##
        range: {
            from: { type: String, required: true },
            to: { type: String, required: true },
        },

        status: { type: String, required: true, enum: ["active", "archived"], default: "active" },

        title: { type: String, default: null, maxlength: 200 },
        split: { type: String, default: null, maxlength: 200 },
        plannedDays: {
            type: [String],
            default: null,
            enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        },

        attachments: { type: [RoutineAttachmentSchema], default: [] },

        // CANONICAL
        days: { type: [RoutineDaySchema], required: true },

        // UI helper only
        meta: { type: Schema.Types.Mixed, default: null },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: any) => {
                const { _id, __v, ...rest } = ret;
                return { id: String(_id), ...rest };
            },
        },
    }
);

// One routine template per user per week
WorkoutRoutineWeekSchema.index({ userId: 1, weekKey: 1 }, { unique: true });

export type WorkoutRoutineWeekDocument = InferSchemaType<typeof WorkoutRoutineWeekSchema> & { id: string };

export const WorkoutRoutineWeekModel: Model<WorkoutRoutineWeekDocument> =
    mongoose.models.WorkoutRoutineWeek ||
    mongoose.model<WorkoutRoutineWeekDocument>("WorkoutRoutineWeek", WorkoutRoutineWeekSchema);
