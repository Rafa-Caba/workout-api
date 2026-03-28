// /src/validations/movement.schemas.ts

import { z } from "zod";

export const movementIdParamSchema = z.object({
    id: z.string().min(1, "Missing id"),
});

const booleanFromForm = z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((value) => (typeof value === "boolean" ? value : value === "true"));

function normalizeUniqueStrings(values: string[]): string[] {
    const normalizedValues = values
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

    return Array.from(new Set(normalizedValues));
}

/**
 * Accepts:
 * - real arrays: ["chest", "triceps"]
 * - single string from multipart: "chest"
 * - JSON string array: '["chest","triceps"]'
 */
const movementStringArraySchema = z
    .union([
        z.array(z.string()),
        z.string(),
    ])
    .optional()
    .transform((value): string[] => {
        if (value === undefined) {
            return [];
        }

        if (Array.isArray(value)) {
            return normalizeUniqueStrings(value);
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }

        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed) as unknown;

                if (Array.isArray(parsed)) {
                    const onlyStrings = parsed.filter(
                        (item): item is string => typeof item === "string"
                    );

                    return normalizeUniqueStrings(onlyStrings);
                }
            } catch {
                return [trimmed];
            }
        }

        return [trimmed];
    });

export const createMovementSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    muscleGroup: movementStringArraySchema,
    equipment: movementStringArraySchema,
    isActive: booleanFromForm.optional().default(true),
});

export const updateMovementSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    muscleGroup: movementStringArraySchema.optional(),
    equipment: movementStringArraySchema.optional(),
    isActive: booleanFromForm.optional(),
});

export const listMovementsQuerySchema = z.object({
    activeOnly: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
    q: z.string().trim().max(120).optional(),
});