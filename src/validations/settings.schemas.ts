import { z } from "zod";

export const patchMySettingsSchema = z
    .object({
        language: z.enum(["es", "en"]).nullable().optional(),
        weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),

        debug: z
            .object({
                showJson: z.boolean().optional(),
            })
            .optional(),

        defaults: z
            .object({
                defaultRpe: z.number().min(1).max(10).nullable().optional(),
            })
            .optional(),
    })
    .strict();

export type PatchMySettingsInput = z.infer<typeof patchMySettingsSchema>;
