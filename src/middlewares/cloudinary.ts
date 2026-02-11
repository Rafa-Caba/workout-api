import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import type { Request } from "express";
import cloudinary from "../config/cloudinary";

function safeSlug(input: string): string {
    return input
        .toLowerCase()
        .replace(/\.[^/.]+$/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 80) || "file";
}

/**
 * Upload user profile picture
 * field name: "image"
 */
export const uploadUserProfilePic = multer({
    limits: { fileSize: 10 * 1024 * 1024 },
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: "workout/users/profile-pictures",
            allowed_formats: ["jpg", "jpeg", "png", "webp"],
            public_id: (req: Request, file: Express.Multer.File) => {
                const userId = (req as any).user?.id ?? "unknown";
                const baseName = safeSlug(file.originalname);
                return `user_${userId}_${baseName}_${Date.now()}`;
            },
            transformation: [{ width: 512, height: 512, crop: "limit" }],
        } as any,
    }),
});

/**
 * Training session media
 * field name: "file" (single) or "files" (multi)
 */
export const uploadTrainingMedia = multer({
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: "workout/training/sessions",
            allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "m4v"],
            resource_type: "auto",
            public_id: (req: Request, file: Express.Multer.File) => {
                const userId = (req as any).user?.id ?? "unknown";
                const baseName = safeSlug(file.originalname);

                console.log({ userId });
                console.log({ baseName });
                console.log(`training_${userId}_${baseName}_${Date.now()}`);

                return `training_${userId}_${baseName}_${Date.now()}`;
            },
        } as any,
    }),
});
