import type { Request, Response } from "express";
import * as userService from "../services/user.service";

export const getMe = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const user = await userService.getUserById(userId);
    return res.json(user);
};

export const patchMe = async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const updated = await userService.updateMe(userId, req.body);
    return res.json(updated);
};

export const uploadMyProfilePic = async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // multer-storage-cloudinary typically provides:
    // - req.file.path -> secure URL
    // - req.file.filename -> publicId
    const file = req.file as any;

    if (!file?.path || !file?.filename) {
        return res.status(400).json({
            error: { code: "MISSING_FILE", message: "Missing uploaded file (field name: image)" },
        });
    }

    const updated = await userService.setMyProfilePic(userId, {
        url: String(file.path),
        publicId: String(file.filename),
    });

    return res.json(updated);
};

export const deleteMyProfilePic = async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const updated = await userService.removeMyProfilePic(userId);
    return res.json(updated);
};
