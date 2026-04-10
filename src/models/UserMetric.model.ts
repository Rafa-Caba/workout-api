// src/models/UserMetric.model.ts
import mongoose, {
    Schema,
    Types,
    type HydratedDocument,
    type InferSchemaType,
    type Model,
} from "mongoose";

const UserMetricCustomMetricSchema = new Schema(
    {
        key: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        label: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        value: {
            type: Number,
            required: true,
        },
        unit: {
            type: String,
            required: true,
            trim: true,
            maxlength: 20,
        },
    },
    { _id: false }
);

type UserMetricTransformShape = {
    _id: Types.ObjectId;
    __v?: number;
    userId?: Types.ObjectId | string | null;
    [key: string]: unknown;
};

const UserMetricSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        date: {
            type: String,
            required: true,
            index: true,
        }, // YYYY-MM-DD

        // Core body metrics
        weightKg: { type: Number, default: null, min: 0, max: 500 },
        bodyFatPct: { type: Number, default: null, min: 0, max: 100 },
        waistCm: { type: Number, default: null, min: 0, max: 300 },

        // Extensible custom metrics (multiple per day)
        customMetrics: {
            type: [UserMetricCustomMetricSchema],
            default: [],
        },

        notes: {
            type: String,
            default: null,
            maxlength: 5000,
        },

        source: {
            type: String,
            enum: ["manual", "profile", "device", "import", "coach"],
            default: "manual",
            index: true,
        },

        sourceDevice: {
            type: String,
            default: null,
            maxlength: 120,
        },

        importedAt: {
            type: Date,
            default: null,
        },

        createdFromProfile: {
            type: Boolean,
            default: false,
        },

        meta: {
            type: Schema.Types.Mixed,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: UserMetricTransformShape) => {
                const { _id, __v, userId, ...rest } = ret;

                return {
                    id: String(_id),
                    userId: userId ? String(userId) : null,
                    ...rest,
                };
            },
        },
    }
);

// One body-metrics entry per user per day
UserMetricSchema.index({ userId: 1, date: 1 }, { unique: true });

type UserMetricBase = InferSchemaType<typeof UserMetricSchema>;

export type UserMetricDocument = HydratedDocument<UserMetricBase> & {
    id: string;
};

export type UserMetricJSON = ReturnType<UserMetricDocument["toJSON"]>;

export const UserMetricModel: Model<UserMetricDocument> =
    mongoose.models.UserMetric ||
    mongoose.model<UserMetricDocument>("UserMetric", UserMetricSchema);