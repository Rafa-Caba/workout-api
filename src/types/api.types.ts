
export type ApiError = {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
};

export type OkResponse = {
    ok: true;
};

export type PaginationQuery = {
    page?: number;
    limit?: number;
};

export type PaginatedResponse<T> = {
    page: number;
    limit: number;
    total: number;
    items: T[];
};
