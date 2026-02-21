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

        /**
         * Trainer/Trainee coaching relationship (minimal changes).
         * - coachMode: NONE | TRAINER | TRAINEE
         * - assignedTrainer: required when TRAINEE, otherwise must be null
         *
         * NOTE: We enforce cross-field consistency using schema validators
         * (no schema.pre hooks) to avoid TS overload issues in some mongoose setups.
         */
        coachMode: {
            type: String,
            enum: ["NONE", "TRAINER", "TRAINEE"],
            default: "NONE",
            index: true,
            validate: {
                // Cross-field rule enforced at schema level.
                validator: function (this: any, v: "NONE" | "TRAINER" | "TRAINEE") {
                    const assignedTrainer = this.assignedTrainer ?? null;
                    if (v === "TRAINEE") return !!assignedTrainer;
                    return assignedTrainer === null;
                },
                message:
                    'Invalid coaching state: assignedTrainer is required when coachMode is "TRAINEE", otherwise it must be null.',
            },
        },

        assignedTrainer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true, // fast trainee lookup by trainer
            validate: {
                // Mirror validation for clearer field-level errors.
                validator: function (this: any, v: unknown) {
                    const coachMode: "NONE" | "TRAINER" | "TRAINEE" =
                        this.coachMode ?? "NONE";
                    if (coachMode === "TRAINEE") return !!v;
                    return v === null;
                },
                message:
                    'Invalid assignedTrainer: required when coachMode is "TRAINEE", otherwise must be null.',
            },
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: any) =>
                toPublicJson(ret, ["passwordHash", "profilePicPublicId"]),
        },
    }
);

// Base de campos del schema
type UserBase = InferSchemaType<typeof UserSchema>;

// Documento hidratado de Mongoose, con `id` y `toJSON`
export type UserDocument = HydratedDocument<UserBase> & {
    id: string;
};

// Tipo JSON público (lo que sale de `toJSON`)
export type UserJSON = ReturnType<UserDocument["toJSON"]>;

// Modelo
export const UserModel: Model<UserDocument> =
    mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);