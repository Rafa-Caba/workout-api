import { z } from "zod";

export const movementIdParamSchema = z.object({
    id: z.string().min(1, "Missing id"),
});

const booleanFromForm = z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"));

export const createMovementSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(120),
    muscleGroup: z.string().trim().max(80).nullable().optional().default(null),
    equipment: z.string().trim().max(80).nullable().optional().default(null),
    isActive: booleanFromForm.optional().default(true),
});

export const updateMovementSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    muscleGroup: z.string().trim().max(80).nullable().optional(),
    equipment: z.string().trim().max(80).nullable().optional(),
    // Igual que arriba pero sin default (solo si viene)
    isActive: booleanFromForm.optional(),
});

export const listMovementsQuerySchema = z.object({
    activeOnly: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
    q: z.string().trim().max(120).optional(),
});
