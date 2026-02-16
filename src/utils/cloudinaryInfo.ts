export type CloudinaryLike = {
    publicId: string;
    url: string;
    resourceType: "image" | "video";
    format: string | null;
    createdAt: string;
    originalName: string | null;
};

function inferResourceTypeFromMimetype(mimetype?: string): "image" | "video" {
    const mt = (mimetype ?? "").toLowerCase();
    if (mt.startsWith("video/")) return "video";
    return "image";
}

function inferFormatFromOriginalName(originalName?: string): string | null {
    const n = (originalName ?? "").trim().toLowerCase();
    const m = /\.([a-z0-9]{2,6})(\?.*)?$/.exec(n);
    return m ? m[1] : null;
}

export function extractCloudinaryInfo(file: Express.Multer.File): CloudinaryLike | null {
    const anyFile: any = file as any;

    const publicId =
        anyFile.filename ??
        anyFile.public_id ??
        anyFile.publicId ??
        anyFile.cloudinary?.public_id ??
        anyFile.cloudinary?.publicId;

    const url =
        anyFile.path ??
        anyFile.secure_url ??
        anyFile.url ??
        anyFile.cloudinary?.secure_url ??
        anyFile.cloudinary?.url;

    const resourceTypeRaw =
        anyFile.resource_type ??
        anyFile.resourceType ??
        anyFile.cloudinary?.resource_type ??
        anyFile.cloudinary?.resourceType;

    const resourceType: "image" | "video" =
        resourceTypeRaw === "video" || resourceTypeRaw === "image"
            ? resourceTypeRaw
            : inferResourceTypeFromMimetype(anyFile.mimetype);

    const format =
        (typeof anyFile.format === "string" && anyFile.format) ||
        (typeof anyFile.cloudinary?.format === "string" && anyFile.cloudinary.format) ||
        inferFormatFromOriginalName(anyFile.originalname);

    const createdAt =
        anyFile.created_at ??
        anyFile.createdAt ??
        anyFile.cloudinary?.created_at ??
        anyFile.cloudinary?.createdAt ??
        new Date().toISOString();

    if (!publicId || !url) return null;

    return {
        publicId: String(publicId),
        url: String(url),
        resourceType,
        format: format ? String(format) : null,
        createdAt: String(createdAt),
        originalName: anyFile.originalname ? String(anyFile.originalname) : null,
    };
}
