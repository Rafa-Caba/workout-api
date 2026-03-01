import type { Request, Response } from "express";
import { AppSettingsModel } from "../models/AppSettings.model";
import { asyncHandler } from "../utils/asyncHandler";

/**
 * GET /api/app-settings
 * Public read-only endpoint for branding + global theme defaults + debug flags.
 */
export const getPublicAppSettings = asyncHandler(
    async (_req: Request, res: Response) => {
        // If you truly never want auto-create here, keep it as findOne().
        // If missing, we fall back to safe defaults.
        const doc = await AppSettingsModel.findOne();

        if (!doc) {
            return res.json({
                appName: "Workout Tracker",
                appSubtitle: "Seguimiento de entrenamiento y sueño",
                logoUrl: null,
                themeDefaults: { mode: "system", palette: "blue" },
                debug: { showJson: false },
            });
        }

        const json = doc.toJSON();

        return res.json({
            appName: json.appName,
            appSubtitle: json.appSubtitle,
            logoUrl: json.appLogoUrl ?? null,
            themeDefaults: {
                mode: json.themeDefaults?.mode ?? "system",
                palette: json.themeDefaults?.palette ?? "blue",
            },
            debug: {
                showJson: Boolean(json.debug?.showJson),
            },
        });
    }
);
