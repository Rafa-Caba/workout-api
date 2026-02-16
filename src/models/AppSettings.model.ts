import mongoose, {
    Schema,
    type InferSchemaType,
    type Model,
    type HydratedDocument,
} from "mongoose";
import { toPublicJson } from "../utils/toPublicJson";

const DebugSchema = new Schema(
    {
        showJson: { type: Boolean, default: false },
    },
    { _id: false }
);

const ThemeDefaultsSchema = new Schema(
    {
        mode: {
            type: String,
            enum: ["light", "dark", "system"],
            default: "system",
        },
        palette: {
            type: String,
            enum: ["blue", "emerald", "violet", "red", "mint"],
            default: "blue",
        },
    },
    { _id: false }
);

const AppSettingsSchema = new Schema(
    {
        appName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
            default: "Workout Tracker",
        },
        appSubtitle: {
            type: String,
            trim: true,
            maxlength: 200,
            default: null,
        },

        appLogoUrl: { type: String, default: null },
        appLogoPublicId: { type: String, default: null },

        debug: { type: DebugSchema, default: () => ({}) },

        themeDefaults: { type: ThemeDefaultsSchema, default: () => ({}) },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: any) =>
                // No necesitamos ocultar nada, pero usamos la misma utilidad para
                // mantener el "id" en lugar de "_id" y quitar __v.
                toPublicJson(ret, []),
        },
    }
);

// Tipo base
type AppSettingsBase = InferSchemaType<typeof AppSettingsSchema>;

// Documento hidratado (incluye toJSON, save, etc.)
export type AppSettingsDocument = HydratedDocument<AppSettingsBase>;

export const AppSettingsModel: Model<AppSettingsBase> =
    mongoose.models.AppSettings ||
    mongoose.model<AppSettingsBase>("AppSettings", AppSettingsSchema);
