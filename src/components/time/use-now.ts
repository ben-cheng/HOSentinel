import { useComputed$, useContext, useId, useVisibleTask$ } from '@qwik.dev/core';
import { TimeContext } from './time-provider';
import { floorToInterval } from './time-utils';

/**
 * Epoch ms floored to `intervalMs`; the signal only changes once per interval.
 * Registers with the nearest TimeProvider (replacing the old TimeTicker) and
 * unregisters on unmount. Pass the value to pure components as a `now` prop;
 * tests swap the provider for FakeTimeProvider to freeze time.
 */
export function useNow(intervalMs = 1000) {
    const time = useContext(TimeContext);
    const id = useId();

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
        time.registerTicker(id, intervalMs);
        cleanup(() => time.unregisterTicker(id));
    }, { strategy: 'document-ready' });

    return useComputed$(() => floorToInterval(time.now, intervalMs));
}
