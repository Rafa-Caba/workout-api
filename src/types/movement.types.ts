export type MediaResourceType = "image" | "video";

export type MovementMedia = {
    publicId: string;
    url: string;
    resourceType: MediaResourceType;
    format: string | null;
    createdAt: string; // ISO
    originalName: string | null;
    meta: Record<string, unknown> | null;
};

export type Movement = {
    id: string;
    userId: string;

    name: string;
    nameLower: string;

    muscleGroup: string | null;
    equipment: string | null;

    isActive: boolean;

    // MovementsPage catalog (illustrations/media)
    media: MovementMedia | null;

    createdAt: string;
    updatedAt: string;
};

export type MovementListResponse = { movements: Movement[] };
export type MovementDeletedResponse = { deleted: true; movement: Movement };
