import cloudinary from "../config/cloudinary";

export type CloudinaryResourceType = "image" | "video" | "raw";

export const deleteFromCloudinary = async (
    publicId: string,
    options?: { resourceType?: CloudinaryResourceType }
): Promise<void> => {
    const resourceType: CloudinaryResourceType = options?.resourceType ?? "image";

    try {
        await cloudinary.uploader.destroy(
            publicId,
            {
                resource_type: resourceType,
                invalidate: true,
            } as any
        );
    } catch {
        // Intentionally soft-fail:
        // DB consistency wins; Cloudinary drift shouldn't hard-fail the API.
        return;
    }
};
