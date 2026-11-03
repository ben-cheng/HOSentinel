import { component$, useVisibleTask$, useContext, useId } from '@qwik.dev/core';
import { TimeContext } from './time-provider';

interface TickerProps {
    /**
     * How often, in milliseconds, this ticker needs `now` refreshed.
     * The provider runs one shared timer at the fastest rate requested.
     * Defaults to 1000ms.
     */
    intervalMs?: number;
}

export const TimeTicker = component$<TickerProps>(({ intervalMs = 1000 }) => {
    const time = useContext(TimeContext);
    // Auto-generates a unique identity string (e.g., "q-0", "q-1") for this specific instance
    const instanceId = useId();

    // Visible tasks are client-only, so SSR never registers (or cleans up) a ticker.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
        time.registerTicker(instanceId, intervalMs);
        cleanup(() => {
            time.unregisterTicker(instanceId);
        });
    }, { strategy: 'document-ready' });

    return null;
});
