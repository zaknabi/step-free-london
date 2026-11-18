import { describe, expect, it } from 'vite-plus/test';

import {
    DEFAULT_SHARED_STATE,
    isHalfRevealed,
    isOriginId,
    isSceneId,
    sanitizeSharedState
} from './story';

describe('message validation', () => {
    it('accepts only known origin and scene ids', () => {
        expect(isOriginId('940GZZLUSKS')).toBe(true);
        expect(isOriginId('940GZZLUBNK')).toBe(false);
        expect(isOriginId(42)).toBe(false);
        expect(isSceneId('step-free')).toBe(true);
        expect(isSceneId('next')).toBe(false);
        // The scene was renamed from `everyone`; stale messages using the old id are rejected.
        expect(isSceneId('everyone')).toBe(false);
        expect(isSceneId(undefined)).toBe(false);
    });

    it('keeps valid fields and falls back per field for invalid ones', () => {
        const fallback = { origin: '940GZZLUSTD', scene: 'with-stairs' } as const;
        expect(sanitizeSharedState({ origin: '940GZZLUBXN', scene: 'nope' }, fallback)).toEqual({
            origin: '940GZZLUBXN',
            scene: 'with-stairs'
        });
        expect(sanitizeSharedState({ origin: '<script>', scene: 'london' }, fallback)).toEqual({
            origin: '940GZZLUSTD',
            scene: 'london'
        });
    });

    it('returns the fallback for non-object snapshots', () => {
        expect(sanitizeSharedState(null)).toEqual(DEFAULT_SHARED_STATE);
        expect(sanitizeSharedState('hello')).toEqual(DEFAULT_SHARED_STATE);
    });
});

describe('scene reveal order', () => {
    it('reveals with stairs first, then step-free alongside', () => {
        expect(isHalfRevealed('london', 'with-stairs')).toBe(false);
        expect(isHalfRevealed('london', 'step-free')).toBe(false);
        expect(isHalfRevealed('with-stairs', 'with-stairs')).toBe(true);
        expect(isHalfRevealed('with-stairs', 'step-free')).toBe(false);
        expect(isHalfRevealed('step-free', 'with-stairs')).toBe(true);
        expect(isHalfRevealed('step-free', 'step-free')).toBe(true);
    });
});
