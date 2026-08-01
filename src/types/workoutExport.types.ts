// /src/types/workoutExport.types.ts
// Strongly typed contracts for legacy JSON/CSV exports and the complete XLSX/PDF report flow.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/**
 * Legacy export types kept for backward compatibility with the existing GET endpoint.
 */
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

/**
 * Complete report contracts used by POST /api/workout/export.
 */
export type WorkoutReportFormat = "xlsx" | "pdf";
export type WorkoutReportSelectionKind = "day" | "week" | "month" | "range";

export type WorkoutReportSelection =
    | {
        kind: "day";
        date: string;
    }
    | {
        kind: "week";
        date: string;
    }
    | {
        kind: "month";
        date: string;
    }
    | {
        kind: "range";
        from: string;
        to: string;
    };

export type WorkoutReportRequest = {
    selection: WorkoutReportSelection;
    format: WorkoutReportFormat;
    includeEmptyDays: boolean;
    includeMediaLinks: boolean;
    includeGpsPoints: boolean;
    includeTechnicalMetadata: boolean;
};

export type ResolvedWorkoutReportRange = {
    kind: WorkoutReportSelectionKind;
    from: string;
    to: string;
    label: string;
};

export type WorkoutReportFile = {
    filename: string;
    contentType: string;
    buffer: Buffer;
};

export type WorkoutReportUser = {
    id: string;
    name: string;
    email: string;
    timezone: string | null;
    language: "es" | "en";
    weekStartsOn: 0 | 1;
    weightUnit: "kg" | "lb";
    distanceUnit: "km" | "mi";
};

export type WorkoutReportDayNote = {
    id: string;
    type: string;
    title: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
};

export type WorkoutReportSleep = {
    timeAsleepMinutes: number | null;
    timeInBedMinutes: number | null;
    score: number | null;
    awakeMinutes: number | null;
    remMinutes: number | null;
    coreMinutes: number | null;
    deepMinutes: number | null;
    source: string | null;
    sourceDevice: string | null;
    importedAt: string | null;
    lastSyncedAt: string | null;
    raw: JsonValue | null;
};

export type WorkoutReportMedia = {
    publicId: string;
    url: string;
    resourceType: "image" | "video" | string;
    format: string | null;
    createdAt: string;
    meta: JsonValue | null;
};

export type WorkoutReportExerciseSet = {
    setIndex: number;
    reps: number | null;
    weight: number | null;
    unit: "lb" | "kg" | string;
    rpe: number | null;
    isWarmup: boolean;
    isDropSet: boolean;
    tempo: string | null;
    restSec: number | null;
    tags: string[];
    meta: JsonValue | null;
};

export type WorkoutReportExercise = {
    id: string;
    name: string;
    movementId: string | null;
    movementName: string | null;
    notes: string | null;
    sets: WorkoutReportExerciseSet[];
    meta: JsonValue | null;
};

export type WorkoutReportCardioMetrics = {
    distanceKm: number | null;
    steps: number | null;
    elevationGainM: number | null;
    paceSecPerKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
    cadenceRpm: number | null;
    strideLengthM: number | null;
};

export type WorkoutReportRouteSummary = {
    pointCount: number;
    startLatitude: number | null;
    startLongitude: number | null;
    endLatitude: number | null;
    endLongitude: number | null;
    minLatitude: number | null;
    maxLatitude: number | null;
    minLongitude: number | null;
    maxLongitude: number | null;
};

export type WorkoutReportRoutePoint = {
    latitude: number;
    longitude: number;
    altitudeM: number | null;
    accuracyM: number | null;
    speedMps: number | null;
    headingDeg: number | null;
    recordedAt: string | null;
};

export type WorkoutReportSession = {
    id: string;
    type: string;
    activityType: string | null;
    cardioEnvironment: string | null;
    startAt: string | null;
    endAt: string | null;
    durationSeconds: number | null;
    activeKcal: number | null;
    totalKcal: number | null;
    avgHr: number | null;
    maxHr: number | null;
    distanceKm: number | null;
    steps: number | null;
    elevationGainM: number | null;
    paceSecPerKm: number | null;
    cadenceRpm: number | null;
    hasRoute: boolean;
    cardioMetrics: WorkoutReportCardioMetrics | null;
    routeSummary: WorkoutReportRouteSummary | null;
    routePoints: WorkoutReportRoutePoint[];
    effortRpe: number | null;
    notes: string | null;
    media: WorkoutReportMedia[];
    exercises: WorkoutReportExercise[];
    meta: JsonValue | null;
};

export type WorkoutReportPlannedExercise = {
    id: string;
    name: string;
    movementId: string | null;
    movementName: string | null;
    sets: number | null;
    reps: string | null;
    rpe: number | null;
    load: string | null;
    notes: string | null;
    attachmentPublicIds: string[];
};

export type WorkoutReportPlannedRoutine = {
    sessionType: string | null;
    focus: string | null;
    exercises: WorkoutReportPlannedExercise[];
    notes: string | null;
    tags: string[];
};

export type WorkoutReportPlannedMeta = {
    plannedBy: string | null;
    plannedAt: string | null;
    source: string | null;
};

export type WorkoutReportTraining = {
    source: string | null;
    dayEffortRpe: number | null;
    sessions: WorkoutReportSession[];
    raw: JsonValue | null;
};

export type WorkoutReportDay = {
    id: string | null;
    date: string;
    weekKey: string | null;
    sleep: WorkoutReportSleep | null;
    training: WorkoutReportTraining | null;
    plannedRoutine: WorkoutReportPlannedRoutine | null;
    plannedMeta: WorkoutReportPlannedMeta | null;
    dayNotes: WorkoutReportDayNote[];
    notes: string | null;
    tags: string[];
    meta: JsonValue | null;
    createdAt: string | null;
    updatedAt: string | null;
    isEmpty: boolean;
};

export type WorkoutReportSummary = {
    calendarDays: number;
    daysWithData: number;
    daysWithSleep: number;
    trainingDays: number;
    sessions: number;
    exercises: number;
    sets: number;
    totalDurationSeconds: number;
    totalActiveKcal: number;
    totalKcal: number;
    totalDistanceKm: number;
    totalSteps: number;
    averageSleepMinutes: number | null;
    averageSleepScore: number | null;
};

export type WorkoutReportDocument = {
    generatedAt: string;
    range: ResolvedWorkoutReportRange;
    options: WorkoutReportRequest;
    user: WorkoutReportUser;
    summary: WorkoutReportSummary;
    days: WorkoutReportDay[];
};
