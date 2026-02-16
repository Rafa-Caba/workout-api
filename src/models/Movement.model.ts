import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { toPublicJson } from "../utils/toPublicJson";

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

const MovementSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        name: { type: String, required: true, trim: true, maxlength: 120 },
        nameLower: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },

        muscleGroup: { type: String, default: null, trim: true, maxlength: 80 },
        equipment: { type: String, default: null, trim: true, maxlength: 80 },

        isActive: { type: Boolean, default: true, index: true },

        // ✅ for MovementsPage catalog (illustration/media)
        media: { type: MovementMediaSchema, default: null },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: any) => toPublicJson(ret, []),
        },
    }
);

MovementSchema.pre("validate", function () {
    const self = this as any;
    self.nameLower = String(self.name ?? "").trim().toLowerCase();
});

// ✅ Per-user unique movement name (case-insensitive via nameLower)
MovementSchema.index({ userId: 1, nameLower: 1 }, { unique: true });

// (Optional but useful) filter + sorting speed
MovementSchema.index({ userId: 1, isActive: 1, nameLower: 1 });

export type MovementDocument = InferSchemaType<typeof MovementSchema> & { id: string };

export const MovementModel: Model<MovementDocument> =
    mongoose.models.Movement || mongoose.model<MovementDocument>("Movement", MovementSchema);
