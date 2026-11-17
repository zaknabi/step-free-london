import { DEFAULT_SHARED_STATE } from './story';

export type BusMessage = {
    // Keep message kinds namespaced (`control/*`, `screen/*`).
    type: string;
    peerId?: string;
    peerCount?: number;
    [key: string]: unknown;
};

export type HelloBusMessage = BusMessage & {
    type: 'hello';
    peerId: string;
    state?: BusSharedState;
};

// NaPTAN ids of the origin stations analysed in scripts/step_free.
export type OriginId = '940GZZLUSKS' | '940GZZLUWYP' | '940GZZLUSTD' | '940GZZLUBXN';

export type SceneId = 'london' | 'everyone' | 'step-free';

export type ControlOriginMessage = BusMessage & {
    type: 'control/origin';
    origin: OriginId;
};

export type ControlSceneMessage = BusMessage & {
    type: 'control/scene';
    scene: SceneId;
};

export type BusSharedState = {
    origin: OriginId;
    scene: SceneId;
};

export type ScreenMapViewState = {
    longitude: number;
    latitude: number;
    zoom: number;
    bearing: number;
    pitch: number;
};

export type Station = {
    id: string;
    name: string;
    lon: number;
    lat: number;
};

export type OriginTimes = {
    id: OriginId;
    name: string;
    // Index into `StepFreeDataset.stations` of the origin's own station.
    stationIndex: number;
    // Minutes per station, aligned with `stations`; null means no journey was found.
    any: Array<number | null>;
    stepFree: Array<number | null>;
};

export type StepFreeDataset = {
    departure: string;
    reachThresholdMin: number;
    stations: Station[];
    origins: OriginTimes[];
};

export type EngineRole = 'screen' | 'control';

export type EngineConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export type EngineStoreState = {
    role: EngineRole;
    peerId: string | null;
    connection: EngineConnectionState;
    messageCount: number;
    lastMessageType: string | null;
    lastMessageAt: number | null;
    lastError: string | null;
};

export const createInitialEngineStoreState = (role: EngineRole): EngineStoreState => ({
    role,
    peerId: null,
    connection: 'idle',
    messageCount: 0,
    lastMessageType: null,
    lastMessageAt: null,
    lastError: null
});

export type ControlStoreState = EngineStoreState & BusSharedState;

export type ScreenStoreState = EngineStoreState &
    BusSharedState & {
        dataset: StepFreeDataset | null;
        isDatasetLoading: boolean;
    };

export const createInitialControlStoreState = (): ControlStoreState => ({
    ...createInitialEngineStoreState('control'),
    ...DEFAULT_SHARED_STATE
});

export const createInitialScreenStoreState = (): ScreenStoreState => ({
    ...createInitialEngineStoreState('screen'),
    ...DEFAULT_SHARED_STATE,
    dataset: null,
    isDatasetLoading: false
});
