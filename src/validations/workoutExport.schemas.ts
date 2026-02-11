import { z } from "zod";
import { isoDateSchema } from "./workoutDay.schemas";

const boolFromQuery = z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
        if (s === "false" || s === "0" || s === "no" || s === "off") return false;
    }
    return v;
}, z.boolean());

export const workoutExportQuerySchema = z.object({
    from: isoDateSchema,
    to: isoDateSchema,

    format: z.enum(["json", "csv"]).optional().default("json"),

    // "exercise" will be enabled after exercise tracking is implemented (Priority 2)
    scope: z.enum(["day", "session", "exercise"]).optional().default("day"),

    includeRaw: boolFromQuery.optional().default(false),
});

export type WorkoutExportQuery = z.infer<typeof workoutExportQuerySchema>;
