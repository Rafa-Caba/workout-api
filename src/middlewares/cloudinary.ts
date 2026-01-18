import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import type { Request } from "express";
import cloudinary from "../config/cloudinary";

/**
 * Upload user profile picture
 * field name: "image"
 */
export const uploadUserProfilePic = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "workout/users/profile-pictures",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: (req: Request, file: Express.Multer.File) => {
        const userId = (req as any).user?.id ?? "unknown";
        const baseName = file.originalname.split(".").slice(0, -1).join(".") || "image";
        return `user_${userId}_${baseName}_${Date.now()}`;
      },
      transformation: [{ width: 512, height: 512, crop: "limit" }],
    } as any,
  }),
});

/**
 * (Optional future) Training session media
 */
export const uploadTrainingMedia = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "workout/training/sessions",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "mp4"],
      public_id: (req: Request, file: Express.Multer.File) => {
        const userId = (req as any).user?.id ?? "unknown";
        return `training_${userId}_${Date.now()}`;
      },
    } as any,
  }),
});

