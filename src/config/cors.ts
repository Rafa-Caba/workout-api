// /src/config/cors.ts
// Central CORS configuration for authenticated Web/API communication.
// Exposes download headers required by the workout export feature.

import type { CorsOptions } from "cors";

import env from "./env";

const allowedOrigins = env.CORS_ORIGINS
    ? env.CORS_ORIGINS
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // Allow server-to-server requests and tools such as Postman or curl.
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(
            new Error(`CORS blocked origin: ${origin}`),
            false,
        );
    },

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],

    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
    ],

    /**
     * Content-Disposition lets the Web client preserve the filename generated
     * by the API. Content-Length is useful for download diagnostics.
     */
    exposedHeaders: [
        "Authorization",
        "Content-Disposition",
        "Content-Length",
    ],
};
