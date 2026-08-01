// /src/services/workoutExport/workoutExportXlsx.renderer.ts
// Dependency-free XLSX renderer with multiple normalized workout report sheets.

import { deflateRawSync } from "node:zlib";

import type {
    WorkoutReportDocument,
    WorkoutReportSession,
} from "../../types/workoutExport.types";
import {
    isRecord,
    readStringFrom,
    round,
    safeJsonStringify,
} from "./workoutExport.utils";

type SpreadsheetCell = string | number | boolean | null;

type SpreadsheetColumn = {
    key: string;
    header: string;
    width?: number;
};

type SpreadsheetRow = Record<string, SpreadsheetCell>;

type SpreadsheetSheet = {
    name: string;
    columns: SpreadsheetColumn[];
    rows: SpreadsheetRow[];
};

type ZipEntry = {
    name: string;
    data: Buffer;
};

const XLSX_MAX_DATA_ROWS_PER_SHEET = 1_048_575;
const XLSX_MAX_TEXT_LENGTH = 32_767;
const XLSX_METADATA_CHUNK_LENGTH = 30_000;

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
        let value = index;

        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) !== 0
                ? 0xedb88320 ^ (value >>> 1)
                : value >>> 1;
        }

        table[index] = value >>> 0;
    }

    return table;
})();

function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { date: number; time: number } {
    const year = Math.max(1980, date.getFullYear());
    const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);

    return { date: dosDate, time: dosTime };
}

/**
 * Creates a standards-compliant DEFLATE-compressed ZIP archive for XLSX.
 * Compression is provided by Node's built-in zlib module.
 */
function createZip(entries: readonly ZipEntry[]): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    const timestamp = dosDateTime(new Date());
    let offset = 0;

    for (const entry of entries) {
        const fileName = Buffer.from(entry.name, "utf8");
        const checksum = crc32(entry.data);
        const compressedData = deflateRawSync(entry.data);
        const compressionMethod = 8;
        const localHeader = Buffer.alloc(30);

        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(compressionMethod, 8);
        localHeader.writeUInt16LE(timestamp.time, 10);
        localHeader.writeUInt16LE(timestamp.date, 12);
        localHeader.writeUInt32LE(checksum, 14);
        localHeader.writeUInt32LE(compressedData.length, 18);
        localHeader.writeUInt32LE(entry.data.length, 22);
        localHeader.writeUInt16LE(fileName.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, fileName, compressedData);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(compressionMethod, 10);
        centralHeader.writeUInt16LE(timestamp.time, 12);
        centralHeader.writeUInt16LE(timestamp.date, 14);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(compressedData.length, 20);
        centralHeader.writeUInt32LE(entry.data.length, 24);
        centralHeader.writeUInt16LE(fileName.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);

        centralParts.push(centralHeader, fileName);
        offset += localHeader.length + fileName.length + compressedData.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);

    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
    let value = index + 1;
    let name = "";

    while (value > 0) {
        const remainder = (value - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        value = Math.floor((value - 1) / 26);
    }

    return name;
}

function sanitizeSheetName(name: string): string {
    const sanitized = name.replace(/[\\/?*\[\]:]/g, " ").trim();
    return (sanitized || "Hoja").slice(0, 31);
}

function renderCell(reference: string, value: SpreadsheetCell, styleIndex = 0): string {
    if (value === null || value === "") {
        return `<c r="${reference}" s="${styleIndex}"/>`;
    }

    if (typeof value === "number") {
        return `<c r="${reference}" s="${styleIndex}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
    }

    if (typeof value === "boolean") {
        return `<c r="${reference}" s="${styleIndex}" t="b"><v>${value ? 1 : 0}</v></c>`;
    }

    return `<c r="${reference}" s="${styleIndex}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function inferColumnWidth(column: SpreadsheetColumn, rows: readonly SpreadsheetRow[]): number {
    const maxLength = rows.reduce((current, row) => {
        const value = row[column.key];
        const length = value === null || value === undefined ? 0 : String(value).length;
        return Math.max(current, Math.min(length, 60));
    }, column.header.length);

    return column.width ?? Math.max(10, Math.min(48, maxLength + 2));
}

function renderWorksheet(sheet: SpreadsheetSheet): string {
    const safeRows = sheet.rows.length > 0 ? sheet.rows : [{}];
    const headerCells = sheet.columns
        .map((column, index) => renderCell(`${columnName(index)}1`, column.header, 1))
        .join("");

    const dataRows = sheet.rows
        .map((row, rowIndex) => {
            const excelRow = rowIndex + 2;
            const cells = sheet.columns
                .map((column, columnIndex) =>
                    renderCell(
                        `${columnName(columnIndex)}${excelRow}`,
                        row[column.key] ?? null,
                    ),
                )
                .join("");
            return `<row r="${excelRow}">${cells}</row>`;
        })
        .join("");

    const lastColumn = columnName(Math.max(0, sheet.columns.length - 1));
    const lastRow = Math.max(1, sheet.rows.length + 1);
    const dimensions = `A1:${lastColumn}${lastRow}`;
    const columnsXml = sheet.columns
        .map((column, index) => {
            const width = inferColumnWidth(column, safeRows);
            return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        })
        .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensions}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columnsXml}</cols>
  <sheetData><row r="1" ht="22" customHeight="1">${headerCells}</row>${dataRows}</sheetData>
  <autoFilter ref="${dimensions}"/>
</worksheet>`;
}

function renderStyles(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF172033"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFCBD5E1"/></left><right style="thin"><color rgb="FFCBD5E1"/></right><top style="thin"><color rgb="FFCBD5E1"/></top><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function sessionMetaValue(session: WorkoutReportSession, key: string): string | null {
    if (!isRecord(session.meta)) return null;
    return readStringFrom(session.meta, key);
}

function sessionMetaBoolean(
    session: WorkoutReportSession,
    key: string,
): boolean | null {
    if (!isRecord(session.meta)) return null;
    const value = session.meta[key];
    return typeof value === "boolean" ? value : null;
}

function chunkRows(
    rows: readonly SpreadsheetRow[],
    maxRows: number,
): SpreadsheetRow[][] {
    const chunks: SpreadsheetRow[][] = [];

    for (let index = 0; index < rows.length; index += maxRows) {
        chunks.push(rows.slice(index, index + maxRows));
    }

    return chunks.length > 0 ? chunks : [[]];
}

function splitSpreadsheetText(
    value: string,
    chunkLength = XLSX_METADATA_CHUNK_LENGTH,
): string[] {
    if (!value) return [""];
    const chunks: string[] = [];

    for (let index = 0; index < value.length; index += chunkLength) {
        chunks.push(value.slice(index, index + chunkLength));
    }

    return chunks;
}

function spreadsheetJsonPreview(value: unknown): string | null {
    if (value === null || value === undefined) return null;

    const serialized = safeJsonStringify(value);

    if (serialized.length <= XLSX_MAX_TEXT_LENGTH) {
        return serialized;
    }

    return (
        serialized.slice(0, XLSX_METADATA_CHUNK_LENGTH) +
        " … [contenido completo en Metadata técnica]"
    );
}

function buildSheets(document: WorkoutReportDocument): SpreadsheetSheet[] {
    const { days, options, range, summary, user, generatedAt } = document;
    const sessions = days.flatMap((day) =>
        (day.training?.sessions ?? []).map((session) => ({ day, session })),
    );

    const summaryRows: SpreadsheetRow[] = [
        { field: "Usuario", value: user.name },
        { field: "Correo", value: user.email },
        { field: "Zona horaria", value: user.timezone ?? "—" },
        { field: "Periodo", value: range.label },
        { field: "Desde", value: range.from },
        { field: "Hasta", value: range.to },
        { field: "Generado", value: generatedAt },
        { field: "Días del calendario", value: summary.calendarDays },
        { field: "Días con datos", value: summary.daysWithData },
        { field: "Días con sueño", value: summary.daysWithSleep },
        { field: "Días de entrenamiento", value: summary.trainingDays },
        { field: "Sesiones", value: summary.sessions },
        { field: "Ejercicios", value: summary.exercises },
        { field: "Sets", value: summary.sets },
        { field: "Duración total (s)", value: summary.totalDurationSeconds },
        { field: "Calorías activas", value: summary.totalActiveKcal },
        { field: "Calorías totales", value: summary.totalKcal },
        { field: "Distancia total (km)", value: summary.totalDistanceKm },
        { field: "Pasos totales", value: summary.totalSteps },
        { field: "Sueño promedio (min)", value: summary.averageSleepMinutes },
        { field: "Sleep Score promedio", value: summary.averageSleepScore },
        { field: "Incluye días vacíos", value: options.includeEmptyDays },
        { field: "Incluye links de media", value: options.includeMediaLinks },
        { field: "Incluye puntos GPS", value: options.includeGpsPoints },
        { field: "Incluye metadata técnica", value: options.includeTechnicalMetadata },
    ];

    const dayColumns: SpreadsheetColumn[] = [
        { key: "date", header: "Fecha", width: 13 },
        { key: "weekKey", header: "Semana", width: 12 },
        { key: "empty", header: "Día vacío", width: 11 },
        { key: "sleepScore", header: "Sleep Score", width: 12 },
        { key: "sleepMinutes", header: "Sueño (min)", width: 12 },
        { key: "sessions", header: "Sesiones", width: 10 },
        { key: "duration", header: "Duración (s)", width: 13 },
        { key: "activeKcal", header: "Kcal activas", width: 13 },
        { key: "distanceKm", header: "Distancia km", width: 13 },
        { key: "steps", header: "Pasos", width: 11 },
        { key: "dayRpe", header: "RPE del día", width: 12 },
        { key: "tags", header: "Tags", width: 24 },
        { key: "notes", header: "Notas", width: 40 },
        { key: "createdAt", header: "Creado", width: 22 },
        { key: "updatedAt", header: "Actualizado", width: 22 },
    ];

    if (options.includeTechnicalMetadata) {
        dayColumns.push({ key: "meta", header: "Metadata", width: 48 });
    }

    const dayRows = days.map((day): SpreadsheetRow => {
        const daySessions = day.training?.sessions ?? [];
        return {
            date: day.date,
            weekKey: day.weekKey,
            empty: day.isEmpty,
            sleepScore: day.sleep?.score ?? null,
            sleepMinutes: day.sleep?.timeAsleepMinutes ?? null,
            sessions: daySessions.length,
            duration: round(daySessions.reduce((total, session) => total + (session.durationSeconds ?? 0), 0), 0),
            activeKcal: round(daySessions.reduce((total, session) => total + (session.activeKcal ?? 0), 0), 2),
            distanceKm: round(daySessions.reduce((total, session) => total + (session.distanceKm ?? session.cardioMetrics?.distanceKm ?? 0), 0), 3),
            steps: round(daySessions.reduce((total, session) => total + (session.steps ?? session.cardioMetrics?.steps ?? 0), 0), 0),
            dayRpe: day.training?.dayEffortRpe ?? null,
            tags: day.tags.join(" | "),
            notes: day.notes,
            createdAt: day.createdAt,
            updatedAt: day.updatedAt,
            meta: options.includeTechnicalMetadata ? spreadsheetJsonPreview(day.meta) : null,
        };
    });

    const noteRows = days.flatMap((day) =>
        day.dayNotes.map((note): SpreadsheetRow => ({
            date: day.date,
            id: note.id,
            type: note.type,
            title: note.title,
            description: note.description,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
        })),
    );

    const sleepColumns: SpreadsheetColumn[] = [
        { key: "date", header: "Fecha", width: 13 },
        { key: "score", header: "Score", width: 10 },
        { key: "asleep", header: "Dormido min", width: 13 },
        { key: "inBed", header: "En cama min", width: 13 },
        { key: "awake", header: "Awake min", width: 12 },
        { key: "rem", header: "REM min", width: 11 },
        { key: "core", header: "Core min", width: 11 },
        { key: "deep", header: "Deep min", width: 11 },
        { key: "source", header: "Source", width: 16 },
        { key: "device", header: "Device", width: 28 },
        { key: "importedAt", header: "Imported At", width: 22 },
        { key: "lastSyncedAt", header: "Last Synced At", width: 22 },
    ];

    if (options.includeTechnicalMetadata) {
        sleepColumns.push({ key: "raw", header: "Raw", width: 48 });
    }

    const sleepRows = days
        .filter((day) => day.sleep !== null)
        .map((day): SpreadsheetRow => ({
            date: day.date,
            score: day.sleep?.score ?? null,
            asleep: day.sleep?.timeAsleepMinutes ?? null,
            inBed: day.sleep?.timeInBedMinutes ?? null,
            awake: day.sleep?.awakeMinutes ?? null,
            rem: day.sleep?.remMinutes ?? null,
            core: day.sleep?.coreMinutes ?? null,
            deep: day.sleep?.deepMinutes ?? null,
            source: day.sleep?.source ?? null,
            device: day.sleep?.sourceDevice ?? null,
            importedAt: day.sleep?.importedAt ?? null,
            lastSyncedAt: day.sleep?.lastSyncedAt ?? null,
            raw: options.includeTechnicalMetadata ? spreadsheetJsonPreview(day.sleep?.raw) : null,
        }));

    const sessionColumns: SpreadsheetColumn[] = [
        { key: "date", header: "Fecha", width: 13 },
        { key: "id", header: "Session ID", width: 26 },
        { key: "type", header: "Tipo", width: 20 },
        { key: "activity", header: "Actividad", width: 14 },
        { key: "environment", header: "Entorno", width: 12 },
        { key: "startAt", header: "Inicio", width: 22 },
        { key: "endAt", header: "Fin", width: 22 },
        { key: "duration", header: "Duración s", width: 12 },
        { key: "activeKcal", header: "Kcal activas", width: 13 },
        { key: "totalKcal", header: "Kcal totales", width: 13 },
        { key: "avgHr", header: "FC promedio", width: 13 },
        { key: "maxHr", header: "FC máxima", width: 12 },
        { key: "distance", header: "Distancia km", width: 13 },
        { key: "steps", header: "Pasos", width: 11 },
        { key: "elevation", header: "Elevación m", width: 12 },
        { key: "pace", header: "Ritmo s/km", width: 12 },
        { key: "avgSpeed", header: "Velocidad prom km/h", width: 18 },
        { key: "maxSpeed", header: "Velocidad máx km/h", width: 18 },
        { key: "cadence", header: "Cadencia rpm", width: 13 },
        { key: "strideLength", header: "Zancada m", width: 12 },
        { key: "rpe", header: "RPE", width: 8 },
        { key: "source", header: "Source", width: 16 },
        { key: "device", header: "Device", width: 28 },
        { key: "kind", header: "Session Kind", width: 18 },
        { key: "externalId", header: "External ID", width: 28 },
        { key: "importedAt", header: "Imported At", width: 22 },
        { key: "lastSyncedAt", header: "Last Synced At", width: 22 },
        { key: "healthWriteStatus", header: "Health Write", width: 16 },
        { key: "healthExternalId", header: "Health External ID", width: 28 },
        { key: "healthWrittenAt", header: "Health Written At", width: 22 },
        { key: "originalType", header: "Original Type", width: 20 },
        { key: "provider", header: "Provider", width: 16 },
        { key: "trainingSource", header: "Training Source", width: 18 },
        { key: "totalKcalEstimated", header: "Kcal estimadas", width: 14 },
        { key: "media", header: "Media", width: 9 },
        { key: "routePoints", header: "Puntos GPS", width: 12 },
        { key: "notes", header: "Notas", width: 40 },
    ];

    if (options.includeTechnicalMetadata) {
        sessionColumns.push({ key: "meta", header: "Metadata", width: 48 });
    }

    const sessionRows = sessions.map(({ day, session }): SpreadsheetRow => ({
        date: day.date,
        id: session.id,
        type: session.type,
        activity: session.activityType,
        environment: session.cardioEnvironment,
        startAt: session.startAt,
        endAt: session.endAt,
        duration: session.durationSeconds,
        activeKcal: session.activeKcal,
        totalKcal: session.totalKcal,
        avgHr: session.avgHr,
        maxHr: session.maxHr,
        distance: session.distanceKm ?? session.cardioMetrics?.distanceKm ?? null,
        steps: session.steps ?? session.cardioMetrics?.steps ?? null,
        elevation: session.elevationGainM ?? session.cardioMetrics?.elevationGainM ?? null,
        pace: session.paceSecPerKm ?? session.cardioMetrics?.paceSecPerKm ?? null,
        avgSpeed: session.cardioMetrics?.avgSpeedKmh ?? null,
        maxSpeed: session.cardioMetrics?.maxSpeedKmh ?? null,
        cadence: session.cadenceRpm ?? session.cardioMetrics?.cadenceRpm ?? null,
        strideLength: session.cardioMetrics?.strideLengthM ?? null,
        rpe: session.effortRpe,
        source: sessionMetaValue(session, "source"),
        device: sessionMetaValue(session, "sourceDevice"),
        kind: sessionMetaValue(session, "sessionKind"),
        externalId: sessionMetaValue(session, "externalId"),
        importedAt: sessionMetaValue(session, "importedAt"),
        lastSyncedAt: sessionMetaValue(session, "lastSyncedAt"),
        healthWriteStatus: sessionMetaValue(session, "healthWriteStatus"),
        healthExternalId: sessionMetaValue(session, "healthExternalId"),
        healthWrittenAt: sessionMetaValue(session, "healthWrittenAt"),
        originalType: sessionMetaValue(session, "originalType"),
        provider: sessionMetaValue(session, "provider"),
        trainingSource: sessionMetaValue(session, "trainingSource"),
        totalKcalEstimated: sessionMetaBoolean(
            session,
            "totalKcalEstimated",
        ),
        media: session.media.length,
        routePoints: session.routePoints.length || session.routeSummary?.pointCount || 0,
        notes: session.notes,
        meta: options.includeTechnicalMetadata ? spreadsheetJsonPreview(session.meta) : null,
    }));

    const exerciseRows = sessions.flatMap(({ day, session }) =>
        session.exercises.map((exercise, exerciseIndex): SpreadsheetRow => ({
            date: day.date,
            sessionId: session.id,
            sessionType: session.type,
            exerciseIndex: exerciseIndex + 1,
            exerciseId: exercise.id,
            name: exercise.name,
            movementId: exercise.movementId,
            movementName: exercise.movementName,
            sets: exercise.sets.length,
            notes: exercise.notes,
            meta: options.includeTechnicalMetadata ? spreadsheetJsonPreview(exercise.meta) : null,
        })),
    );

    const exerciseColumns: SpreadsheetColumn[] = [
        { key: "date", header: "Fecha", width: 13 },
        { key: "sessionId", header: "Session ID", width: 26 },
        { key: "sessionType", header: "Sesión", width: 20 },
        { key: "exerciseIndex", header: "Orden", width: 9 },
        { key: "exerciseId", header: "Exercise ID", width: 26 },
        { key: "name", header: "Ejercicio", width: 30 },
        { key: "movementId", header: "Movement ID", width: 24 },
        { key: "movementName", header: "Movimiento", width: 28 },
        { key: "sets", header: "Sets", width: 8 },
        { key: "notes", header: "Notas", width: 40 },
    ];

    if (options.includeTechnicalMetadata) {
        exerciseColumns.push({ key: "meta", header: "Metadata", width: 48 });
    }

    const setRows = sessions.flatMap(({ day, session }) =>
        session.exercises.flatMap((exercise) =>
            exercise.sets.map((set): SpreadsheetRow => ({
                date: day.date,
                sessionId: session.id,
                sessionType: session.type,
                exerciseId: exercise.id,
                exercise: exercise.name,
                setIndex: set.setIndex,
                reps: set.reps,
                weight: set.weight,
                unit: set.unit,
                rpe: set.rpe,
                warmup: set.isWarmup,
                dropSet: set.isDropSet,
                tempo: set.tempo,
                restSec: set.restSec,
                tags: set.tags.join(" | "),
                meta: options.includeTechnicalMetadata ? spreadsheetJsonPreview(set.meta) : null,
            })),
        ),
    );

    const setColumns: SpreadsheetColumn[] = [
        { key: "date", header: "Fecha", width: 13 },
        { key: "sessionId", header: "Session ID", width: 26 },
        { key: "sessionType", header: "Sesión", width: 20 },
        { key: "exerciseId", header: "Exercise ID", width: 26 },
        { key: "exercise", header: "Ejercicio", width: 30 },
        { key: "setIndex", header: "Set", width: 8 },
        { key: "reps", header: "Reps", width: 8 },
        { key: "weight", header: "Peso", width: 10 },
        { key: "unit", header: "Unidad", width: 9 },
        { key: "rpe", header: "RPE", width: 8 },
        { key: "warmup", header: "Warmup", width: 10 },
        { key: "dropSet", header: "Drop set", width: 10 },
        { key: "tempo", header: "Tempo", width: 12 },
        { key: "restSec", header: "Descanso s", width: 12 },
        { key: "tags", header: "Tags", width: 24 },
    ];

    if (options.includeTechnicalMetadata) {
        setColumns.push({ key: "meta", header: "Metadata", width: 48 });
    }

    const mediaColumns: SpreadsheetColumn[] = [
        { key: "date", header: "Fecha", width: 13 },
        { key: "sessionId", header: "Session ID", width: 26 },
        { key: "sessionType", header: "Sesión", width: 20 },
        { key: "publicId", header: "Public ID", width: 34 },
        { key: "resourceType", header: "Tipo", width: 12 },
        { key: "format", header: "Formato", width: 10 },
        { key: "createdAt", header: "Creado", width: 22 },
        { key: "url", header: "URL", width: 48 },
    ];

    if (options.includeTechnicalMetadata) {
        mediaColumns.push({ key: "meta", header: "Metadata", width: 48 });
    }

    const mediaRows = sessions.flatMap(({ day, session }) =>
        session.media.map((media): SpreadsheetRow => ({
            date: day.date,
            sessionId: session.id,
            sessionType: session.type,
            publicId: media.publicId,
            resourceType: media.resourceType,
            format: media.format,
            createdAt: media.createdAt,
            url: options.includeMediaLinks ? media.url : null,
            meta: options.includeTechnicalMetadata ? spreadsheetJsonPreview(media.meta) : null,
        })),
    );

    const routeRows = sessions
        .filter(({ session }) => session.hasRoute || session.routeSummary || session.routePoints.length > 0)
        .map(({ day, session }): SpreadsheetRow => ({
            date: day.date,
            sessionId: session.id,
            sessionType: session.type,
            points: session.routePoints.length || session.routeSummary?.pointCount || 0,
            startLatitude: session.routeSummary?.startLatitude ?? session.routePoints[0]?.latitude ?? null,
            startLongitude: session.routeSummary?.startLongitude ?? session.routePoints[0]?.longitude ?? null,
            endLatitude: session.routeSummary?.endLatitude ?? session.routePoints[session.routePoints.length - 1]?.latitude ?? null,
            endLongitude: session.routeSummary?.endLongitude ?? session.routePoints[session.routePoints.length - 1]?.longitude ?? null,
            minLatitude: session.routeSummary?.minLatitude ?? null,
            maxLatitude: session.routeSummary?.maxLatitude ?? null,
            minLongitude: session.routeSummary?.minLongitude ?? null,
            maxLongitude: session.routeSummary?.maxLongitude ?? null,
            distanceKm: session.distanceKm ?? session.cardioMetrics?.distanceKm ?? null,
            elevationM: session.elevationGainM ?? session.cardioMetrics?.elevationGainM ?? null,
        }));

    const gpsRows = options.includeGpsPoints
        ? sessions.flatMap(({ day, session }) =>
            session.routePoints.map((point, pointIndex): SpreadsheetRow => ({
                date: day.date,
                sessionId: session.id,
                sessionType: session.type,
                pointIndex: pointIndex + 1,
                latitude: point.latitude,
                longitude: point.longitude,
                altitudeM: point.altitudeM,
                accuracyM: point.accuracyM,
                speedMps: point.speedMps,
                headingDeg: point.headingDeg,
                recordedAt: point.recordedAt,
            })),
        )
        : [];

    const planRows = days.flatMap((day): SpreadsheetRow[] => {
        const routine = day.plannedRoutine;

        if (!routine) return [];

        const sharedPlanValues: SpreadsheetRow = {
            date: day.date,
            sessionType: routine.sessionType,
            focus: routine.focus,
            planNotes: routine.notes,
            planTags: routine.tags.join(" | "),
            plannedAt: day.plannedMeta?.plannedAt ?? null,
            plannedBy: day.plannedMeta?.plannedBy ?? null,
            source: day.plannedMeta?.source ?? null,
        };

        if (routine.exercises.length === 0) {
            return [{
                ...sharedPlanValues,
                order: null,
                id: null,
                name: null,
                movementId: null,
                movementName: null,
                sets: null,
                reps: null,
                load: null,
                rpe: null,
                notes: null,
                attachmentPublicIds: null,
            }];
        }

        return routine.exercises.map(
            (exercise, index): SpreadsheetRow => ({
                ...sharedPlanValues,
                order: index + 1,
                id: exercise.id,
                name: exercise.name,
                movementId: exercise.movementId,
                movementName: exercise.movementName,
                sets: exercise.sets,
                reps: exercise.reps,
                load: exercise.load,
                rpe: exercise.rpe,
                notes: exercise.notes,
                attachmentPublicIds:
                    exercise.attachmentPublicIds.join(" | "),
            }),
        );
    });

    const technicalMetadataRows: SpreadsheetRow[] = [];

    function addTechnicalMetadata(
        scope: string,
        date: string,
        field: string,
        value: unknown,
        identifiers: {
            sessionId?: string | null;
            exerciseId?: string | null;
            setIndex?: number | null;
            publicId?: string | null;
        } = {},
    ): void {
        if (!options.includeTechnicalMetadata) return;
        if (value === null || value === undefined) return;

        const serialized = safeJsonStringify(value);
        const chunks = splitSpreadsheetText(serialized);

        chunks.forEach((chunk, index) => {
            technicalMetadataRows.push({
                scope,
                date,
                sessionId: identifiers.sessionId ?? null,
                exerciseId: identifiers.exerciseId ?? null,
                setIndex: identifiers.setIndex ?? null,
                publicId: identifiers.publicId ?? null,
                field,
                part: index + 1,
                totalParts: chunks.length,
                value: chunk,
            });
        });
    }

    for (const day of days) {
        addTechnicalMetadata("day", day.date, "meta", day.meta);
        addTechnicalMetadata("sleep", day.date, "raw", day.sleep?.raw);
        addTechnicalMetadata(
            "training",
            day.date,
            "raw",
            day.training?.raw,
        );

        for (const session of day.training?.sessions ?? []) {
            addTechnicalMetadata(
                "session",
                day.date,
                "meta",
                session.meta,
                { sessionId: session.id },
            );

            for (const exercise of session.exercises) {
                addTechnicalMetadata(
                    "exercise",
                    day.date,
                    "meta",
                    exercise.meta,
                    {
                        sessionId: session.id,
                        exerciseId: exercise.id,
                    },
                );

                for (const set of exercise.sets) {
                    addTechnicalMetadata(
                        "set",
                        day.date,
                        "meta",
                        set.meta,
                        {
                            sessionId: session.id,
                            exerciseId: exercise.id,
                            setIndex: set.setIndex,
                        },
                    );
                }
            }

            for (const media of session.media) {
                addTechnicalMetadata(
                    "media",
                    day.date,
                    "meta",
                    media.meta,
                    {
                        sessionId: session.id,
                        publicId: media.publicId,
                    },
                );
            }
        }
    }

    const sheets: SpreadsheetSheet[] = [
        {
            name: "Resumen",
            columns: [
                { key: "field", header: "Campo", width: 30 },
                { key: "value", header: "Valor", width: 48 },
            ],
            rows: summaryRows,
        },
        { name: "Días", columns: dayColumns, rows: dayRows },
        {
            name: "Notas del día",
            columns: [
                { key: "date", header: "Fecha", width: 13 },
                { key: "id", header: "ID", width: 26 },
                { key: "type", header: "Tipo", width: 14 },
                { key: "title", header: "Título", width: 30 },
                { key: "description", header: "Descripción", width: 48 },
                { key: "createdAt", header: "Creada", width: 22 },
                { key: "updatedAt", header: "Actualizada", width: 22 },
            ],
            rows: noteRows,
        },
        { name: "Sueño", columns: sleepColumns, rows: sleepRows },
        { name: "Sesiones", columns: sessionColumns, rows: sessionRows },
        { name: "Ejercicios", columns: exerciseColumns, rows: exerciseRows },
        { name: "Sets", columns: setColumns, rows: setRows },
        { name: "Media", columns: mediaColumns, rows: mediaRows },
        ...(options.includeTechnicalMetadata
            ? [{
                name: "Metadata técnica",
                columns: [
                    { key: "scope", header: "Scope", width: 14 },
                    { key: "date", header: "Fecha", width: 13 },
                    { key: "sessionId", header: "Session ID", width: 26 },
                    { key: "exerciseId", header: "Exercise ID", width: 26 },
                    { key: "setIndex", header: "Set", width: 8 },
                    { key: "publicId", header: "Public ID", width: 34 },
                    { key: "field", header: "Campo", width: 14 },
                    { key: "part", header: "Parte", width: 8 },
                    { key: "totalParts", header: "Total partes", width: 12 },
                    { key: "value", header: "Valor JSON", width: 48 },
                ],
                rows: technicalMetadataRows,
            }]
            : []),
        {
            name: "Rutas",
            columns: [
                { key: "date", header: "Fecha", width: 13 },
                { key: "sessionId", header: "Session ID", width: 26 },
                { key: "sessionType", header: "Sesión", width: 20 },
                { key: "points", header: "Puntos", width: 10 },
                { key: "startLatitude", header: "Lat inicio", width: 16 },
                { key: "startLongitude", header: "Lon inicio", width: 16 },
                { key: "endLatitude", header: "Lat fin", width: 16 },
                { key: "endLongitude", header: "Lon fin", width: 16 },
                { key: "minLatitude", header: "Lat min", width: 16 },
                { key: "maxLatitude", header: "Lat max", width: 16 },
                { key: "minLongitude", header: "Lon min", width: 16 },
                { key: "maxLongitude", header: "Lon max", width: 16 },
                { key: "distanceKm", header: "Distancia km", width: 13 },
                { key: "elevationM", header: "Elevación m", width: 12 },
            ],
            rows: routeRows,
        },
        {
            name: "Plan",
            columns: [
                { key: "date", header: "Fecha", width: 13 },
                { key: "sessionType", header: "Tipo de sesión", width: 22 },
                { key: "focus", header: "Focus", width: 32 },
                { key: "order", header: "Orden", width: 9 },
                { key: "id", header: "ID", width: 24 },
                { key: "name", header: "Ejercicio", width: 30 },
                { key: "movementId", header: "Movement ID", width: 24 },
                { key: "movementName", header: "Movimiento", width: 28 },
                { key: "sets", header: "Sets", width: 8 },
                { key: "reps", header: "Reps", width: 12 },
                { key: "load", header: "Carga", width: 16 },
                { key: "rpe", header: "RPE", width: 8 },
                { key: "notes", header: "Notas", width: 36 },
                { key: "attachmentPublicIds", header: "Adjuntos", width: 40 },
                { key: "planNotes", header: "Notas del plan", width: 40 },
                { key: "planTags", header: "Tags del plan", width: 24 },
                { key: "plannedAt", header: "Planeado", width: 22 },
                { key: "plannedBy", header: "Planeado por", width: 24 },
                { key: "source", header: "Source", width: 14 },
            ],
            rows: planRows,
        },
    ];

    if (options.includeGpsPoints) {
        const gpsColumns: SpreadsheetColumn[] = [
            { key: "date", header: "Fecha", width: 13 },
            { key: "sessionId", header: "Session ID", width: 26 },
            { key: "sessionType", header: "Sesión", width: 20 },
            { key: "pointIndex", header: "Punto", width: 9 },
            { key: "latitude", header: "Latitud", width: 16 },
            { key: "longitude", header: "Longitud", width: 16 },
            { key: "altitudeM", header: "Altitud m", width: 12 },
            { key: "accuracyM", header: "Precisión m", width: 13 },
            { key: "speedMps", header: "Velocidad m/s", width: 14 },
            { key: "headingDeg", header: "Rumbo °", width: 11 },
            { key: "recordedAt", header: "Registrado", width: 22 },
        ];
        const gpsSheets = chunkRows(
            gpsRows,
            XLSX_MAX_DATA_ROWS_PER_SHEET,
        ).map((rows, index): SpreadsheetSheet => ({
            name: index === 0
                ? "Puntos GPS"
                : `Puntos GPS ${index + 1}`,
            columns: gpsColumns,
            rows,
        }));

        sheets.splice(sheets.length - 1, 0, ...gpsSheets);
    }

    return sheets;
}

/**
 * Renders a complete workout report as an XLSX Buffer without third-party dependencies.
 */
export function renderWorkoutReportXlsx(document: WorkoutReportDocument): Buffer {
    const sheets = buildSheets(document).map((sheet) => ({
        ...sheet,
        name: sanitizeSheetName(sheet.name),
    }));

    const workbookSheets = sheets
        .map(
            (sheet, index) =>
                `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
        )
        .join("");

    const workbookRelationships = sheets
        .map(
            (_sheet, index) =>
                `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
        )
        .join("");

    const styleRelationshipId = sheets.length + 1;
    const contentOverrides = sheets
        .map(
            (_sheet, index) =>
                `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("");

    const entries: ZipEntry[] = [
        {
            name: "[Content_Types].xml",
            data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${contentOverrides}
</Types>`, "utf8"),
        },
        {
            name: "_rels/.rels",
            data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`, "utf8"),
        },
        {
            name: "xl/workbook.xml",
            data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${workbookSheets}</sheets>
</workbook>`, "utf8"),
        },
        {
            name: "xl/_rels/workbook.xml.rels",
            data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelationships}
  <Relationship Id="rId${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`, "utf8"),
        },
        {
            name: "xl/styles.xml",
            data: Buffer.from(renderStyles(), "utf8"),
        },
        {
            name: "docProps/core.xml",
            data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Workout App - Exportación completa</dc:title>
  <dc:creator>Workout App</dc:creator>
  <cp:lastModifiedBy>Workout App</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(document.generatedAt)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(document.generatedAt)}</dcterms:modified>
</cp:coreProperties>`, "utf8"),
        },
        {
            name: "docProps/app.xml",
            data: Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Workout App</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts>
</Properties>`, "utf8"),
        },
        ...sheets.map((sheet, index): ZipEntry => ({
            name: `xl/worksheets/sheet${index + 1}.xml`,
            data: Buffer.from(renderWorksheet(sheet), "utf8"),
        })),
    ];

    return createZip(entries);
}
