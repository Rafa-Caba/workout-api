import { UserSettingsModel } from "../models/UserSettings.model";
import type { PatchMySettingsInput } from "../validations/settings.schemas";

type SettingsLean = {
    userId: string;

    language: "es" | "en" | null;
    weekStartsOn: 0 | 1;

    debug: { showJson: boolean };
    defaults: { defaultRpe: number | null };

    createdAt?: any;
    updatedAt?: any;
};

function normalizeSettings(doc: any): SettingsLean {
    return {
        userId: String(doc.userId),

        language: (doc.language ?? null) as "es" | "en" | null,
        weekStartsOn: (doc.weekStartsOn ?? 1) as 0 | 1,

        debug: {
            showJson: Boolean(doc.debug?.showJson ?? false),
        },

        defaults: {
            defaultRpe: doc.defaults?.defaultRpe ?? null,
        },
    };
}

export async function getMySettings(userId: string): Promise<SettingsLean> {
    const found = await UserSettingsModel.findOne({ userId }).lean();
    if (found) return normalizeSettings(found);

    // Create defaults on first read (nice UX)
    const created = await UserSettingsModel.create({ userId });
    return normalizeSettings(created.toObject());
}

export async function patchMySettings(userId: string, patch: PatchMySettingsInput): Promise<SettingsLean> {
    const current = await getMySettings(userId);

    const next: Partial<SettingsLean> = {
        language: patch.language !== undefined ? patch.language : current.language,
        weekStartsOn: patch.weekStartsOn !== undefined ? patch.weekStartsOn : current.weekStartsOn,

        debug: {
            showJson:
                patch.debug?.showJson !== undefined ? patch.debug.showJson : current.debug.showJson,
        },

        defaults: {
            defaultRpe:
                patch.defaults?.defaultRpe !== undefined ? patch.defaults.defaultRpe : current.defaults.defaultRpe,
        },
    };

    const updated = await UserSettingsModel.findOneAndUpdate(
        { userId },
        { $set: next },
        { new: true, upsert: true }
    ).lean();

    return normalizeSettings(updated ?? { ...current, ...next });
}
