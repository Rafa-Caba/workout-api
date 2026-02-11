import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { toPublicJson } from "../utils/toPublicJson";

const MovementSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        name: { type: String, required: true, trim: true, maxlength: 120 },
        nameLower: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },

        muscleGroup: { type: String, default: null, trim: true, maxlength: 80 },
        equipment: { type: String, default: null, trim: true, maxlength: 80 },

        isActive: { type: Boolean, default: true, index: true },
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

MovementSchema.index({ userId: 1, nameLower: 1 }, { unique: true });

export type MovementDocument = InferSchemaType<typeof MovementSchema> & { id: string };

export const MovementModel: Model<MovementDocument> =
    mongoose.models.Movement || mongoose.model<MovementDocument>("Movement", MovementSchema);
