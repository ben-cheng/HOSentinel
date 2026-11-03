import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { component$ } from '@qwik.dev/core';
import { FakeTimeProvider } from './fake-time-provider';
import { TimeProvider } from './time-provider';
import { useNow } from './use-now';
import { formatDisplayTime } from './time-utils';

// Pure presentational component: same `now` in, same output out.
const ClockFace = component$((props: { now: number }) => (
    <div data-testid="clock">{formatDisplayTime(props.now)}</div>
));

const MinuteClock = component$(() => {
    const now = useNow(60_000);
    return <ClockFace now={now.value} />;
});

const LiveClock = component$(() => {
    const now = useNow(100);
    return <div id="now">{now.value}</div>;
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('ClockFace (pure)', () => {
    it('renders the same output for the same `now`', async () => {
        const { render, screen } = await createDOM();
        await render(<ClockFace now={Date.UTC(2026, 10, 2, 12, 30, 0)} />);
        expect(screen.querySelector('[data-testid="clock"]')?.textContent).toBe('12:30 PM');
    });
});

describe('useNow()', () => {
    it('is deterministic under FakeTimeProvider and floors to the interval', async () => {
        const { render, screen } = await createDOM();
        await render(
            <FakeTimeProvider now={Date.UTC(2026, 10, 2, 12, 30, 42)}>
                <MinuteClock />
            </FakeTimeProvider>,
        );
        expect(screen.querySelector('[data-testid="clock"]')?.textContent).toBe('12:30 PM');
    });

    it('ticks on interval boundaries under the real TimeProvider', async () => {
        const { render, screen } = await createDOM();
        await render(
            <TimeProvider>
                <LiveClock />
            </TimeProvider>,
        );
        const first = Number(screen.querySelector('#now')?.textContent);
        expect(first % 100).toBe(0);

        await delay(350);
        const later = Number(screen.querySelector('#now')?.textContent);
        expect(later).toBeGreaterThan(first);
        expect(later % 100).toBe(0);
    });
});
