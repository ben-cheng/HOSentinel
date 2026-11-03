import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { component$, useStore, useContext } from '@qwik.dev/core';
import { TimeProvider, TimeContext } from './time-provider';
import { TimeTicker } from './time-ticker';

// Components live at module scope: inline component$ definitions can't be resolved by createDOM.
const ShareTicker = component$(() => <TimeTicker intervalMs={1000} />);

const TickerStateProbe = component$(() => {
    const time = useContext(TimeContext);
    return (
        <div>
            <span id="active-count">{time.tickerRegistrations.length}</span>
            <span id="current-time">{time.now}</span>
        </div>
    );
});

const Fast = component$(() => <TimeTicker intervalMs={100} />);

const SpeedHarness = component$(() => {
    const ui = useStore({ showFast: true });

    return (
        <TimeProvider>
            <TickerStateProbe />
            <ShareTicker />
            {ui.showFast && <Fast />}
            <button id="unmount-fast" onClick$={() => (ui.showFast = false)}>
                Unmount Fast
            </button>
        </TimeProvider>
    );
});

const AllUnmountHarness = component$(() => {
    const ui = useStore({ show: true });

    return (
        <TimeProvider>
            <TickerStateProbe />
            {ui.show && <ShareTicker />}
            <button id="unmount-all" onClick$={() => (ui.show = false)}>
                Unmount all
            </button>
        </TimeProvider>
    );
});

const Harness = component$(() => {
    const ui = useStore({ showFoo: true, showBar: true });

    return (
        <TimeProvider>
            <TickerStateProbe />
            {ui.showFoo && <div id="foo"><ShareTicker /></div>}
            {ui.showBar && <div id="bar"><ShareTicker /></div>}
            <button id="unmount-foo" onClick$={() => (ui.showFoo = false)}>
                Unmount Foo
            </button>
        </TimeProvider>
    );
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TimeTicker shared cleanup', () => {
    it('unregisters only the unmounted ticker and keeps the clock ticking for the remaining one', async () => {
        const { render, screen, userEvent } = await createDOM();
        await render(<Harness />);

        expect(screen.querySelector('#active-count')?.textContent).toBe('2');
        const initialTime = screen.querySelector('#current-time')?.textContent;

        await userEvent('#unmount-foo', 'click');
        await delay(50);

        // Foo's registration is removed; Bar's is untouched.
        expect(screen.querySelector('#active-count')?.textContent).toBe('1');
        expect(screen.querySelector('#foo')).toBeFalsy();
        expect(screen.querySelector('#bar')).toBeTruthy();

        // Wait past one 1000ms interval: the shared timer must still be running for Bar.
        await delay(1050);

        const laterTime = screen.querySelector('#current-time')?.textContent;
        expect(Number(laterTime)).toBeGreaterThan(Number(initialTime));
    });

    it('ticks at the fastest requested rate and falls back to the slower one after it unmounts', async () => {
        const { render, screen, userEvent } = await createDOM();
        await render(<SpeedHarness />);

        const readTime = () => Number(screen.querySelector('#current-time')?.textContent);

        // Fast (100ms) wins over Foo (1000ms): the clock advances well before one second.
        const before = readTime();
        await delay(350);
        expect(readTime()).toBeGreaterThan(before);

        // Without Fast, the shared timer slows to 1000ms: no update inside 350ms.
        await userEvent('#unmount-fast', 'click');
        await delay(50);
        const afterUnmount = readTime();
        await delay(350);
        expect(readTime()).toBe(afterUnmount);
    });

    it('stops the shared timer once every ticker has unmounted', async () => {
        const { render, screen, userEvent } = await createDOM();
        await render(<AllUnmountHarness />);

        await userEvent('#unmount-all', 'click');
        await delay(50);
        expect(screen.querySelector('#active-count')?.textContent).toBe('0');

        const stopped = screen.querySelector('#current-time')?.textContent;
        await delay(1200);
        expect(screen.querySelector('#current-time')?.textContent).toBe(stopped);
    });
});
