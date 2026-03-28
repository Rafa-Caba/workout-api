// src/config/env.ts

import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  // Mongo
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  MONGO_DB_NAME: z.string().min(1, "MONGO_DB_NAME is required"),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1440m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  // CORS (CSV list)
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173,https://workout-app-cabanillas.vercel.app"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

const env = parsed.data;

export default env;
