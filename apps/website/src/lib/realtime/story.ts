import type { BusSharedState, OriginId, SceneId } from './types';

// Origins mirror `ORIGINS` in poster/analysis/fetch_journeys.py; the dataset holds their times.
// Kept as a fixed list so the bus server can validate messages without loading the dataset.
export const ORIGINS: ReadonlyArray<{ id: OriginId; name: string }> = [
    { id: '940GZZLUSKS', name: 'South Kensington' },
    { id: '940GZZLUWYP', name: 'Wembley Park' },
    { id: '940GZZLUSTD', name: 'Stratford' },
    { id: '940GZZLUBXN', name: 'Brixton' }
];

// Scenes reveal the story one step at a time:
// - `london`: both halves show the network uncoloured
// - `with-stairs`: the left half reveals travel times with stairs (TfL's "no requirements")
// - `step-free`: the right half reveals step-free travel times alongside
export const SCENES: ReadonlyArray<{ id: SceneId; label: string }> = [
    { id: 'london', label: 'London' },
    { id: 'with-stairs', label: 'With stairs' },
    { id: 'step-free', label: 'Step-free' }
];

export const DEFAULT_SHARED_STATE: BusSharedState = {
    origin: '940GZZLUSKS',
    scene: 'london'
};

export function isOriginId(value: unknown): value is OriginId {
    // Type guard used before accepting untrusted origin values from network payloads.
    return typeof value === 'string' && ORIGINS.some((origin) => origin.id === value);
}

export function isSceneId(value: unknown): value is SceneId {
    return typeof value === 'string' && SCENES.some((scene) => scene.id === value);
}

export function getOriginName(origin: OriginId) {
    return ORIGINS.find((candidate) => candidate.id === origin)?.name ?? origin;
}

// Which half of the wall shows coloured travel times in each scene.
export function isHalfRevealed(scene: SceneId, half: WallHalf) {
    if (half === 'with-stairs') return scene === 'with-stairs' || scene === 'step-free';
    return scene === 'step-free';
}

export type WallHalf = 'with-stairs' | 'step-free';

export function sanitizeSharedState(
    candidate: unknown,
    fallback: BusSharedState = DEFAULT_SHARED_STATE
): BusSharedState {
    // Accept each field independently so one bad field never discards a good one.
    if (typeof candidate !== 'object' || candidate === null) return fallback;
    const state = candidate as Partial<Record<keyof BusSharedState, unknown>>;
    return {
        origin: isOriginId(state.origin) ? state.origin : fallback.origin,
        scene: isSceneId(state.scene) ? state.scene : fallback.scene
    };
}
