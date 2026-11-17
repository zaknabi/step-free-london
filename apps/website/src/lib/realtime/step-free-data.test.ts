import { describe, expect, it } from 'vite-plus/test';

import { countWithin, parseStepFreeDataset } from './step-free-data';

const validPayload = () => ({
    departure: '20261124 0900',
    reachThresholdMin: 45,
    stations: [
        { id: 'A', name: 'Alpha', lon: -0.17, lat: 51.49 },
        { id: 'B', name: 'Beta', lon: -0.09, lat: 51.51 },
        { id: 'C', name: 'Gamma', lon: 0.0, lat: 51.54 }
    ],
    origins: [
        {
            id: '940GZZLUSKS',
            name: 'South Kensington',
            stationIndex: 0,
            any: [null, 22, 50],
            stepFree: [null, 54, null]
        }
    ]
});

describe('parseStepFreeDataset', () => {
    it('accepts a well-formed dataset', () => {
        const dataset = parseStepFreeDataset(validPayload());
        expect(dataset?.stations).toHaveLength(3);
        expect(dataset?.origins[0].stepFree).toEqual([null, 54, null]);
    });

    it('rejects minute arrays that do not line up with the station list', () => {
        const payload = validPayload();
        payload.origins[0].any = [null, 22];
        expect(parseStepFreeDataset(payload)).toBeNull();
    });

    it('rejects unknown origins, bad indexes and negative or non-numeric minutes', () => {
        const unknownOrigin = validPayload();
        unknownOrigin.origins[0].id = 'HUBBAN';
        expect(parseStepFreeDataset(unknownOrigin)).toBeNull();

        const badIndex = validPayload();
        badIndex.origins[0].stationIndex = 3;
        expect(parseStepFreeDataset(badIndex)).toBeNull();

        const negative = validPayload();
        negative.origins[0].any = [null, -5, 50];
        expect(parseStepFreeDataset(negative)).toBeNull();

        const text = validPayload() as unknown as { origins: Array<{ any: unknown[] }> };
        text.origins[0].any = [null, '22', 50];
        expect(parseStepFreeDataset(text)).toBeNull();
    });

    it('rejects non-objects and missing fields', () => {
        expect(parseStepFreeDataset(null)).toBeNull();
        expect(parseStepFreeDataset([])).toBeNull();
        const { stations: _stations, ...withoutStations } = validPayload();
        expect(parseStepFreeDataset(withoutStations)).toBeNull();
    });
});

describe('countWithin', () => {
    it('counts journeys at or under the threshold and ignores missing ones', () => {
        expect(countWithin([null, 22, 45, 46, null], 45)).toBe(2);
    });
});
