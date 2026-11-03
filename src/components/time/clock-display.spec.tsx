import { describe, it, expect } from 'vitest';
import { createDOM } from '@qwik.dev/core/testing';
import { component$, useContext } from '@qwik.dev/core';
import { FakeTimeProvider } from './fake-time-provider';
import { TimeContext } from './time-provider';
import { formatDisplayTime } from './time-utils';

const ClockDisplay = component$(() => {
    const time = useContext(TimeContext);
    return <div data-testid="clock">{formatDisplayTime(time.now)}</div>;
});

describe('FakeTimeProvider', () => {
    it('provides the fixed `now` to consumers', async () => {
        const { render, screen } = await createDOM();
        await render(
            <FakeTimeProvider now={Date.UTC(2026, 10, 2, 12, 30, 0)}>
                <ClockDisplay />
            </FakeTimeProvider>,
        );

        expect(screen.querySelector('[data-testid="clock"]')?.textContent).toBe('12:30 PM');
    });
});
