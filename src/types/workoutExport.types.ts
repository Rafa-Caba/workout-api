export type ExportFormat = "json" | "csv";
export type ExportScope = "day" | "session" | "exercise";

export type WorkoutExportOptions = {
    format: ExportFormat;
    scope: ExportScope;
    includeRaw: boolean;
};

export type ExportResponsePayload = {
    filename: string;
    contentType: string;
    body: string;
};
