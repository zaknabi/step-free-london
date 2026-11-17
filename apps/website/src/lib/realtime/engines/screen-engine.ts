import { loadStepFreeDataset } from '../step-free-data';
import { screenStore } from '../stores/screen-store';
import { sanitizeSharedState } from '../story';
import type { BusMessage, BusSharedState, HelloBusMessage, ScreenStoreState } from '../types';
import { BusEngine } from './bus-engine';

export class ScreenEngine extends BusEngine<ScreenStoreState> {
    // Guards repeated fetches during retries/rerenders.
    private hasAttemptedDatasetLoad = false;

    private constructor() {
        super('screen', screenStore);
        // Prime dataset early so first render after route mount has data asap.
        void this.ensureDatasetLoaded();
    }

    static getInstance() {
        const globalWithScreenEngine = globalThis as typeof globalThis & {
            __screenEngineInstance?: ScreenEngine;
        };

        if (!globalWithScreenEngine.__screenEngineInstance) {
            globalWithScreenEngine.__screenEngineInstance = new ScreenEngine();
        }

        return globalWithScreenEngine.__screenEngineInstance;
    }

    async ensureDatasetLoaded() {
        if (typeof window === 'undefined') return;
        if (this.hasAttemptedDatasetLoad || this.store.state.dataset) return;

        this.hasAttemptedDatasetLoad = true;
        this.store.setState((prev) => ({
            ...prev,
            isDatasetLoading: true
        }));

        const dataset = await loadStepFreeDataset();
        if (!dataset) {
            // Reset guard so a later remount / reconnect can retry loading data.
            this.hasAttemptedDatasetLoad = false;
        }
        this.store.setState((prev) => ({
            ...prev,
            dataset: dataset ?? prev.dataset,
            isDatasetLoading: false
        }));
    }

    protected override onMessage(message: BusMessage) {
        if (message.type === 'control/origin') {
            this.applySharedState({ origin: message.origin });
            return;
        }

        if (message.type === 'control/scene') {
            this.applySharedState({ scene: message.scene });
        }
    }

    protected override onHello(hello: HelloBusMessage) {
        // Apply the same sanitizing path used for live events so hello-state and realtime updates
        // follow one code path and stay behaviorally consistent.
        this.applySharedState(hello.state);
    }

    private applySharedState(patch: unknown) {
        this.store.setState((prev) => {
            const current: BusSharedState = { origin: prev.origin, scene: prev.scene };
            // Invalid fields fall back to the current value, so bad input never changes the wall.
            const next = sanitizeSharedState({ ...current, ...(patch as object) }, current);
            if (next.origin === prev.origin && next.scene === prev.scene) return prev;
            return { ...prev, ...next };
        });
    }
}

export const screenEngine = ScreenEngine.getInstance();
