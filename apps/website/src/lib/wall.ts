import { WebMercatorViewport } from '@deck.gl/core';

import type { WallHalf } from './realtime/story';
import type { ScreenMapViewState, Station } from './realtime/types';

// The real Data Observatory: 16 columns × 4 rows of 1920×1080 screens.
// Screens use this unless the URL overrides it (the simulator passes a smaller wall).
export const DO_WALL = { cols: 16, rows: 4 } as const;
export const SCREEN_WIDTH = 1920;
export const SCREEN_HEIGHT = 1080;
// Upper bound for URL-provided wall sizes, so a typo can't ask for absurd camera maths.
const MAX_WALL_DIMENSION = 32;
// Breathing room around the station network inside each half, as a fraction of screen height.
const MAP_PADDING_SCREEN_FRACTION = 0.15;
// Frame the map on the bulk of the network: a few outlying stations (Reading, Amersham,
// Shenfield) would otherwise shrink central London to a third of each half.
const BOUNDS_TRIM_FRACTION = 0.03;

export type WallSize = { cols: number; rows: number };

export type WallTile = {
    half: WallHalf;
    // Column within its half (0 = leftmost screen of that half).
    localC: number;
    r: number;
    halfCols: number;
    rows: number;
};

export function parseWallSize(cols: unknown, rows: unknown): WallSize {
    // Even column counts only: the wall is split into two equal halves.
    const parsedCols = parseIntegerInRange(cols, 2, MAX_WALL_DIMENSION);
    const parsedRows = parseIntegerInRange(rows, 1, MAX_WALL_DIMENSION);
    if (parsedCols === null || parsedRows === null || parsedCols % 2 !== 0) return DO_WALL;
    return { cols: parsedCols, rows: parsedRows };
}

export function parseScreenCoordinate(value: unknown, size: number) {
    // SSR and direct route probes may hit `/screen` without `c`/`r`: fall back to tile 0.
    const parsed = parseIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER) ?? 0;
    // Clamp keeps out-of-range coordinates inside the wall grid.
    return Math.min(size - 1, parsed);
}

export function locateTile(c: number, r: number, wall: WallSize): WallTile {
    const halfCols = wall.cols / 2;
    return {
        half: c < halfCols ? 'everyone' : 'step-free',
        localC: c % halfCols,
        r,
        halfCols,
        rows: wall.rows
    };
}

export function fitHalfView(
    stations: Station[],
    halfCols: number,
    rows: number
): ScreenMapViewState {
    // One camera per half, chosen so the whole network fills that half of the wall.
    // Deterministic: every screen computes the same view from the same data and wall size.
    const [minLon, maxLon] = trimmedRange(stations.map((station) => station.lon));
    const [minLat, maxLat] = trimmedRange(stations.map((station) => station.lat));
    const viewport = new WebMercatorViewport({
        width: halfCols * SCREEN_WIDTH,
        height: rows * SCREEN_HEIGHT
    }).fitBounds(
        [
            [minLon, minLat],
            [maxLon, maxLat]
        ],
        { padding: Math.round(SCREEN_HEIGHT * MAP_PADDING_SCREEN_FRACTION) }
    );
    return {
        longitude: viewport.longitude,
        latitude: viewport.latitude,
        zoom: viewport.zoom,
        bearing: 0,
        pitch: 0
    };
}

export function deriveTileView(halfView: ScreenMapViewState, tile: WallTile): ScreenMapViewState {
    // Convert the half's centre view to this screen's view by:
    // 1) projecting to pixels at a canonical screen resolution
    // 2) applying the tile's offset from the half's centre
    // 3) unprojecting back to lon/lat
    const viewport = new WebMercatorViewport({
        ...halfView,
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT
    });
    const [centerX, centerY] = viewport.project([halfView.longitude, halfView.latitude]);
    const pixelOffsetX = (tile.localC + 0.5 - tile.halfCols / 2) * SCREEN_WIDTH;
    const pixelOffsetY = (tile.r + 0.5 - tile.rows / 2) * SCREEN_HEIGHT;
    const [longitude, latitude] = viewport.unproject([
        centerX + pixelOffsetX,
        centerY + pixelOffsetY
    ]);
    return { ...halfView, longitude, latitude };
}

function trimmedRange(values: number[]): [number, number] {
    const sorted = [...values].sort((a, b) => a - b);
    const trim = Math.floor(sorted.length * BOUNDS_TRIM_FRACTION);
    return [sorted[trim], sorted[sorted.length - 1 - trim]];
}

function parseIntegerInRange(value: unknown, min: number, max: number) {
    if (value === null || value === undefined || value === '') return null;
    const parsed =
        typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
    return parsed;
}
