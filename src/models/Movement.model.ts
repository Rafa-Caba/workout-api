// /src/models/Movement.model.ts

import mongoose, {
    Schema,
    type HydratedDocument,
    type InferSchemaType,
    type Model,
} from "mongoose";
import { toPublicJson } from "../utils/toPublicJson";

/**
 * Catalog media attached to a movement for illustration or demo purposes.
 */
const MovementMediaSchema = new Schema(
    {
        publicId: { type: String, required: true, trim: true, maxlength: 300 },
        url: { type: String, required: true, trim: true, maxlength: 2000 },
        resourceType: { type: String, required: true, enum: ["image", "video"] },
        format: { type: String, default: null, maxlength: 30 },
        createdAt: { type: String, required: true }, // ISO datetime string
        meta: { type: Schema.Types.Mixed, default: null },
        originalName: { type: String, default: null, trim: true, maxlength: 300 },
    },
    { _id: false }
);

/**
 * Normalizes a raw unknown input into a clean unique string array.
 */
function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const normalizedValues = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return Array.from(new Set(normalizedValues));
}

const MovementSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        nameLower: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 120,
            index: true,
        },

        // Multi-select catalog fields
        muscleGroup: {
            type: [String],
            default: [],
        },
        equipment: {
            type: [String],
            default: [],
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        // For MovementsPage catalog (illustration/media)
        media: {
            type: MovementMediaSchema,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc: unknown, ret: Record<string, unknown>) => toPublicJson(ret, []),
        },
    }
);

type MovementHydratedDocument = HydratedDocument<InferSchemaType<typeof MovementSchema>>;

/**
 * Keeps derived and array fields normalized before validation/persistence.
 */
MovementSchema.pre("validate", function () {
    const self = this as MovementHydratedDocument;

    self.nameLower = String(self.name ?? "").trim().toLowerCase();
    self.muscleGroup = normalizeStringArray(self.muscleGroup);
    self.equipment = normalizeStringArray(self.equipment);
});

// Per-user unique movement name (case-insensitive via nameLower)
MovementSchema.index({ userId: 1, nameLower: 1 }, { unique: true });

// Useful for filtering and sorting
MovementSchema.index({ userId: 1, isActive: 1, nameLower: 1 });

export type MovementDocument = InferSchemaType<typeof MovementSchema> & {
    id: string;
};

export const MovementModel: Model<MovementDocument> =
    mongoose.models.Movement ||
    mongoose.model<MovementDocument>("Movement", MovementSchema);