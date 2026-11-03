import { $, component$, useStore, useContextProvider, Slot } from '@qwik.dev/core';
import { TimeContext, type TimeContextValue } from './time-provider';

/** Test double: provides a fixed `now` and never ticks. */
export const FakeTimeProvider = component$((props: { now: number }) => {
    const time = useStore<TimeContextValue>({
        now: props.now,
        tickerRegistrations: [],
        registerTicker: $(() => {}),
        unregisterTicker: $(() => {}),
    });

    useContextProvider(TimeContext, time);

    return <Slot />;
});
