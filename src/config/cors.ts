import type { CorsOptions } from "cors";
import env from "./env";

const allowedOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : [];

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server or tools like Postman / curl
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`), false);
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],

    exposedHeaders: ["Authorization"],
};