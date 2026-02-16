import type { Request, Response } from "express";
import { AppSettingsModel } from "../models/AppSettings.model";
import type { UpdateAdminSettingsInput } from "../validations/adminSettings.schemas";

/**
 * Helper: always return a settings doc (create with defaults if missing)
 */
async function getOrCreateSettingsDoc() {
    let doc = await AppSettingsModel.findOne();
    if (!doc) {
        doc = await AppSettingsModel.create({
            appName: "Workout Tracker",
            appSubtitle: null,
            debug: {
                showJson: false,
            },
            themeDefaults: {
                mode: "system",
                palette: "blue",
            },
        });
    }
    return doc;
}

/**
 * GET /api/admin/settings
 */
export async function getAdminSettings(_req: Request, res: Response) {
    const doc = await getOrCreateSettingsDoc();
    return res.json(doc.toJSON());
}

/**
 * PATCH /api/admin/settings
 */
export async function updateAdminSettings(req: Request, res: Response) {
    const body = req.body as UpdateAdminSettingsInput;

    const doc = await getOrCreateSettingsDoc();

    if (typeof body.appName === "string") {
        doc.appName = body.appName.trim();
    }

    if ("appSubtitle" in body) {
        doc.appSubtitle =
            body.appSubtitle === null ? null : String(body.appSubtitle).trim();
    }

    if (body.debug) {
        const currentDebug = (doc.debug ?? {}) as any;
        doc.debug = {
            ...currentDebug,
            ...body.debug,
        };
    }

    if (body.themeDefaults) {
        const currentThemeDefaults = (doc.themeDefaults ?? {}) as any;
        doc.themeDefaults = {
            ...currentThemeDefaults,
            ...body.themeDefaults,
        };
    }

    await doc.save();
    return res.json(doc.toJSON());
}

/**
 * POST /api/admin/settings/logo
 * field: "image"
 */
export async function uploadLogo(req: Request, res: Response) {
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
        return res.status(400).json({
            error: {
                code: "VALIDATION_ERROR",
                message: "Missing image file",
            },
        });
    }

    const doc = await getOrCreateSettingsDoc();

    const url = (file as any).path ?? null;
    const publicId = (file as any).filename ?? null;

    if (!url || !publicId) {
        return res.status(500).json({
            error: {
                code: "INTERNAL_ERROR",
                message: "Upload succeeded but logo metadata is missing",
            },
        });
    }

    doc.appLogoUrl = url;
    doc.appLogoPublicId = publicId;

    await doc.save();
    return res.json(doc.toJSON());
}

/**
 * DELETE /api/admin/settings/logo
 */
export async function deleteLogo(_req: Request, res: Response) {
    const doc = await getOrCreateSettingsDoc();

    doc.appLogoUrl = null;
    doc.appLogoPublicId = null;

    await doc.save();
    return res.json(doc.toJSON());
}
