import { createContextId } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import type { TickerRegistration } from "../../time/time-utils";

export interface HosContextValue {
    tickerRegistrations: TickerRegistration[];
    // Store members must be serializable, so these are QRLs that capture only
    // `tickerRegistrations` (capturing the store itself breaks rendering).
    registerTicker: QRL<(id: string, intervalMs: number) => void>;
    unregisterTicker: QRL<(id: string) => void>;
}

export const HosContext = createContextId<HosContextValue>('hos-context');
