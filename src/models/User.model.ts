import mongoose, {
    Schema,
    type InferSchemaType,
    type Model,
    type HydratedDocument,
} from "mongoose";
import { toPublicJson } from "../utils/toPublicJson";

const UnitsSchema = new Schema(
    {
        weight: { type: String, enum: ["kg", "lb"], default: "kg" },
        distance: { type: String, enum: ["km", "mi"], default: "km" },
    },
    { _id: false }
);

const UserSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true,
            index: true,
            maxlength: 254,
        },

        passwordHash: { type: String, required: true },

        sex: {
            type: String,
            enum: ["male", "female", "other"],
            default: null,
        },

        role: {
            type: String,
            enum: ["admin", "user"],
            default: "user",
            index: true,
        },

        isActive: { type: Boolean, default: true, index: true },

        profilePicUrl: { type: String, default: null },
        profilePicPublicId: { type: String, default: null },

        // Fitness profile (DB stores weight in KG always)
        heightCm: { type: Number, default: null, min: 0, max: 300 },
        currentWeightKg: { type: Number, default: null, min: 0, max: 500 },

        units: { type: UnitsSchema, default: null },

        birthDate: { type: String, default: null }, // YYYY-MM-DD
        activityGoal: {
            type: String,
            enum: ["fat_loss", "hypertrophy", "strength", "maintenance", "other"],
            default: null,
        },
        timezone: { type: String, default: null },

        lastLoginAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: any) =>
                toPublicJson(ret, ["passwordHash", "profilePicPublicId"]),
        },
    }
);

// Tipo base del documento (solo los campos)
type UserBase = InferSchemaType<typeof UserSchema>;

// Documento hidratado de Mongoose (incluye toJSON, save, etc.)
export type UserDocument = HydratedDocument<UserBase>;

export const UserModel: Model<UserBase> =
    mongoose.models.User || mongoose.model<UserBase>("User", UserSchema);
