// /src/services/workoutExport/workoutExportPdf.renderer.ts
// Styled, dependency-free PDF renderer for complete workout reports.

import type {
    WorkoutReportDay,
    WorkoutReportDocument,
    WorkoutReportRoutePoint,
    WorkoutReportSession,
} from "../../types/workoutExport.types";
import {
    buildDayMetrics,
    buildSleepMetrics,
    formatReportDateLong,
    formatReportDateTime,
    formatReportDuration,
    formatReportMinutes,
    formatReportNumber,
    formatReportPace,
    formatReportPercent,
    formatReportTime,
    getSessionCadenceRpm,
    getSessionDistanceKm,
    getSessionElevationM,
    getSessionMetaText,
    getSessionPaceSecPerKm,
    getSessionRoutePointCount,
    getSessionSteps,
} from "./workoutExportPresentation.utils";
import { safeJsonStringify } from "./workoutExport.utils";

type PdfFont = "regular" | "bold";
type PdfColor = readonly [number, number, number];

type PdfImageResource = {
    name: string;
    image: Buffer;
    width: number;
    height: number;
    pageIndex: number;
};

type PdfTextOptions = {
    font?: PdfFont;
    size?: number;
    color?: PdfColor;
};

type PdfTableOptions = {
    title: string;
    headers: readonly string[];
    rows: readonly (readonly string[])[];
    widths: readonly number[];
    fontSize?: number;
    emptyMessage?: string;
    maxLinesPerCell?: number;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_X = 32;
const TOP_Y = 558;
const BOTTOM_Y = 34;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const COLOR_BRAND: PdfColor = [0.545, 0.361, 0.965];
const COLOR_BRAND_DARK: PdfColor = [0.424, 0.157, 0.851];
const COLOR_DARK: PdfColor = [0.09, 0.125, 0.2];
const COLOR_TEXT: PdfColor = [0.15, 0.18, 0.24];
const COLOR_MUTED: PdfColor = [0.39, 0.45, 0.55];
const COLOR_BORDER: PdfColor = [0.82, 0.86, 0.91];
const COLOR_PANEL: PdfColor = [0.97, 0.965, 1];
const COLOR_HEADER: PdfColor = [0.91, 0.97, 0.96];
const COLOR_ALT: PdfColor = [0.975, 0.98, 0.99];
const COLOR_WHITE: PdfColor = [1, 1, 1];
const COLOR_GREEN: PdfColor = [0.12, 0.65, 0.42];
const COLOR_RED: PdfColor = [0.9, 0.2, 0.25];
const COLOR_ROUTE: PdfColor = [0.49, 0.25, 0.88];

function normalizePdfText(value: string): string {
    return value
        .replace(/[–—]/g, "-")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/…/g, "...")
        .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, "?");
}

function hexPdfText(value: string): string {
    return Buffer.from(normalizePdfText(value), "latin1")
        .toString("hex")
        .toUpperCase();
}

function colorCommand(color: PdfColor, stroke = false): string {
    const [red, green, blue] = color;
    return `${red} ${green} ${blue} ${stroke ? "RG" : "rg"}`;
}

function approximateChars(width: number, fontSize: number): number {
    return Math.max(4, Math.floor(width / Math.max(3.5, fontSize * 0.53)));
}

function wrapText(
    value: string,
    maxChars: number,
    maxLines?: number,
): string[] {
    const normalized = value.trim();
    if (!normalized) return [""];

    const output: string[] = [];

    for (const paragraph of normalized.split(/\r?\n/)) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        let line = "";

        for (const word of words) {
            const chunks: string[] = [];

            if (word.length > maxChars) {
                for (let index = 0; index < word.length; index += maxChars) {
                    chunks.push(word.slice(index, index + maxChars));
                }
            } else {
                chunks.push(word);
            }

            for (const chunk of chunks) {
                const candidate = line ? `${line} ${chunk}` : chunk;
                if (candidate.length <= maxChars) {
                    line = candidate;
                } else {
                    if (line) output.push(line);
                    line = chunk;
                }
            }
        }

        if (line) output.push(line);
        if (words.length === 0) output.push("");
    }

    if (maxLines && output.length > maxLines) {
        const limited = output.slice(0, maxLines);
        const lastIndex = limited.length - 1;
        limited[lastIndex] = `${limited[lastIndex].slice(0, Math.max(1, maxChars - 3))}...`;
        return limited;
    }

    return output;
}

function sessionMetricRows(
    session: WorkoutReportSession,
): readonly (readonly [string, string])[] {
    return [
        ["Duración", formatReportDuration(session.durationSeconds)],
        ["Media", String(session.media.length)],
        ["Kcal activas", formatReportNumber(session.activeKcal, 1, " kcal")],
        ["Kcal totales", formatReportNumber(session.totalKcal, 1, " kcal")],
        ["FC promedio", formatReportNumber(session.avgHr, 0, " bpm")],
        ["FC máxima", formatReportNumber(session.maxHr, 0, " bpm")],
        ["Pasos", formatReportNumber(getSessionSteps(session), 0)],
        ["Distancia", formatReportNumber(getSessionDistanceKm(session), 2, " km")],
        ["Elevación", formatReportNumber(getSessionElevationM(session), 1, " m")],
        ["Ritmo", formatReportPace(getSessionPaceSecPerKm(session))],
        ["Cadencia", formatReportNumber(getSessionCadenceRpm(session), 0, " rpm")],
        ["RPE", formatReportNumber(session.effortRpe, 1)],
        ["Inicio", formatReportTime(session.startAt)],
        ["Fin", formatReportTime(session.endAt)],
        ["Fuente", getSessionMetaText(session, "source") ?? "-"],
        ["Dispositivo", getSessionMetaText(session, "sourceDevice") ?? "-"],
        ["Session kind", getSessionMetaText(session, "sessionKind") ?? "-"],
        ["Puntos de ruta", String(getSessionRoutePointCount(session))],
    ];
}

class PdfLayout {
    private pages: string[][] = [[]];
    private images: PdfImageResource[] = [];
    private currentY = TOP_Y;

    private get currentPage(): string[] {
        return this.pages[this.pages.length - 1];
    }

    get y(): number {
        return this.currentY;
    }

    set y(value: number) {
        this.currentY = value;
    }

    private newPage(): void {
        this.pages.push([]);
        this.currentY = TOP_Y;
        this.drawPageBrand();
    }

    private drawPageBrand(): void {
        this.drawTextAt("WORKOUT APP", MARGIN_X, PAGE_HEIGHT - 24, {
            font: "bold",
            size: 8,
            color: COLOR_BRAND_DARK,
        });
        this.drawLine(
            MARGIN_X,
            PAGE_HEIGHT - 29,
            PAGE_WIDTH - MARGIN_X,
            PAGE_HEIGHT - 29,
            COLOR_BORDER,
            0.5,
        );
    }

    ensureSpace(requiredHeight: number): void {
        if (this.currentY - requiredHeight >= BOTTOM_Y) return;
        this.newPage();
    }

    forcePageBreak(): void {
        if (this.currentPage.length > 0) this.newPage();
    }

    addSpacer(height = 8): void {
        this.ensureSpace(height);
        this.currentY -= height;
    }

    drawTextAt(
        value: string,
        x: number,
        y: number,
        options: PdfTextOptions = {},
    ): void {
        const fontRef = options.font === "bold" ? "/F2" : "/F1";
        const size = options.size ?? 9;
        const color = options.color ?? COLOR_TEXT;
        this.currentPage.push(
            `q ${colorCommand(color)} BT ${fontRef} ${size} Tf ${x} ${y} Td <${hexPdfText(value || " ")}> Tj ET Q`,
        );
    }

    drawRect(
        x: number,
        y: number,
        width: number,
        height: number,
        fill: PdfColor,
        stroke: PdfColor = COLOR_BORDER,
        lineWidth = 0.6,
    ): void {
        this.currentPage.push(
            `q ${colorCommand(fill)} ${colorCommand(stroke, true)} ${lineWidth} w ${x} ${y} ${width} ${height} re B Q`,
        );
    }

    drawLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: PdfColor = COLOR_BORDER,
        lineWidth = 0.6,
    ): void {
        this.currentPage.push(
            `q ${colorCommand(color, true)} ${lineWidth} w ${x1} ${y1} m ${x2} ${y2} l S Q`,
        );
    }

    drawJpegAt(
        image: Buffer,
        imageWidth: number,
        imageHeight: number,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        const name = `Im${this.images.length + 1}`;
        this.images.push({
            name,
            image,
            width: imageWidth,
            height: imageHeight,
            pageIndex: this.pages.length - 1,
        });
        this.currentPage.push(
            `q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`,
        );
    }

    drawCircle(
        x: number,
        y: number,
        radius: number,
        fill: PdfColor,
    ): void {
        const control = radius * 0.5522847498;
        this.currentPage.push(
            `q ${colorCommand(fill)} ${x + radius} ${y} m ` +
            `${x + radius} ${y + control} ${x + control} ${y + radius} ${x} ${y + radius} c ` +
            `${x - control} ${y + radius} ${x - radius} ${y + control} ${x - radius} ${y} c ` +
            `${x - radius} ${y - control} ${x - control} ${y - radius} ${x} ${y - radius} c ` +
            `${x + control} ${y - radius} ${x + radius} ${y - control} ${x + radius} ${y} c f Q`,
        );
    }

    addSectionTitle(title: string): void {
        this.ensureSpace(30);
        this.drawRect(
            MARGIN_X,
            this.currentY - 24,
            CONTENT_WIDTH,
            24,
            COLOR_DARK,
            COLOR_DARK,
            0,
        );
        this.drawTextAt(title, MARGIN_X + 10, this.currentY - 16, {
            font: "bold",
            size: 11,
            color: COLOR_WHITE,
        });
        this.currentY -= 30;
    }

    addParagraph(
        value: string,
        options: PdfTextOptions & { indent?: number; gapAfter?: number } = {},
    ): void {
        const size = options.size ?? 8.5;
        const indent = options.indent ?? 0;
        const gapAfter = options.gapAfter ?? 4;
        const width = CONTENT_WIDTH - indent;
        const lines = wrapText(value, approximateChars(width, size));
        const lineHeight = size * 1.35;
        this.ensureSpace(lines.length * lineHeight + gapAfter);

        lines.forEach((line) => {
            this.drawTextAt(line, MARGIN_X + indent, this.currentY - size, options);
            this.currentY -= lineHeight;
        });
        this.currentY -= gapAfter;
    }

    addKpiCards(
        items: readonly { label: string; value: string }[],
    ): void {
        const columns = 6;
        const gap = 6;
        const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
        const cardHeight = 52;
        const rowsNeeded = Math.ceil(items.length / columns);
        this.ensureSpace(rowsNeeded * (cardHeight + gap));

        items.forEach((item, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const x = MARGIN_X + column * (cardWidth + gap);
            const y = this.currentY - row * (cardHeight + gap) - cardHeight;
            this.drawRect(x, y, cardWidth, cardHeight, COLOR_PANEL, COLOR_BORDER);
            this.drawTextAt(item.label, x + 8, y + cardHeight - 15, {
                font: "bold",
                size: 7.2,
                color: COLOR_MUTED,
            });
            this.drawTextAt(item.value, x + 8, y + 15, {
                font: "bold",
                size: 12,
                color: COLOR_DARK,
            });
        });

        this.currentY -= rowsNeeded * (cardHeight + gap);
    }

    addTable(options: PdfTableOptions): void {
        const fontSize = options.fontSize ?? 7;
        const maxLines = options.maxLinesPerCell ?? 3;
        const lineHeight = fontSize * 1.22;
        const paddingX = 4;
        const paddingY = 4;
        const totalWidth = options.widths.reduce((sum, width) => sum + width, 0);
        const scale = CONTENT_WIDTH / totalWidth;
        const widths = options.widths.map((width) => width * scale);

        this.addSectionTitle(options.title);

        const drawHeader = (): void => {
            const headerLines = options.headers.map((header, index) =>
                wrapText(
                    header,
                    approximateChars(widths[index] - paddingX * 2, fontSize),
                    3,
                ),
            );
            const headerHeight = Math.max(
                24,
                ...headerLines.map((lines) => lines.length * lineHeight + paddingY * 2),
            );
            this.ensureSpace(headerHeight + 12);
            let x = MARGIN_X;

            headerLines.forEach((lines, index) => {
                this.drawRect(
                    x,
                    this.currentY - headerHeight,
                    widths[index],
                    headerHeight,
                    COLOR_HEADER,
                    COLOR_BORDER,
                );
                lines.forEach((line, lineIndex) => {
                    this.drawTextAt(
                        line,
                        x + paddingX,
                        this.currentY - paddingY - fontSize - lineIndex * lineHeight,
                        { font: "bold", size: fontSize, color: COLOR_DARK },
                    );
                });
                x += widths[index];
            });
            this.currentY -= headerHeight;
        };

        drawHeader();

        if (options.rows.length === 0) {
            const rowHeight = 24;
            this.drawRect(
                MARGIN_X,
                this.currentY - rowHeight,
                CONTENT_WIDTH,
                rowHeight,
                COLOR_ALT,
                COLOR_BORDER,
            );
            this.drawTextAt(
                options.emptyMessage ?? "Sin registros.",
                MARGIN_X + 6,
                this.currentY - 16,
                { size: 7.5, color: COLOR_MUTED },
            );
            this.currentY -= rowHeight + 8;
            return;
        }

        options.rows.forEach((row, rowIndex) => {
            const cellLines = row.map((value, index) =>
                wrapText(
                    value,
                    approximateChars(widths[index] - paddingX * 2, fontSize),
                    maxLines,
                ),
            );
            const rowHeight = Math.max(
                22,
                ...cellLines.map((lines) => lines.length * lineHeight + paddingY * 2),
            );

            if (this.currentY - rowHeight < BOTTOM_Y) {
                this.forcePageBreak();
                drawHeader();
            }

            let x = MARGIN_X;
            const fill = rowIndex % 2 === 0 ? COLOR_WHITE : COLOR_ALT;

            cellLines.forEach((lines, index) => {
                this.drawRect(
                    x,
                    this.currentY - rowHeight,
                    widths[index],
                    rowHeight,
                    fill,
                    COLOR_BORDER,
                );
                lines.forEach((line, lineIndex) => {
                    this.drawTextAt(
                        line,
                        x + paddingX,
                        this.currentY - paddingY - fontSize - lineIndex * lineHeight,
                        {
                            font: index === 0 ? "bold" : "regular",
                            size: fontSize,
                            color: COLOR_TEXT,
                        },
                    );
                });
                x += widths[index];
            });
            this.currentY -= rowHeight;
        });

        this.currentY -= 8;
    }

    addRoutePreview(
        points: readonly WorkoutReportRoutePoint[],
        session: WorkoutReportSession,
        x: number,
        y: number,
        width: number,
        height: number,
    ): void {
        this.drawRect(x, y, width, height, COLOR_ALT, COLOR_BORDER);
        this.drawTextAt("Vista de ruta", x + 8, y + height - 14, {
            font: "bold",
            size: 8,
            color: COLOR_DARK,
        });
        this.drawTextAt(
            session.routeMap
                ? `${getSessionRoutePointCount(session)} puntos | Google Maps`
                : `${getSessionRoutePointCount(session)} puntos (sin mapa base)`,
            x + 8,
            y + height - 27,
            { size: 6.8, color: COLOR_MUTED },
        );

        if (session.routeMap) {
            const availableWidth = width - 16;
            const availableHeight = height - 42;
            const scale = Math.min(
                availableWidth / session.routeMap.width,
                availableHeight / session.routeMap.height,
            );
            const renderedWidth = session.routeMap.width * scale;
            const renderedHeight = session.routeMap.height * scale;
            const imageX = x + (width - renderedWidth) / 2;
            const imageY = y + 7 + (availableHeight - renderedHeight) / 2;

            this.drawJpegAt(
                session.routeMap.image,
                session.routeMap.width,
                session.routeMap.height,
                imageX,
                imageY,
                renderedWidth,
                renderedHeight,
            );
            return;
        }

        const routePoints = points.length >= 2
            ? points
            : (() => {
                const startLatitude = session.routeSummary?.startLatitude;
                const startLongitude = session.routeSummary?.startLongitude;
                const endLatitude = session.routeSummary?.endLatitude;
                const endLongitude = session.routeSummary?.endLongitude;

                if (
                    startLatitude === null ||
                    startLatitude === undefined ||
                    startLongitude === null ||
                    startLongitude === undefined ||
                    endLatitude === null ||
                    endLatitude === undefined ||
                    endLongitude === null ||
                    endLongitude === undefined
                ) {
                    return [];
                }

                return [
                    {
                        latitude: startLatitude,
                        longitude: startLongitude,
                        altitudeM: null,
                        accuracyM: null,
                        speedMps: null,
                        headingDeg: null,
                        recordedAt: null,
                    },
                    {
                        latitude: endLatitude,
                        longitude: endLongitude,
                        altitudeM: null,
                        accuracyM: null,
                        speedMps: null,
                        headingDeg: null,
                        recordedAt: null,
                    },
                ];
            })();

        if (routePoints.length < 2) {
            this.drawTextAt(
                "Ruta disponible sin geometría suficiente.",
                x + 8,
                y + 18,
                { size: 7, color: COLOR_MUTED },
            );
            return;
        }

        const minLatitude = Math.min(...routePoints.map((point) => point.latitude));
        const maxLatitude = Math.max(...routePoints.map((point) => point.latitude));
        const minLongitude = Math.min(...routePoints.map((point) => point.longitude));
        const maxLongitude = Math.max(...routePoints.map((point) => point.longitude));
        const latitudeSpan = Math.max(0.000001, maxLatitude - minLatitude);
        const longitudeSpan = Math.max(0.000001, maxLongitude - minLongitude);
        const plotX = x + 10;
        const plotY = y + 10;
        const plotWidth = width - 20;
        const plotHeight = height - 48;
        const projected = routePoints.map((point) => ({
            x: plotX + ((point.longitude - minLongitude) / longitudeSpan) * plotWidth,
            y: plotY + ((point.latitude - minLatitude) / latitudeSpan) * plotHeight,
        }));
        const commands = projected
            .map((point, index) =>
                index === 0
                    ? `${point.x} ${point.y} m`
                    : `${point.x} ${point.y} l`,
            )
            .join(" ");

        this.currentPage.push(
            `q ${colorCommand(COLOR_ROUTE, true)} 2 w 1 J 1 j ${commands} S Q`,
        );
        this.drawCircle(projected[0].x, projected[0].y, 3.5, COLOR_GREEN);
        this.drawCircle(
            projected[projected.length - 1].x,
            projected[projected.length - 1].y,
            3.5,
            COLOR_RED,
        );
    }

    addSessionCard(
        date: string,
        session: WorkoutReportSession,
        sessionIndex: number,
        document: WorkoutReportDocument,
    ): void {
        const hasRoute = getSessionRoutePointCount(session) > 0;
        const cardHeight = hasRoute ? 178 : 150;
        this.ensureSpace(cardHeight + 14);

        const cardX = MARGIN_X;
        const cardY = this.currentY - cardHeight;
        this.drawRect(cardX, cardY, CONTENT_WIDTH, cardHeight, COLOR_WHITE, COLOR_BORDER);
        this.drawRect(
            cardX,
            cardY + cardHeight - 28,
            CONTENT_WIDTH,
            28,
            COLOR_PANEL,
            COLOR_BORDER,
        );
        this.drawTextAt(
            `${sessionIndex + 1}. ${session.type}`,
            cardX + 10,
            cardY + cardHeight - 18,
            { font: "bold", size: 10.5, color: COLOR_DARK },
        );
        this.drawTextAt(
            `${formatReportDateLong(date)} | ${session.activityType ?? "Sesión"}`,
            cardX + 260,
            cardY + cardHeight - 18,
            { size: 7.5, color: COLOR_MUTED },
        );

        const metrics = sessionMetricRows(session);
        const detailWidth = hasRoute ? CONTENT_WIDTH * 0.61 : CONTENT_WIDTH - 20;
        const routeWidth = hasRoute ? CONTENT_WIDTH * 0.35 : 0;
        const columns = 3;
        const metricGap = 5;
        const metricWidth = (detailWidth - 20 - metricGap * (columns - 1)) / columns;
        const metricHeight = 19;
        const startX = cardX + 10;
        const startY = cardY + cardHeight - 36;

        metrics.forEach(([label, value], index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const x = startX + column * (metricWidth + metricGap);
            const y = startY - (row + 1) * metricHeight;
            this.drawRect(
                x,
                y,
                metricWidth,
                metricHeight - 2,
                COLOR_ALT,
                COLOR_BORDER,
                0.35,
            );
            this.drawTextAt(label, x + 5, y + 7, {
                font: "bold",
                size: 6.2,
                color: COLOR_MUTED,
            });
            this.drawTextAt(
                value,
                x + Math.min(metricWidth * 0.48, 62),
                y + 7,
                { font: "bold", size: 6.5, color: COLOR_DARK },
            );
        });

        if (hasRoute) {
            this.addRoutePreview(
                session.routePoints,
                session,
                cardX + CONTENT_WIDTH - routeWidth - 10,
                cardY + 10,
                routeWidth,
                cardHeight - 48,
            );
        }

        if (session.notes) {
            const note = wrapText(session.notes, 90, 2).join(" ");
            this.drawTextAt(`Notas: ${note}`, cardX + 10, cardY + 8, {
                size: 6.5,
                color: COLOR_MUTED,
            });
        }

        this.currentY -= cardHeight + 10;

        if (session.exercises.length > 0) {
            this.addTable({
                title: `Ejercicios - ${session.type}`,
                headers: ["Orden", "Ejercicio", "Movimiento", "Sets", "Notas"],
                rows: session.exercises.map((exercise, index) => [
                    String(index + 1),
                    exercise.name,
                    exercise.movementName ?? "-",
                    String(exercise.sets.length),
                    exercise.notes ?? "-",
                ]),
                widths: [8, 25, 24, 8, 35],
                fontSize: 7,
                maxLinesPerCell: 3,
            });

            const setRows = session.exercises.flatMap((exercise) =>
                exercise.sets.map((set) => [
                    exercise.name,
                    String(set.setIndex),
                    set.reps === null ? "-" : String(set.reps),
                    set.weight === null ? "-" : `${set.weight} ${set.unit}`,
                    set.rpe === null ? "-" : String(set.rpe),
                    set.tempo ?? "-",
                    set.restSec === null ? "-" : String(set.restSec),
                    set.isWarmup ? "Sí" : "No",
                    set.isDropSet ? "Sí" : "No",
                ]),
            );

            this.addTable({
                title: `Sets - ${session.type}`,
                headers: ["Ejercicio", "Set", "Reps", "Peso", "RPE", "Tempo", "Descanso", "Warmup", "Drop"],
                rows: setRows,
                widths: [28, 7, 8, 12, 7, 10, 10, 9, 9],
                fontSize: 6.8,
                maxLinesPerCell: 2,
            });
        }

        if (session.media.length > 0) {
            this.addTable({
                title: `Media - ${session.type}`,
                headers: ["Tipo", "Formato", "Creado", "URL"],
                rows: session.media.map((media) => [
                    media.resourceType,
                    media.format ?? "-",
                    formatReportDateTime(media.createdAt),
                    document.options.includeMediaLinks
                        ? media.url
                        : "Oculto por configuración",
                ]),
                widths: [12, 12, 18, 58],
                fontSize: 6.5,
                maxLinesPerCell: 3,
            });
        }
    }

    render(): Buffer {
        return buildPdf(this.pages, this.images);
    }
}

function buildPdf(
    pageStreams: readonly string[][],
    images: readonly PdfImageResource[],
): Buffer {
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
    objects.set(
        3,
        Buffer.from(
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "latin1",
        ),
    );
    objects.set(
        4,
        Buffer.from(
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
            "latin1",
        ),
    );

    pageStreams.forEach((commands, index) => {
        const pageNumber = index + 1;
        const footer = [
            `q ${colorCommand(COLOR_MUTED)} BT /F1 7 Tf ${MARGIN_X} 19 Td <${hexPdfText("Workout App - Exportación completa")}> Tj ET Q`,
            `q ${colorCommand(COLOR_MUTED)} BT /F1 7 Tf ${PAGE_WIDTH - 95} 19 Td <${hexPdfText(`Página ${pageNumber} de ${pageCount}`)}> Tj ET Q`,
        ].join("\n");
        const streamText = `${commands.join("\n")}\n${footer}`;
        const streamBuffer = Buffer.from(streamText, "latin1");
        const pageObject = pageObjectNumbers[index];
        const contentObject = contentObjectNumbers[index];

        const pageImages = images.filter((image) => image.pageIndex === index);
        const imageResources = pageImages.length > 0
            ? `/XObject << ${pageImages
                .map((image) => {
                    const imageIndex = images.findIndex((candidate) => candidate.name === image.name);
                    const imageObject = 5 + pageCount * 2 + imageIndex;
                    return `/${image.name} ${imageObject} 0 R`;
                })
                .join(" ")} >>`
            : "";

        objects.set(
            pageObject,
            Buffer.from(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${imageResources} >> /Contents ${contentObject} 0 R >>`,
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

    images.forEach((image, index) => {
        const imageObject = 5 + pageCount * 2 + index;
        objects.set(
            imageObject,
            Buffer.concat([
                Buffer.from(
                    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.image.length} >>\nstream\n`,
                    "latin1",
                ),
                image.image,
                Buffer.from("\nendstream", "latin1"),
            ]),
        );
    });

    const maxObject = 4 + pageCount * 2 + images.length;
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

function addReportHeader(
    layout: PdfLayout,
    document: WorkoutReportDocument,
): void {
    layout.drawRect(
        0,
        PAGE_HEIGHT - 92,
        PAGE_WIDTH,
        92,
        COLOR_BRAND,
        COLOR_BRAND,
        0,
    );
    layout.drawTextAt("WORKOUT APP", MARGIN_X, PAGE_HEIGHT - 28, {
        font: "bold",
        size: 10,
        color: COLOR_WHITE,
    });
    layout.drawTextAt("Reporte completo de actividad", MARGIN_X, PAGE_HEIGHT - 55, {
        font: "bold",
        size: 22,
        color: COLOR_WHITE,
    });
    layout.drawTextAt(document.range.label, MARGIN_X, PAGE_HEIGHT - 75, {
        size: 10,
        color: COLOR_WHITE,
    });
    layout.y = PAGE_HEIGHT - 108;

    const metadata = [
        ["Usuario", document.user.name],
        ["Correo", document.user.email || "-"],
        ["Desde", document.range.from],
        ["Hasta", document.range.to],
        ["Generado", formatReportDateTime(document.generatedAt)],
    ] as const;
    const gap = 6;
    const itemWidth = (CONTENT_WIDTH - gap * (metadata.length - 1)) / metadata.length;

    metadata.forEach(([label, value], index) => {
        const x = MARGIN_X + index * (itemWidth + gap);
        layout.drawRect(x, layout.y - 43, itemWidth, 43, COLOR_PANEL, COLOR_BORDER);
        layout.drawTextAt(label, x + 7, layout.y - 14, {
            font: "bold",
            size: 6.8,
            color: COLOR_MUTED,
        });
        const lines = wrapText(value, approximateChars(itemWidth - 14, 8), 2);
        lines.forEach((line, lineIndex) => {
            layout.drawTextAt(line, x + 7, layout.y - 29 - lineIndex * 9, {
                font: "bold",
                size: 8,
                color: COLOR_DARK,
            });
        });
    });
    layout.y -= 52;
}

function addSummary(
    layout: PdfLayout,
    document: WorkoutReportDocument,
): void {
    const { summary } = document;
    const periodSessions = document.days.flatMap(
        (day) => day.training?.sessions ?? [],
    );
    const hasActiveKcal = periodSessions.some(
        (session) => session.activeKcal !== null,
    );
    const hasTotalKcal = periodSessions.some(
        (session) => session.totalKcal !== null,
    );
    const hasDistance = periodSessions.some(
        (session) => getSessionDistanceKm(session) !== null,
    );
    const hasSteps = periodSessions.some(
        (session) => getSessionSteps(session) !== null,
    );

    layout.addSectionTitle("Resumen del periodo");
    layout.addKpiCards([
        { label: "Días con datos", value: `${summary.daysWithData} / ${summary.calendarDays}` },
        { label: "Días con sueño", value: String(summary.daysWithSleep) },
        { label: "Días entrenados", value: String(summary.trainingDays) },
        { label: "Sesiones", value: String(summary.sessions) },
        { label: "Ejercicios", value: String(summary.exercises) },
        { label: "Sets", value: String(summary.sets) },
        { label: "Duración total", value: formatReportDuration(summary.totalDurationSeconds) },
        { label: "Kcal activas", value: formatReportNumber(hasActiveKcal ? summary.totalActiveKcal : null, 1, " kcal") },
        { label: "Kcal totales", value: formatReportNumber(hasTotalKcal ? summary.totalKcal : null, 1, " kcal") },
        { label: "Distancia", value: formatReportNumber(hasDistance ? summary.totalDistanceKm : null, 2, " km") },
        { label: "Pasos", value: formatReportNumber(hasSteps ? summary.totalSteps : null, 0) },
        { label: "Sueño promedio", value: formatReportMinutes(summary.averageSleepMinutes) },
    ]);

    const dayMetrics = document.days.map(buildDayMetrics);
    layout.addTable({
        title: document.days.length === 1 ? "KPIs del día" : "KPIs por día",
        headers: ["Fecha", "Entrenamiento", "Kcal act.", "Kcal tot.", "Sesiones", "Gym", "Cardio", "Media", "Sueño", "Score"],
        rows: dayMetrics.map((metrics) => [
            metrics.dateLabel,
            formatReportDuration(metrics.durationSeconds),
            formatReportNumber(metrics.activeKcal, 1),
            formatReportNumber(metrics.totalKcal, 1),
            String(metrics.sessionCount),
            String(metrics.gymSessionCount),
            String(metrics.cardioSessionCount),
            String(metrics.mediaCount),
            formatReportMinutes(metrics.sleepMinutes),
            formatReportNumber(metrics.sleepScore, 0),
        ]),
        widths: [18, 13, 10, 10, 9, 7, 8, 7, 12, 7],
        fontSize: 6.8,
        maxLinesPerCell: 2,
    });

    const sleepMetrics = document.days
        .map(buildSleepMetrics)
        .filter((metrics): metrics is NonNullable<ReturnType<typeof buildSleepMetrics>> => metrics !== null);
    layout.addTable({
        title: document.days.length === 1
            ? "Detalle de sueño del día"
            : "Detalle de sueño por día",
        headers: ["Fecha", "Dormido", "En cama", "Score", "Efic.", "Readiness", "REM %", "Deep %", "Ligero", "Despierto", "Fuente", "Dispositivo", "Importado", "Última sync"],
        rows: sleepMetrics.map((metrics) => [
            metrics.dateLabel,
            formatReportMinutes(metrics.totalMinutes),
            formatReportMinutes(metrics.inBedMinutes),
            formatReportNumber(metrics.score, 0),
            formatReportPercent(metrics.efficiencyPct),
            formatReportNumber(metrics.readiness, 0),
            formatReportPercent(metrics.remPct),
            formatReportPercent(metrics.deepPct),
            formatReportMinutes(metrics.coreMinutes),
            formatReportMinutes(metrics.awakeMinutes),
            metrics.source ?? "-",
            metrics.sourceDevice ?? "-",
            formatReportDateTime(metrics.importedAt),
            formatReportDateTime(metrics.lastSyncedAt),
        ]),
        widths: [14, 8, 8, 6, 7, 8, 7, 7, 8, 8, 8, 11, 10, 10],
        fontSize: 5.5,
        emptyMessage: "No hay registros de sueño para este periodo.",
        maxLinesPerCell: 2,
    });

    const sessions = document.days.flatMap((day) =>
        (day.training?.sessions ?? []).map((session) => ({ day, session })),
    );
    layout.addTable({
        title: "Resumen de sesiones",
        headers: ["Fecha", "Tipo", "Actividad", "Duración", "Kcal act.", "Kcal tot.", "FC prom", "FC máx", "Pasos", "Distancia", "Ritmo", "RPE"],
        rows: sessions.map(({ day, session }) => [
            day.date,
            session.type,
            session.activityType ?? "-",
            formatReportDuration(session.durationSeconds),
            formatReportNumber(session.activeKcal, 1),
            formatReportNumber(session.totalKcal, 1),
            formatReportNumber(session.avgHr, 0),
            formatReportNumber(session.maxHr, 0),
            formatReportNumber(getSessionSteps(session), 0),
            formatReportNumber(getSessionDistanceKm(session), 2, " km"),
            formatReportPace(getSessionPaceSecPerKm(session)),
            formatReportNumber(session.effortRpe, 1),
        ]),
        widths: [12, 19, 12, 11, 9, 9, 8, 8, 8, 10, 12, 7],
        fontSize: 6.2,
        emptyMessage: "No hay sesiones registradas para este periodo.",
        maxLinesPerCell: 2,
    });
}

function addDayNotes(
    layout: PdfLayout,
    day: WorkoutReportDay,
): void {
    if (!day.notes && day.tags.length === 0 && day.dayNotes.length === 0) return;

    const rows: string[][] = [];
    if (day.notes) rows.push(["General", "Notas", day.notes, "-"]);
    if (day.tags.length > 0) rows.push(["General", "Tags", day.tags.join(", "), "-"]);
    day.dayNotes.forEach((note) => {
        rows.push([
            note.type,
            note.title,
            note.description ?? "-",
            formatReportDateTime(note.updatedAt),
        ]);
    });

    layout.addTable({
        title: `Notas - ${formatReportDateLong(day.date)}`,
        headers: ["Tipo", "Título", "Descripción", "Actualizada"],
        rows,
        widths: [14, 22, 48, 16],
        fontSize: 7,
        maxLinesPerCell: 5,
    });
}

function addPlannedRoutine(
    layout: PdfLayout,
    day: WorkoutReportDay,
): void {
    const routine = day.plannedRoutine;
    if (!routine) return;

    layout.addTable({
        title: `Plan del día - ${formatReportDateLong(day.date)}`,
        headers: ["Orden", "Ejercicio", "Movimiento", "Sets", "Reps", "Carga", "RPE", "Notas"],
        rows: routine.exercises.map((exercise, index) => [
            String(index + 1),
            exercise.name,
            exercise.movementName ?? "-",
            exercise.sets === null ? "-" : String(exercise.sets),
            exercise.reps ?? "-",
            exercise.load ?? "-",
            exercise.rpe === null ? "-" : String(exercise.rpe),
            exercise.notes ?? "-",
        ]),
        widths: [7, 22, 18, 7, 9, 10, 7, 20],
        fontSize: 6.8,
        emptyMessage: `Plan sin ejercicios. Tipo: ${routine.sessionType ?? "-"}; Focus: ${routine.focus ?? "-"}.`,
        maxLinesPerCell: 3,
    });

    if (routine.notes) {
        layout.addParagraph(`Notas del plan: ${routine.notes}`, {
            size: 7.5,
            color: COLOR_MUTED,
        });
    }
}

function addTechnicalMetadata(
    layout: PdfLayout,
    day: WorkoutReportDay,
): void {
    const rows: string[][] = [];
    if (day.meta) rows.push(["Día", safeJsonStringify(day.meta)]);
    if (day.sleep?.raw) rows.push(["Sueño raw", safeJsonStringify(day.sleep.raw)]);
    if (day.training?.raw) rows.push(["Training raw", safeJsonStringify(day.training.raw)]);

    for (const session of day.training?.sessions ?? []) {
        if (session.meta) {
            rows.push([`Sesión ${session.type}`, safeJsonStringify(session.meta)]);
        }
    }

    if (rows.length === 0) return;

    layout.addTable({
        title: `Metadata técnica - ${day.date}`,
        headers: ["Scope", "Valor JSON"],
        rows,
        widths: [20, 80],
        fontSize: 6.2,
        maxLinesPerCell: 8,
    });
}

/**
 * Renders a complete, styled workout report as a landscape A4 PDF Buffer.
 */
export function renderWorkoutReportPdf(
    document: WorkoutReportDocument,
): Buffer {
    const layout = new PdfLayout();
    addReportHeader(layout, document);
    addSummary(layout, document);

    document.days.forEach((day) => {
        const sessions = day.training?.sessions ?? [];

        if (sessions.length > 0) {
            layout.addSectionTitle(`Sesiones - ${formatReportDateLong(day.date)}`);
            sessions.forEach((session, index) => {
                layout.addSessionCard(day.date, session, index, document);
            });
        }

        addDayNotes(layout, day);
        addPlannedRoutine(layout, day);

        if (document.options.includeTechnicalMetadata) {
            addTechnicalMetadata(layout, day);
        }
    });

    return layout.render();
}
