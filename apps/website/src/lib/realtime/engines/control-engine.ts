import { controlStore } from '../stores/control-store';
import { sanitizeSharedState } from '../story';
import type {
    BusMessage,
    BusSharedState,
    ControlOriginMessage,
    ControlSceneMessage,
    ControlStoreState,
    HelloBusMessage,
    OriginId,
    SceneId
} from '../types';
import { BusEngine } from './bus-engine';

export class ControlEngine extends BusEngine<ControlStoreState> {
    private constructor() {
        super('control', controlStore);
    }

    static getInstance() {
        const globalWithControlEngine = globalThis as typeof globalThis & {
            __controlEngineInstance?: ControlEngine;
        };

        if (!globalWithControlEngine.__controlEngineInstance) {
            globalWithControlEngine.__controlEngineInstance = new ControlEngine();
        }

        return globalWithControlEngine.__controlEngineInstance;
    }

    selectOrigin(origin: OriginId) {
        if (!this.applySharedState({ origin })) return;
        // Commands state the full target ("origin is X"), never a relative step ("next origin"),
        // so a duplicated or replayed message can't push screens out of step.
        const message: ControlOriginMessage = {
            type: 'control/origin',
            origin,
            peerId: this.getPeerId() ?? undefined
        };
        this.send(message);
    }

    selectScene(scene: SceneId) {
        if (!this.applySharedState({ scene })) return;
        const message: ControlSceneMessage = {
            type: 'control/scene',
            scene,
            peerId: this.getPeerId() ?? undefined
        };
        this.send(message);
    }

    protected override onMessage(message: BusMessage) {
        // Mirror other operators' commands so every control client shows the shared state.
        if (message.type === 'control/origin') {
            this.applySharedState({ origin: message.origin });
            return;
        }

        if (message.type === 'control/scene') {
            this.applySharedState({ scene: message.scene });
        }
    }

    protected override onHello(hello: HelloBusMessage) {
        // Rehydrate control UI from bus snapshot so newly opened tablets are immediately in sync.
        this.applySharedState(hello.state);
    }

    /** Returns true when the shared state actually changed. */
    private applySharedState(patch: unknown) {
        let changed = false;
        this.store.setState((prev) => {
            const current: BusSharedState = { origin: prev.origin, scene: prev.scene };
            const next = sanitizeSharedState({ ...current, ...(patch as object) }, current);
            if (next.origin === prev.origin && next.scene === prev.scene) return prev;
            changed = true;
            return { ...prev, ...next };
        });
        return changed;
    }
}

export const controlEngine = ControlEngine.getInstance();
