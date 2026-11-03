import { describe, it, expect } from 'vitest';
import { floorToInterval, formatDisplayTime, msUntilNextBoundary, resolveTickInterval } from './time-utils';

describe('formatDisplayTime()', () => {
    it('should format a timestamp into a human-readable string consistently', () => {
        const mockTimestamp = Date.UTC(2026, 10, 2, 12, 30, 0); // 12:30 PM UTC
        const result = formatDisplayTime(mockTimestamp);

        expect(result).toBe('12:30 PM');
    });
});

describe('resolveTickInterval()', () => {
    it('returns null when no ticker is registered', () => {
        expect(resolveTickInterval([])).toBeNull();
    });

    it('returns the fastest requested interval', () => {
        expect(
            resolveTickInterval([
                { id: 'a', intervalMs: 60_000 },
                { id: 'b', intervalMs: 1000 },
                { id: 'c', intervalMs: 5000 },
            ]),
        ).toBe(1000);
    });
});

describe('interval boundaries', () => {
    const at = Date.UTC(2026, 10, 2, 12, 30, 42);

    it('floors to the start of the interval', () => {
        expect(floorToInterval(at, 60_000)).toBe(Date.UTC(2026, 10, 2, 12, 30, 0));
    });

    it('computes the wait until the next boundary', () => {
        expect(msUntilNextBoundary(at, 60_000)).toBe(18_000);
        expect(msUntilNextBoundary(Date.UTC(2026, 10, 2, 12, 31, 0), 60_000)).toBe(60_000);
    });
});
