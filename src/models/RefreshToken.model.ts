import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const RefreshTokenSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

        tokenHash: { type: String, required: true, unique: true, index: true },

        createdAt: { type: Date, required: true, default: () => new Date() },
        expiresAt: { type: Date, required: true },

        revokedAt: { type: Date, default: null },

        replacedByTokenHash: { type: String, default: null },

        userAgent: { type: String, default: null },
        ip: { type: String, default: null },
    },
    {
        toJSON: {
            transform: (_doc, ret: any) => {
                const { _id, __v, tokenHash, replacedByTokenHash, ...rest } = ret;
                return { id: String(_id), ...rest };
            },
        },
    }
);

// Helpful indexes
RefreshTokenSchema.index({ userId: 1, expiresAt: 1 });

// TTL: auto-delete expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDocument = InferSchemaType<typeof RefreshTokenSchema> & {
    id: string;
};

export const RefreshTokenModel: Model<RefreshTokenDocument> =
    mongoose.models.RefreshToken ||
    mongoose.model<RefreshTokenDocument>("RefreshToken", RefreshTokenSchema);
