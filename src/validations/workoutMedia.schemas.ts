import { z } from "zod";
import { isoDateSchema, weekKeySchema } from "./workoutDay.schemas";

const numberFromQuery = z.coerce.number();
const cursorSchema = z.string().min(3).max(500).optional().nullable();

export const mediaFeedQuerySchema = z
    .object({
        source: z.enum(["day", "routine", "all"]).optional(),

        from: isoDateSchema.optional(),
        to: isoDateSchema.optional(),
        date: isoDateSchema.optional(),
        weekKey: weekKeySchema.optional(),
        sessionId: z.string().min(1).optional(),
        resourceType: z.enum(["image", "video"]).optional(),

        limit: numberFromQuery.optional(),
        cursor: cursorSchema,
    })
    .superRefine((q, ctx) => {
        const hasFrom = q.from !== undefined;
        const hasTo = q.to !== undefined;

        if (hasFrom !== hasTo) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "If providing from/to, both must be provided.",
                path: ["from"],
            });
        }

        const limit = q.limit ?? 50;

        if (!Number.isFinite(limit) || limit <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "limit must be a positive number.",
                path: ["limit"],
            });
        }

        if (limit > 200) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "limit must be <= 200.",
                path: ["limit"],
            });
        }
    });

export const mediaGroupedQuerySchema = mediaFeedQuerySchema.extend({
    groupBy: z.enum(["day", "week"]).optional(),
});

export const mediaDeleteQuerySchema = z.object({
    publicId: z.string().min(1),
    deleteCloudinary: z
        .preprocess((v) => {
            if (typeof v === "boolean") return v;
            if (typeof v === "string") {
                const s = v.trim().toLowerCase();
                if (["true", "1", "yes", "on"].includes(s)) return true;
                if (["false", "0", "no", "off"].includes(s)) return false;
            }
            return v;
        }, z.boolean())
        .optional(),
});
