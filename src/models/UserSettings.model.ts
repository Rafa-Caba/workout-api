import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const DebugSchema = new Schema(
    {
        showJson: { type: Boolean, default: false },
    },
    { _id: false }
);

const DefaultsSchema = new Schema(
    {
        defaultRpe: { type: Number, default: null, min: 1, max: 10 },
    },
    { _id: false }
);

const UserSettingsSchema = new Schema(
    {
        userId: { type: String, required: true, index: true, unique: true },

        language: { type: String, enum: ["es", "en"], default: null },
        weekStartsOn: { type: Number, enum: [0, 1], default: 1 },

        debug: { type: DebugSchema, default: () => ({}) },
        defaults: { type: DefaultsSchema, default: () => ({}) },
    },
    { timestamps: true }
);

export type UserSettingsDoc = InferSchemaType<typeof UserSettingsSchema>;
export const UserSettingsModel: Model<UserSettingsDoc> =
    mongoose.models.UserSettings || mongoose.model("UserSettings", UserSettingsSchema);
