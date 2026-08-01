// /src/services/workoutExport/workoutExportFile.service.ts
// Orchestrates range resolution, data loading, summary calculation, and file rendering.

import type {
    WorkoutReportDocument,
    WorkoutReportFile,
    WorkoutReportRequest,
} from "../../types/workoutExport.types";
import {
    loadWorkoutReportDays,
    loadWorkoutReportUser,
} from "./workoutExportData.service";
import { countInclusiveDays, normalizeFilePart } from "./workoutExport.utils";
import { renderWorkoutReportPdf } from "./workoutExportPdf.renderer";
import { resolveWorkoutReportRange } from "./workoutExportRange";
import { buildWorkoutReportSummary } from "./workoutExportSummary.builder";
import { attachWorkoutReportStaticMaps } from "./workoutExportStaticMap.service";
import { renderWorkoutReportXlsx } from "./workoutExportXlsx.renderer";

function buildFilename(document: WorkoutReportDocument): string {
    const kind = normalizeFilePart(document.range.kind);
    const from = normalizeFilePart(document.range.from);
    const to = normalizeFilePart(document.range.to);
    return `workout-export_${kind}_${from}_to_${to}.${document.options.format}`;
}

/**
 * Creates a complete XLSX or PDF export for the authenticated user.
 */
export async function createWorkoutReportFile(
    userId: string,
    request: WorkoutReportRequest,
): Promise<WorkoutReportFile> {
    const normalizedRequest: WorkoutReportRequest = {
        ...request,
        includeGpsPoints:
            request.format === "xlsx" && request.includeGpsPoints,
    };
    const user = await loadWorkoutReportUser(userId);
    const range = resolveWorkoutReportRange(
        normalizedRequest.selection,
        user.weekStartsOn,
    );
    const days = await loadWorkoutReportDays(
        userId,
        range,
        normalizedRequest.includeEmptyDays,
    );

    const document: WorkoutReportDocument = {
        generatedAt: new Date().toISOString(),
        range,
        options: normalizedRequest,
        user,
        summary: buildWorkoutReportSummary(
            days,
            countInclusiveDays(range.from, range.to),
        ),
        days,
    };

    const documentWithStaticMaps = await attachWorkoutReportStaticMaps(document);
    const buffer = normalizedRequest.format === "xlsx"
        ? renderWorkoutReportXlsx(documentWithStaticMaps)
        : renderWorkoutReportPdf(documentWithStaticMaps);

    return {
        filename: buildFilename(documentWithStaticMaps),
        contentType:
            normalizedRequest.format === "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "application/pdf",
        buffer,
    };
}
