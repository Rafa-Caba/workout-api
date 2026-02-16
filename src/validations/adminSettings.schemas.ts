import { z } from "zod";

export const updateAdminSettingsSchema = z.object({
    appName: z
        .string()
        .min(1, "appName is required")
        .max(120)
        .optional(),
    appSubtitle: z
        .string()
        .max(200)
        .nullable()
        .optional(),

    debug: z
        .object({
            showJson: z.boolean().optional(),
        })
        .optional(),

    themeDefaults: z
        .object({
            mode: z.enum(["light", "dark", "system"]).optional(),
            palette: z.enum(["blue", "emerald", "violet", "red", "mint"]).optional(),
        })
        .optional(),
});

export type UpdateAdminSettingsInput = z.infer<typeof updateAdminSettingsSchema>;
