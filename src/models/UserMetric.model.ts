import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserMetricSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        date: { type: String, required: true, index: true }, // YYYY-MM-DD

        // Core metrics (weight always stored in KG internally)
        weightKg: { type: Number, default: null, min: 0, max: 500 },

        // Optional future fields
        bodyFatPct: { type: Number, default: null, min: 0, max: 100 },
        waistCm: { type: Number, default: null, min: 0, max: 300 },

        // Custom extensibility
        customType: { type: String, default: null, maxlength: 80 },
        customValue: { type: Number, default: null },
        customUnit: { type: String, default: null, maxlength: 20 },

        notes: { type: String, default: null, maxlength: 5000 },
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

// Unique constraint: one metric entry per user per date
UserMetricSchema.index({ userId: 1, date: 1 }, { unique: true });

export type UserMetricDocument = InferSchemaType<typeof UserMetricSchema> & {
    id: string;
};

export const UserMetricModel: Model<UserMetricDocument> =
    mongoose.models.UserMetric || mongoose.model<UserMetricDocument>("UserMetric", UserMetricSchema);
