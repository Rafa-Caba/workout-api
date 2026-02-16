import type { UserDocument } from "../models/User.model";

export type AdminUserListItem = Pick<
    UserDocument,
    | "id"
    | "name"
    | "email"
    | "role"
    | "sex"
    | "isActive"
    | "lastLoginAt"
    | "createdAt"
    | "updatedAt"
    | "profilePicUrl"
>;

export type AdminUserListResponse = {
    items: AdminUserListItem[];
    page: number;
    limit: number;
    total: number;
};
