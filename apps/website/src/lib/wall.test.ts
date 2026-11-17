import { describe, expect, it } from 'vite-plus/test';

import {
    deriveTileView,
    DO_WALL,
    locateTile,
    parseScreenCoordinate,
    parseWallSize,
    type WallTile
} from './wall';

describe('parseWallSize', () => {
    it('defaults to the real 16×4 Data Observatory wall', () => {
        expect(parseWallSize(undefined, undefined)).toEqual(DO_WALL);
        expect(DO_WALL).toEqual({ cols: 16, rows: 4 });
    });

    it('accepts the simulator size from URL strings', () => {
        expect(parseWallSize('8', '2')).toEqual({ cols: 8, rows: 2 });
    });

    it('rejects odd column counts, non-integers and out-of-range sizes', () => {
        expect(parseWallSize('7', '2')).toEqual(DO_WALL);
        expect(parseWallSize('8.5', '2')).toEqual(DO_WALL);
        expect(parseWallSize('0', '2')).toEqual(DO_WALL);
        expect(parseWallSize('64', '2')).toEqual(DO_WALL);
    });
});

describe('parseScreenCoordinate', () => {
    it('clamps to the wall and falls back to 0 for junk', () => {
        expect(parseScreenCoordinate('3', 16)).toBe(3);
        expect(parseScreenCoordinate('99', 16)).toBe(15);
        expect(parseScreenCoordinate('abc', 16)).toBe(0);
        expect(parseScreenCoordinate(undefined, 16)).toBe(0);
    });
});

describe('locateTile', () => {
    it('splits the wall into an everyone half and a step-free half', () => {
        expect(locateTile(7, 0, DO_WALL)).toMatchObject({ half: 'everyone', localC: 7 });
        expect(locateTile(8, 3, DO_WALL)).toMatchObject({ half: 'step-free', localC: 0, r: 3 });
    });
});

describe('deriveTileView', () => {
    const centre = { longitude: -0.12, latitude: 51.5, zoom: 10, bearing: 0, pitch: 0 };
    const tileAt = (localC: number, r: number): WallTile => ({
        half: 'everyone',
        localC,
        r,
        halfCols: 8,
        rows: 4
    });

    it('places mirrored tiles symmetrically around the half centre', () => {
        const left = deriveTileView(centre, tileAt(0, 1));
        const right = deriveTileView(centre, tileAt(7, 1));
        expect(left.longitude).toBeLessThan(centre.longitude);
        expect(right.longitude).toBeGreaterThan(centre.longitude);
        expect(centre.longitude - left.longitude).toBeCloseTo(
            right.longitude - centre.longitude,
            6
        );
    });

    it('puts the top row north of the bottom row and keeps the zoom', () => {
        const top = deriveTileView(centre, tileAt(3, 0));
        const bottom = deriveTileView(centre, tileAt(3, 3));
        expect(top.latitude).toBeGreaterThan(bottom.latitude);
        expect(top.zoom).toBe(centre.zoom);
    });
});
