import { z } from "zod";

export const registerSchema = z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(254),
    password: z.string().min(8).max(200),
    sex: z.enum(["male", "female", "other"]).nullable().optional(),
});

export const loginSchema = z.object({
    email: z.string().email().max(254),
    password: z.string().min(1).max(200),
});

export const refreshSchema = z.object({
    refreshToken: z.string().min(20),
});

export const logoutSchema = z.object({
    refreshToken: z.string().min(20),
});
