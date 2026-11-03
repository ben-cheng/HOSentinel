import { $, component$, createContextId, Slot, useComputed$, useContextProvider, useStore, useVisibleTask$ } from '@qwik.dev/core';
import type { QRL } from '@qwik.dev/core';
import { msUntilNextBoundary, resolveTickInterval, type TickerRegistration } from './time-utils';

export interface TimeContextValue {
    /** Epoch milliseconds, refreshed at the fastest rate any mounted useNow() requests. */
    now: number;
    tickerRegistrations: TickerRegistration[];
    // Store members must be serializable, so these are QRLs that capture only
    // `tickerRegistrations` (capturing the store itself breaks rendering).
    registerTicker: QRL<(id: string, intervalMs: number) => void>;
    unregisterTicker: QRL<(id: string) => void>;
}

export const TimeContext = createContextId<TimeContextValue>('time-context');

export const TimeProvider = component$(() => {
    const tickerRegistrations = useStore<TickerRegistration[]>([]);
    const tickIntervalMs = useComputed$(() => resolveTickInterval(tickerRegistrations));

    const time = useStore<TimeContextValue>({
        now: Date.now(),
        tickerRegistrations,
        registerTicker: $((id: string, intervalMs: number) => {
            tickerRegistrations.push({ id, intervalMs });
        }),
        unregisterTicker: $((id: string) => {
            const index = tickerRegistrations.findIndex((item) => item.id === id);
            if (index !== -1) tickerRegistrations.splice(index, 1);
        }),
    });

    useContextProvider(TimeContext, time);

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track, cleanup }) => {
        const intervalMs = track(tickIntervalMs);
        if (intervalMs === null) return;

        let timer: ReturnType<typeof setTimeout>;
        // Aim each tick at the next interval boundary so early/late firing self-corrects.
        const schedule = () => {
            timer = setTimeout(() => {
                time.now = Date.now();
                schedule();
            }, msUntilNextBoundary(Date.now(), intervalMs));
        };
        schedule();
        cleanup(() => clearTimeout(timer));
    }, { strategy: 'document-ready' });

    return <Slot />;
});
