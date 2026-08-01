// /src/services/workoutExport/workoutExportStaticMap.service.ts
// Fetches Google Maps Static API route images and attaches them to export sessions.

import env from "../../config/env";
import type {
    WorkoutReportDocument,
    WorkoutReportRouteMap,
    WorkoutReportSession,
} from "../../types/workoutExport.types";

const STATIC_MAP_ENDPOINT = "https://maps.googleapis.com/maps/api/staticmap";
const STATIC_MAP_WIDTH = 640;
const STATIC_MAP_HEIGHT = 360;
const STATIC_MAP_SCALE = 2;
const STATIC_MAP_REQUEST_TIMEOUT_MS = 10_000;
const STATIC_MAP_MAX_URL_LENGTH = 15_500;
const STATIC_MAP_MAX_ROUTE_POINTS = 140;
const STATIC_MAP_MAX_IMAGES_PER_REPORT = 50;
const STATIC_MAP_FETCH_CONCURRENCY = 3;

type Coordinate = {
    latitude: number;
    longitude: number;
};

type SessionMapTarget = {
    dayIndex: number;
    sessionIndex: number;
    session: WorkoutReportSession;
    points: Coordinate[];
};

function isValidCoordinate(point: Coordinate): boolean {
    return (
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        point.latitude >= -90 &&
        point.latitude <= 90 &&
        point.longitude >= -180 &&
        point.longitude <= 180
    );
}

function sameCoordinate(left: Coordinate, right: Coordinate): boolean {
    return (
        left.latitude === right.latitude &&
        left.longitude === right.longitude
    );
}

function routePointsFromSession(session: WorkoutReportSession): Coordinate[] {
    const rawPoints: Coordinate[] = session.routePoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
    }));

    if (rawPoints.length < 2) {
        const summary = session.routeSummary;
        const start = summary?.startLatitude !== null &&
            summary?.startLatitude !== undefined &&
            summary.startLongitude !== null &&
            summary.startLongitude !== undefined
            ? {
                latitude: summary.startLatitude,
                longitude: summary.startLongitude,
            }
            : null;
        const end = summary?.endLatitude !== null &&
            summary?.endLatitude !== undefined &&
            summary.endLongitude !== null &&
            summary.endLongitude !== undefined
            ? {
                latitude: summary.endLatitude,
                longitude: summary.endLongitude,
            }
            : null;

        if (start && end) {
            rawPoints.push(start, end);
        }
    }

    const deduplicated: Coordinate[] = [];

    for (const point of rawPoints) {
        if (!isValidCoordinate(point)) continue;
        const previous = deduplicated[deduplicated.length - 1];
        if (!previous || !sameCoordinate(previous, point)) {
            deduplicated.push(point);
        }
    }

    return deduplicated;
}

function sampleRoutePoints(
    points: readonly Coordinate[],
    maxPoints: number,
): Coordinate[] {
    if (points.length <= maxPoints) return [...points];
    if (maxPoints <= 2) return [points[0], points[points.length - 1]];

    const sampled: Coordinate[] = [points[0]];
    const lastIndex = points.length - 1;
    const interiorSlots = maxPoints - 2;

    for (let slot = 1; slot <= interiorSlots; slot += 1) {
        const index = Math.round((slot * lastIndex) / (interiorSlots + 1));
        const point = points[index];
        const previous = sampled[sampled.length - 1];

        if (!sameCoordinate(previous, point)) {
            sampled.push(point);
        }
    }

    const lastPoint = points[lastIndex];
    if (!sameCoordinate(sampled[sampled.length - 1], lastPoint)) {
        sampled.push(lastPoint);
    }

    return sampled;
}

function encodeSignedNumber(value: number): string {
    let encodedValue = value < 0 ? ~(value << 1) : value << 1;
    let output = "";

    while (encodedValue >= 0x20) {
        output += String.fromCharCode((0x20 | (encodedValue & 0x1f)) + 63);
        encodedValue >>= 5;
    }

    return output + String.fromCharCode(encodedValue + 63);
}

/**
 * Encodes latitude/longitude pairs using Google's Encoded Polyline Algorithm.
 */
function encodePolyline(points: readonly Coordinate[]): string {
    let previousLatitude = 0;
    let previousLongitude = 0;
    let output = "";

    for (const point of points) {
        const latitude = Math.round(point.latitude * 100_000);
        const longitude = Math.round(point.longitude * 100_000);
        output += encodeSignedNumber(latitude - previousLatitude);
        output += encodeSignedNumber(longitude - previousLongitude);
        previousLatitude = latitude;
        previousLongitude = longitude;
    }

    return output;
}

function coordinateText(point: Coordinate): string {
    return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

function buildStaticMapUrl(
    apiKey: string,
    points: readonly Coordinate[],
): string {
    const params = new URLSearchParams();
    params.set("size", `${STATIC_MAP_WIDTH}x${STATIC_MAP_HEIGHT}`);
    params.set("scale", String(STATIC_MAP_SCALE));
    params.set("format", "jpg");
    params.set("maptype", "roadmap");
    params.set("language", "es");
    params.set("region", "mx");
    params.append(
        "path",
        `color:0x7C3AEDFF|weight:5|enc:${encodePolyline(points)}`,
    );
    params.append(
        "markers",
        `color:green|label:I|${coordinateText(points[0])}`,
    );
    params.append(
        "markers",
        `color:red|label:F|${coordinateText(points[points.length - 1])}`,
    );
    params.set("key", apiKey);

    return `${STATIC_MAP_ENDPOINT}?${params.toString()}`;
}

function buildUrlWithinLimit(
    apiKey: string,
    points: readonly Coordinate[],
): string | null {
    const limits = [
        STATIC_MAP_MAX_ROUTE_POINTS,
        100,
        70,
        40,
        20,
        10,
        2,
    ];

    for (const limit of limits) {
        const sampled = sampleRoutePoints(points, limit);
        const url = buildStaticMapUrl(apiKey, sampled);

        if (url.length <= STATIC_MAP_MAX_URL_LENGTH) {
            return url;
        }
    }

    return null;
}

function hasJpegSignature(buffer: Buffer): boolean {
    return (
        buffer.length >= 4 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[buffer.length - 2] === 0xff &&
        buffer[buffer.length - 1] === 0xd9
    );
}

async function fetchStaticMap(
    apiKey: string,
    points: readonly Coordinate[],
): Promise<WorkoutReportRouteMap | null> {
    const requestUrl = buildUrlWithinLimit(apiKey, points);
    if (!requestUrl) return null;

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        STATIC_MAP_REQUEST_TIMEOUT_MS,
    );

    try {
        const response = await fetch(requestUrl, {
            method: "GET",
            signal: controller.signal,
            headers: {
                Accept: "image/jpeg",
                "User-Agent": "Workout-App-Export/1.0",
            },
        });

        if (!response.ok) {
            console.warn(
                `[workout-export] Static map request failed with status ${response.status}.`,
            );
            return null;
        }

        const contentType = response.headers.get("content-type") ?? "";
        const image = Buffer.from(await response.arrayBuffer());

        if (!contentType.toLowerCase().includes("image/jpeg") || !hasJpegSignature(image)) {
            console.warn(
                `[workout-export] Static map response was not a valid JPEG (${contentType || "unknown content type"}).`,
            );
            return null;
        }

        return {
            provider: "google-static-maps",
            contentType: "image/jpeg",
            width: STATIC_MAP_WIDTH * STATIC_MAP_SCALE,
            height: STATIC_MAP_HEIGHT * STATIC_MAP_SCALE,
            image,
        };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.warn(`[workout-export] Static map request failed: ${message}`);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function mapWithConcurrency<TInput, TOutput>(
    values: readonly TInput[],
    concurrency: number,
    mapper: (value: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
    const output = new Array<TOutput>(values.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < values.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            output[currentIndex] = await mapper(values[currentIndex], currentIndex);
        }
    }

    const workerCount = Math.min(Math.max(1, concurrency), values.length);
    await Promise.all(
        Array.from({ length: workerCount }, () => worker()),
    );

    return output;
}

function buildTargets(document: WorkoutReportDocument): SessionMapTarget[] {
    const targets: SessionMapTarget[] = [];

    document.days.forEach((day, dayIndex) => {
        (day.training?.sessions ?? []).forEach((session, sessionIndex) => {
            const points = routePointsFromSession(session);
            if (points.length < 2) return;

            targets.push({
                dayIndex,
                sessionIndex,
                session,
                points,
            });
        });
    });

    return targets.slice(0, STATIC_MAP_MAX_IMAGES_PER_REPORT);
}

/**
 * Adds Google Static Maps images to sessions with route geometry.
 * Missing keys, API failures, timeouts, or excessive report sizes fall back to
 * the existing vector route renderer without failing the export.
 */
export async function attachWorkoutReportStaticMaps(
    document: WorkoutReportDocument,
): Promise<WorkoutReportDocument> {
    const apiKey = env.GOOGLE_MAPS_STATIC_API_KEY?.trim();
    if (!apiKey) return document;

    const targets = buildTargets(document);
    if (targets.length === 0) return document;

    const routeMaps = await mapWithConcurrency(
        targets,
        STATIC_MAP_FETCH_CONCURRENCY,
        async (target) => fetchStaticMap(apiKey, target.points),
    );

    const routeMapByPosition = new Map<string, WorkoutReportRouteMap>();

    targets.forEach((target, index) => {
        const routeMap = routeMaps[index];
        if (routeMap) {
            routeMapByPosition.set(
                `${target.dayIndex}:${target.sessionIndex}`,
                routeMap,
            );
        }
    });

    if (routeMapByPosition.size === 0) return document;

    return {
        ...document,
        days: document.days.map((day, dayIndex) => ({
            ...day,
            training: day.training
                ? {
                    ...day.training,
                    sessions: day.training.sessions.map((session, sessionIndex) => ({
                        ...session,
                        routeMap:
                            routeMapByPosition.get(`${dayIndex}:${sessionIndex}`) ??
                            session.routeMap,
                    })),
                }
                : null,
        })),
    };
}
