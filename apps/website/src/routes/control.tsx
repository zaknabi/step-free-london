import { createFileRoute } from '@tanstack/react-router';

import { Button } from '../components/button';
import { controlEngine } from '../lib/realtime/engines/control-engine';
import { useControlStore } from '../lib/realtime/stores/control-store';
import { ORIGINS, SCENES } from '../lib/realtime/story';

type ControlSearch = {
    // Optional label so multiple control clients can be distinguished in the simulator.
    operator: string;
};

export const Route = createFileRoute('/control')({
    validateSearch: (search: Record<string, unknown>): ControlSearch => {
        return {
            // Default operator id keeps the route usable when query params are omitted.
            operator: typeof search.operator === 'string' ? search.operator : 'A'
        };
    },
    component: ControlPage
});

function ControlPage() {
    // `/control` models a handheld/operator endpoint:
    // - it sends intent (origin station, story scene) into the websocket bus
    // - it does not render the heavy map visuals itself
    const { operator } = Route.useSearch();
    const origin = useControlStore((state) => state.origin);
    const scene = useControlStore((state) => state.scene);

    return (
        <main className="h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
            <div className="flex h-full w-full flex-col gap-3 p-3">
                <header className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2">
                    <div>
                        <p className="text-[10px] tracking-[0.2em] text-[var(--muted-foreground)] uppercase">
                            Operator {operator}
                        </p>
                        <h1 className="text-sm font-semibold">Step-free London</h1>
                    </div>
                    <span className="rounded-full bg-[var(--primary)] px-2 py-1 text-[10px] font-medium text-[var(--primary-foreground)]">
                        /control
                    </span>
                </header>

                <section className="flex gap-4">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-xs text-[var(--muted-foreground)]">Scene</h2>
                        <div className="grid grid-cols-3 gap-2">
                            {SCENES.map((candidate, index) => (
                                <Button
                                    key={candidate.id}
                                    // Scenes reveal the story in order: London, then everyone, then
                                    // step-free side by side.
                                    onClick={() => controlEngine.selectScene(candidate.id)}
                                    variant={scene === candidate.id ? 'highlight' : 'normal'}
                                >
                                    {index + 1}. {candidate.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h2 className="text-xs text-[var(--muted-foreground)]">Starting station</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {ORIGINS.map((candidate) => (
                                <Button
                                    key={candidate.id}
                                    // Each click states the full target origin so every connected
                                    // screen converges on the same view.
                                    onClick={() => controlEngine.selectOrigin(candidate.id)}
                                    variant={origin === candidate.id ? 'highlight' : 'normal'}
                                    className="text-left"
                                >
                                    {candidate.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
