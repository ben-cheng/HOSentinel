export function formatDisplayTime(timestamp: number): string {
    // Use a fixed locale to prevent test failures across different environments/CI
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
    });
}

export interface TickerRegistration {
    id: string;
    intervalMs: number;
}

/** The shared timer runs at the fastest requested rate, or not at all without tickers. */
export function resolveTickInterval(registrations: TickerRegistration[]): number | null {
    if (registrations.length === 0) return null;
    return Math.min(...registrations.map((item) => item.intervalMs));
}

/** Rounds an epoch timestamp down to the start of its interval. */
export function floorToInterval(timestamp: number, intervalMs: number): number {
    return Math.floor(timestamp / intervalMs) * intervalMs;
}

/** Milliseconds from `timestamp` until the next interval boundary (always > 0). */
export function msUntilNextBoundary(timestamp: number, intervalMs: number): number {
    return intervalMs - (timestamp % intervalMs);
}
