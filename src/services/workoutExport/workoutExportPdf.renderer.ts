// /src/services/workoutExport/workoutExportPdf.renderer.ts
// Dependency-free, readable PDF renderer for complete workout reports.

import type {
    JsonValue,
    WorkoutReportDay,
    WorkoutReportDocument,
    WorkoutReportSession,
} from "../../types/workoutExport.types";
import {
    formatDuration,
    formatMinutes,
    isRecord,
    readStringFrom,
    round,
    safeJsonStringify,
} from "./workoutExport.utils";

type PdfFont = "regular" | "bold";

type PdfTextOptions = {
    font?: PdfFont;
    size?: number;
    indent?: number;
    gapAfter?: number;
    maxChars?: number;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 42;
const TOP_Y = 794;
const BOTTOM_Y = 48;

function normalizePdfText(value: string): string {
    return value
        .replace(/[–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/…/g, "...")
        .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, "?");
}

function hexPdfText(value: string): string {
    return Buffer.from(normalizePdfText(value), "latin1").toString("hex").toUpperCase();
}

function wrapText(value: string, maxChars: number): string[] {
    const normalized = value.trim();
    if (!normalized) return [""];

    const output: string[] = [];

    for (const paragraph of normalized.split(/\r?\n/)) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        let line = "";

        for (const word of words) {
            if (word.length > maxChars) {
                if (line) {
                    output.push(line);
                    line = "";
                }

                for (let index = 0; index < word.length; index += maxChars) {
                    output.push(word.slice(index, index + maxChars));
                }
                continue;
            }

            const candidate = line ? `${line} ${word}` : word;
            if (candidate.length <= maxChars) {
                line = candidate;
            } else {
                output.push(line);
                line = word;
            }
        }

        if (line) output.push(line);
        if (words.length === 0) output.push("");
    }

    return output;
}

function formatNumber(value: number | null, suffix = "", decimals = 1): string {
    return value === null ? "-" : `${round(value, decimals)}${suffix}`;
}

function quantityLabel(
    value: number,
    singular: string,
    plural: string,
): string {
    return `${value} ${value === 1 ? singular : plural}`;
}

function readMeta(session: WorkoutReportSession, key: string): string | null {
    if (!isRecord(session.meta)) return null;
    return readStringFrom(session.meta, key);
}

class PdfLayout {
    private pages: string[][] = [[]];
    private currentY = TOP_Y;

    private get currentPage(): string[] {
        return this.pages[this.pages.length - 1];
    }

    private ensureSpace(requiredHeight: number): void {
        if (this.currentY - requiredHeight >= BOTTOM_Y) return;
        this.newPage();
    }

    private newPage(): void {
        this.pages.push([]);
        this.currentY = TOP_Y;
    }

    addText(value: string, options: PdfTextOptions = {}): void {
        const font = options.font ?? "regular";
        const size = options.size ?? 10;
        const indent = options.indent ?? 0;
        const gapAfter = options.gapAfter ?? 3;
        const lineHeight = Math.max(11, size * 1.32);
        const maxChars = options.maxChars ?? Math.max(30, Math.floor((94 - indent / 5) * (10 / size)));
        const lines = wrapText(value, maxChars);

        for (const line of lines) {
            this.ensureSpace(lineHeight + gapAfter);
            const fontRef = font === "bold" ? "/F2" : "/F1";
            const x = MARGIN_X + indent;
            const text = hexPdfText(line || " ");
            this.currentPage.push(`BT ${fontRef} ${size} Tf ${x} ${this.currentY} Td <${text}> Tj ET`);
            this.currentY -= lineHeight;
        }

        this.currentY -= gapAfter;
    }

    addHeading(value: string, size = 14): void {
        this.ensureSpace(size * 2.2);
        this.addText(value, { font: "bold", size, gapAfter: 5, maxChars: 72 });
        this.addRule();
    }

    addRule(): void {
        this.ensureSpace(8);
        this.currentPage.push(`q 0.75 G 0.7 w ${MARGIN_X} ${this.currentY + 3} m ${PAGE_WIDTH - MARGIN_X} ${this.currentY + 3} l S Q`);
        this.currentY -= 7;
    }

    addSpacer(height = 6): void {
        this.ensureSpace(height);
        this.currentY -= height;
    }

    /**
     * Keeps a short section heading together with its first content lines.
     */
    reserveSpace(requiredHeight: number): void {
        this.ensureSpace(requiredHeight);
    }

    forcePageBreak(): void {
        if (this.currentPage.length > 0) this.newPage();
    }

    render(): Buffer {
        return buildPdf(this.pages);
    }
}

function buildPdf(pageStreams: readonly string[][]): Buffer {
    const pageCount = pageStreams.length;
    const pageObjectNumbers = pageStreams.map((_page, index) => 5 + index * 2);
    const contentObjectNumbers = pageStreams.map((_page, index) => 6 + index * 2);
    const objects = new Map<number, Buffer>();

    objects.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
    objects.set(
        2,
        Buffer.from(
            `<< /Type /Pages /Count ${pageCount} /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] >>`,
            "latin1",
        ),
    );
    objects.set(3, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"));
    objects.set(4, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"));

    pageStreams.forEach((commands, index) => {
        const pageNumber = index + 1;
        const footer = `BT /F1 8 Tf ${PAGE_WIDTH - 90} 24 Td <${hexPdfText(`Página ${pageNumber} de ${pageCount}`)}> Tj ET`;
        const streamText = `${commands.join("\n")}\n${footer}`;
        const streamBuffer = Buffer.from(streamText, "latin1");
        const pageObject = pageObjectNumbers[index];
        const contentObject = contentObjectNumbers[index];

        objects.set(
            pageObject,
            Buffer.from(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`,
                "latin1",
            ),
        );
        objects.set(
            contentObject,
            Buffer.concat([
                Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, "latin1"),
                streamBuffer,
                Buffer.from("\nendstream", "latin1"),
            ]),
        );
    });

    const maxObject = 4 + pageCount * 2;
    const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    const offsets: number[] = [0];
    let currentOffset = parts[0].length;

    for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
        const body = objects.get(objectNumber) ?? Buffer.from("<<>>", "latin1");
        const prefix = Buffer.from(`${objectNumber} 0 obj\n`, "latin1");
        const suffix = Buffer.from("\nendobj\n", "latin1");

        offsets[objectNumber] = currentOffset;
        parts.push(prefix, body, suffix);
        currentOffset += prefix.length + body.length + suffix.length;
    }

    const xrefOffset = currentOffset;
    const xrefRows = ["0000000000 65535 f "];

    for (let objectNumber = 1; objectNumber <= maxObject; objectNumber += 1) {
        xrefRows.push(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n `);
    }

    parts.push(
        Buffer.from(
            `xref\n0 ${maxObject + 1}\n${xrefRows.join("\n")}\ntrailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
            "latin1",
        ),
    );

    return Buffer.concat(parts);
}

function addSummary(layout: PdfLayout, document: WorkoutReportDocument): void {
    const { summary, user, range, generatedAt } = document;

    layout.addText("WORKOUT APP", { font: "bold", size: 12, gapAfter: 2 });
    layout.addText("Reporte completo de actividad", { font: "bold", size: 22, gapAfter: 7, maxChars: 50 });
    layout.addText(`Usuario: ${user.name}${user.email ? ` (${user.email})` : ""}`, { size: 10 });
    layout.addText(`Periodo: ${range.label}`, { size: 10 });
    layout.addText(`Generado: ${generatedAt}`, { size: 9, gapAfter: 9 });
    layout.addHeading("Resumen", 15);
    layout.addText(`Días del periodo: ${summary.calendarDays} | Días con datos: ${summary.daysWithData}`);
    layout.addText(`Sueño registrado: ${quantityLabel(summary.daysWithSleep, "día", "días")} | Entrenamiento: ${quantityLabel(summary.trainingDays, "día", "días")}`);
    layout.addText(`Sesiones: ${summary.sessions} | Ejercicios: ${summary.exercises} | Sets: ${summary.sets}`);
    layout.addText(`Duración total: ${formatDuration(summary.totalDurationSeconds)}`);
    layout.addText(`Calorías activas: ${formatNumber(summary.totalActiveKcal, " kcal", 1)} | Calorías totales: ${formatNumber(summary.totalKcal, " kcal", 1)}`);
    layout.addText(`Distancia: ${formatNumber(summary.totalDistanceKm, " km", 2)} | Pasos: ${formatNumber(summary.totalSteps, "", 0)}`);
    layout.addText(`Sueño promedio: ${formatMinutes(summary.averageSleepMinutes)} | Sleep Score promedio: ${formatNumber(summary.averageSleepScore, "", 1)}`);
    layout.addSpacer(8);
}

function addSleep(layout: PdfLayout, day: WorkoutReportDay): void {
    if (!day.sleep) return;

    const sleep = day.sleep;
    layout.addText("Sueño", { font: "bold", size: 12, gapAfter: 3 });
    layout.addText(`Dormido: ${formatMinutes(sleep.timeAsleepMinutes)} | En cama: ${formatMinutes(sleep.timeInBedMinutes)} | Score: ${formatNumber(sleep.score, "", 0)}`, { indent: 8 });
    layout.addText(`Awake: ${formatMinutes(sleep.awakeMinutes)} | REM: ${formatMinutes(sleep.remMinutes)} | Core: ${formatMinutes(sleep.coreMinutes)} | Deep: ${formatMinutes(sleep.deepMinutes)}`, { indent: 8 });
    layout.addText(`Fuente: ${sleep.source ?? "-"} | Dispositivo: ${sleep.sourceDevice ?? "-"}`, { indent: 8 });

    if (sleep.importedAt || sleep.lastSyncedAt) {
        layout.addText(`Importado: ${sleep.importedAt ?? "-"} | Última sync: ${sleep.lastSyncedAt ?? "-"}`, { indent: 8 });
    }
}

function addSession(layout: PdfLayout, session: WorkoutReportSession, index: number, document: WorkoutReportDocument): void {
    const source = readMeta(session, "source");
    const device = readMeta(session, "sourceDevice");
    const kind = readMeta(session, "sessionKind");
    const distance = session.distanceKm ?? session.cardioMetrics?.distanceKm ?? null;
    const steps = session.steps ?? session.cardioMetrics?.steps ?? null;
    const elevation = session.elevationGainM ?? session.cardioMetrics?.elevationGainM ?? null;
    const pace = session.paceSecPerKm ?? session.cardioMetrics?.paceSecPerKm ?? null;
    const avgSpeed = session.cardioMetrics?.avgSpeedKmh ?? null;
    const maxSpeed = session.cardioMetrics?.maxSpeedKmh ?? null;
    const cadence = session.cadenceRpm ?? session.cardioMetrics?.cadenceRpm ?? null;
    const strideLength = session.cardioMetrics?.strideLengthM ?? null;
    const importedAt = readMeta(session, "importedAt");
    const lastSyncedAt = readMeta(session, "lastSyncedAt");
    const externalId = readMeta(session, "externalId");

    layout.addText(`${index + 1}. ${session.type}`, { font: "bold", size: 11, indent: 8, gapAfter: 2 });
    layout.addText(`Inicio: ${session.startAt ?? "-"} | Fin: ${session.endAt ?? "-"} | Duración: ${formatDuration(session.durationSeconds)}`, { indent: 16 });
    layout.addText(`Kcal activas: ${formatNumber(session.activeKcal, "", 1)} | Total: ${formatNumber(session.totalKcal, "", 1)} | FC prom/máx: ${formatNumber(session.avgHr, "", 0)}/${formatNumber(session.maxHr, "", 0)} bpm`, { indent: 16 });

    if (distance !== null || steps !== null || elevation !== null || pace !== null || cadence !== null) {
        layout.addText(`Distancia: ${formatNumber(distance, " km", 2)} | Pasos: ${formatNumber(steps, "", 0)} | Elevación: ${formatNumber(elevation, " m", 1)}`, { indent: 16 });
        layout.addText(`Ritmo: ${formatNumber(pace, " s/km", 0)} | Cadencia: ${formatNumber(cadence, " rpm", 0)} | RPE: ${formatNumber(session.effortRpe, "", 1)}`, { indent: 16 });

        if (avgSpeed !== null || maxSpeed !== null || strideLength !== null) {
            layout.addText(`Velocidad prom/máx: ${formatNumber(avgSpeed, " km/h", 2)}/${formatNumber(maxSpeed, " km/h", 2)} | Zancada: ${formatNumber(strideLength, " m", 2)}`, { indent: 16 });
        }
    }

    if (source || device || kind) {
        layout.addText(`Source: ${source ?? "N/D"} | Device: ${device ?? "N/D"} | Kind: ${kind ?? "N/D"}`, { indent: 16 });
    }

    if (importedAt || lastSyncedAt || externalId) {
        layout.addText(`Importado: ${importedAt ?? "N/D"} | Última sync: ${lastSyncedAt ?? "N/D"} | External ID: ${externalId ?? "N/D"}`, { indent: 16 });
    }

    if (session.notes) layout.addText(`Notas: ${session.notes}`, { indent: 16 });

    if (session.hasRoute || session.routeSummary || session.routePoints.length > 0) {
        const points = session.routePoints.length || session.routeSummary?.pointCount || 0;
        layout.addText(`Ruta GPS: ${points} puntos. Inicio (${formatNumber(session.routeSummary?.startLatitude ?? session.routePoints[0]?.latitude ?? null, "", 5)}, ${formatNumber(session.routeSummary?.startLongitude ?? session.routePoints[0]?.longitude ?? null, "", 5)}).`, { indent: 16 });
    }

    for (const exercise of session.exercises) {
        layout.addText(`- ${exercise.name}${exercise.sets.length ? ` (${quantityLabel(exercise.sets.length, "set", "sets")})` : ""}`, { font: "bold", size: 10, indent: 22, gapAfter: 1 });
        if (exercise.notes) layout.addText(`Notas: ${exercise.notes}`, { indent: 30, size: 9 });

        for (const set of exercise.sets) {
            const flags = [set.isWarmup ? "warmup" : null, set.isDropSet ? "drop" : null]
                .filter((flag): flag is string => flag !== null)
                .join(", ");
            layout.addText(`Set ${set.setIndex}: ${set.reps ?? "-"} reps | ${set.weight ?? "-"} ${set.unit} | RPE ${set.rpe ?? "-"}${flags ? ` | ${flags}` : ""}`, { indent: 30, size: 9, gapAfter: 1 });
        }
    }

    if (session.media.length > 0) {
        layout.addText(`Media: ${quantityLabel(session.media.length, "archivo", "archivos")}`, { indent: 16 });
        if (document.options.includeMediaLinks) {
            for (const media of session.media) {
                layout.addText(`${media.resourceType}/${media.format ?? "-"}: ${media.url}`, { indent: 24, size: 8, maxChars: 100 });
            }
        }
    }

    if (document.options.includeTechnicalMetadata && session.meta) {
        layout.addText(`Metadata: ${safeJsonStringify(session.meta)}`, { indent: 16, size: 8, maxChars: 105 });
    }

    layout.addSpacer(4);
}

function addDay(layout: PdfLayout, day: WorkoutReportDay, document: WorkoutReportDocument): void {
    layout.addHeading(day.date, 15);

    if (day.isEmpty) {
        layout.addText("Sin datos registrados para este día.", { size: 10, gapAfter: 8 });
        return;
    }

    if (day.tags.length > 0) layout.addText(`Tags: ${day.tags.join(", ")}`);
    if (day.notes) layout.addText(`Notas generales: ${day.notes}`);

    if (day.dayNotes.length > 0) {
        layout.addText("Notas del día", { font: "bold", size: 12, gapAfter: 2 });
        day.dayNotes.forEach((note) => {
            layout.addText(`- [${note.type}] ${note.title}${note.description ? `: ${note.description}` : ""}`, { indent: 8 });
        });
    }

    addSleep(layout, day);

    const sessions = day.training?.sessions ?? [];
    if (sessions.length > 0) {
        layout.addText(`Sesiones (${sessions.length})`, { font: "bold", size: 12, gapAfter: 3 });
        sessions.forEach((session, index) => addSession(layout, session, index, document));
    }

    if (day.plannedRoutine) {
        layout.reserveSpace(72);
        layout.addText("Plan del día", { font: "bold", size: 12, gapAfter: 3 });
        layout.addText(`Tipo: ${day.plannedRoutine.sessionType ?? "-"} | Focus: ${day.plannedRoutine.focus ?? "-"}`, { indent: 8 });
        day.plannedRoutine.exercises.forEach((exercise, index) => {
            layout.addText(`${index + 1}. ${exercise.name} | ${exercise.sets ?? "-"} sets | ${exercise.reps ?? "-"} reps | ${exercise.load ?? "-"} | RPE ${exercise.rpe ?? "-"}`, { indent: 12 });
            if (exercise.notes) layout.addText(`Notas: ${exercise.notes}`, { indent: 20, size: 9 });
        });
        if (day.plannedRoutine.notes) layout.addText(`Notas del plan: ${day.plannedRoutine.notes}`, { indent: 8 });
    }

    if (document.options.includeTechnicalMetadata) {
        if (day.sleep?.raw) layout.addText(`Sleep raw: ${safeJsonStringify(day.sleep.raw)}`, { size: 8, maxChars: 105 });
        if (day.training?.raw) layout.addText(`Training raw: ${safeJsonStringify(day.training.raw)}`, { size: 8, maxChars: 105 });
        if (day.meta) layout.addText(`Day metadata: ${safeJsonStringify(day.meta)}`, { size: 8, maxChars: 105 });
    }

    layout.addSpacer(8);
}

/**
 * Renders a complete, human-readable workout report as a PDF Buffer.
 */
export function renderWorkoutReportPdf(document: WorkoutReportDocument): Buffer {
    const layout = new PdfLayout();

    addSummary(layout, document);

    document.days.forEach((day, index) => {
        if (index > 0) layout.forcePageBreak();
        addDay(layout, day, document);
    });

    return layout.render();
}
