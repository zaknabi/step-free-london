import { createFileRoute } from '@tanstack/react-router';
import { defineHooks } from 'crossws';

import type { BusMessage, BusSharedState } from '../lib/realtime';
import { DEFAULT_SHARED_STATE, isOriginId, isSceneId } from '../lib/realtime/story';

// In-memory bus state for this server process.
// New clients receive this snapshot in the `hello` handshake so they can
// join late without waiting for another control interaction.
const busSharedState: BusSharedState = { ...DEFAULT_SHARED_STATE };

const hooks = defineHooks({
    open(peer) {
        // `hello` is our bootstrap packet:
        // it communicates peer identity + current collaborative state.
        peer.send({
            type: 'hello',
            peerId: peer.id,
            state: busSharedState
        });

        // All collaborating clients publish/subscribe on one logical channel (`do`).
        // This keeps the demo simple while still showing fan-out semantics.
        peer.subscribe('do');
        peer.publish('do', {
            type: 'peer',
            peerId: peer.id,
            peerCount: peer.peers.size
        });
    },
    message(peer, message) {
        // Ignore malformed payloads; only valid JSON objects enter the shared-state path.
        let payload: Partial<BusMessage>;
        try {
            const parsed = message.json() as unknown;
            if (typeof parsed !== 'object' || parsed === null) return;
            payload = parsed as Partial<BusMessage>;
        } catch {
            return;
        }
        // Drop anything that isn't a valid story command instead of relaying it to every screen,
        // and forward only the validated fields, never the raw payload.
        const command = applyStoryCommand(payload);
        if (!command) return;

        // Broadcast to all peers. Each client engine can ignore own echoes via peerId.
        peer.publish('do', {
            ...command,
            peerId: peer.id,
            peerCount: peer.peers.size
        });
    },
    close(peer) {
        peer.publish('do', {
            type: 'bye',
            peerId: peer.id,
            peerCount: peer.peers.size
        });
        peer.unsubscribe('do');
    }
});

function applyStoryCommand(payload: Partial<BusMessage>): BusMessage | null {
    // Only known message types with valid values may change the snapshot late joiners receive.
    if (payload.type === 'control/origin' && isOriginId(payload.origin)) {
        busSharedState.origin = payload.origin;
        return { type: payload.type, origin: payload.origin };
    }
    if (payload.type === 'control/scene' && isSceneId(payload.scene)) {
        busSharedState.scene = payload.scene;
        return { type: payload.type, scene: payload.scene };
    }
    return null;
}

export const Route = createFileRoute('/bus')({
    server: {
        handlers: {
            GET: async () => {
                // HTTP fallback response: this endpoint is a websocket upgrade target.
                return Object.assign(
                    new Response('WebSocket upgrade is required.', {
                        status: 426
                    }),
                    {
                        crossws: hooks
                    }
                );
            }
        }
    }
});
