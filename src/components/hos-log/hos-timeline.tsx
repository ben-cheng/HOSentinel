import { component$, useComputed$, useSignal, $ } from "@qwik.dev/core";
import {
  STATUS_LABEL,
  createEmptyStatusDuration,
  type StatusKey,
} from "./hours-of-service";
import { parseLogs } from "./hos-log-normalizer";
import { toTimelineIntervals, type TimelineInterval } from "./timeline-intervals";

interface HosTimelineProps {
  /** Raw log text (the same string stored/edited elsewhere). */
  log: string;
  cutoffMinute?: number;
}

// Sleeper is not used right now, so it has no row.
const ROWS: StatusKey[] = ["O", "D", "N"];

const LABEL_WIDTH = 74;
const TOTAL_WIDTH = 44;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 26;
const COMPACT_HOUR_WIDTH = 24;
const FULL_HOUR_WIDTH = 44;

function yOf(status: StatusKey): number {
  return HEADER_HEIGHT + ROWS.indexOf(status) * ROW_HEIGHT + ROW_HEIGHT / 2;
}

function getTotals(intervals: TimelineInterval[], cutoff: number) {
  const duration = createEmptyStatusDuration();
  for (const { start, end, status } of intervals) {
    duration[status] += Math.max(0, Math.min(end, cutoff) - start);
  }
  return duration;
}

// Decimal hours in hundredths; a complete day is forced to total exactly 24.00.
export function getTotalHundredths(
  duration: Record<StatusKey, number>,
): Record<StatusKey, number> {
  const hundredths = Object.fromEntries(
    (Object.keys(duration) as StatusKey[]).map((key) => [
      key,
      Math.round((duration[key] * 100) / 60),
    ]),
  ) as Record<StatusKey, number>;
  const minutes = Object.values(duration).reduce((sum, m) => sum + m, 0);
  if (minutes === 1440) {
    const diff =
      2400 - Object.values(hundredths).reduce((sum, h) => sum + h, 0);
    if (diff > 0) hundredths.D += diff;
    else hundredths.O += diff;
  }
  return hundredths;
}

function isDrawn(interval: TimelineInterval): boolean {
  return ROWS.includes(interval.status);
}

export function buildTimelinePath(
  intervals: TimelineInterval[],
  hourWidth: number,
  cutoff: number,
): string {
  const xAt = (minute: number) => LABEL_WIDTH + (minute / 60) * hourWidth;
  return intervals
    .filter((interval) => isDrawn(interval) && interval.start < cutoff)
    .map((interval, i) => {
      const y = yOf(interval.status);
      return `${i === 0 ? "M" : "L"}${xAt(interval.start)},${y} L${xAt(Math.min(interval.end, cutoff))},${y}`;
    })
    .join(" ");
}

interface TimelineSvgProps {
  intervals: TimelineInterval[];
  hourWidth: number;
  fit: boolean;
  cutoffMinute: number;
}

const TimelineSvg = component$((props: TimelineSvgProps) => {
  const hourWidth = props.hourWidth;
  const xAt = (minute: number) => LABEL_WIDTH + (minute / 60) * hourWidth;
  const width = LABEL_WIDTH + hourWidth * 24 + TOTAL_WIDTH;
  const height = HEADER_HEIGHT + ROW_HEIGHT * ROWS.length + 4;

  const totals = useComputed$(() =>
    getTotalHundredths(getTotals(props.intervals, props.cutoffMinute)),
  );
  return (
    <svg
      width={props.fit ? "100%" : width}
      height={props.fit ? undefined : height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="24-hour duty status timeline"
    >
      {ROWS.map((key, index) => (
        <g key={key}>
          <rect
            x={0}
            y={HEADER_HEIGHT + index * ROW_HEIGHT}
            width={width}
            height={ROW_HEIGHT}
            class={index % 2 ? "fill-slate-50" : "fill-white"}
          />
          <text
            x={4}
            y={yOf(key) + (/\(.*\)$/.test(STATUS_LABEL[key]) ? -1 : 4)}
            class="fill-slate-700 text-[12px] font-medium"
          >
            {STATUS_LABEL[key].replace(/\s*\(.*\)$/, "")}
            {/\(.*\)$/.test(STATUS_LABEL[key]) && (
              <tspan x={4} dy={11} class="text-[9px]">
                {STATUS_LABEL[key].match(/\(.*\)$/)![0]}
              </tspan>
            )}
          </text>
          <text
            x={width - 4}
            y={yOf(key) + 4}
            text-anchor="end"
            class="fill-slate-700 text-[12px] font-semibold"
          >
            {(totals.value[key] / 100).toFixed(2)}
          </text>
        </g>
      ))}
      {Array.from({ length: 96 }, (_, quarter) =>
        quarter % 4 === 0 ? null : (
          <line
            key={`q${quarter}`}
            x1={xAt(quarter * 15)}
            x2={xAt(quarter * 15)}
            y1={HEADER_HEIGHT - (quarter % 2 === 0 ? 6 : 3)}
            y2={HEADER_HEIGHT}
            class="stroke-slate-400"
          />
        ),
      )}
      {Array.from({ length: 25 }, (_, hour) => (
        <g key={hour}>
          <line
            x1={xAt(hour * 60)}
            x2={xAt(hour * 60)}
            y1={HEADER_HEIGHT - 9}
            y2={height - 4}
            class="stroke-slate-300"
          />
          {hour % (props.fit ? 3 : 2) === 0 && (
            <text
              x={xAt(hour * 60)}
              y={10}
              text-anchor="middle"
              class="fill-slate-500 text-[10px]"
            >
              {String(hour).padStart(2, "0")}
            </text>
          )}
        </g>
      ))}
      <path
        d={buildTimelinePath(props.intervals, hourWidth, props.cutoffMinute)}
        fill="none"
        class="stroke-blue-600"
        stroke-width={2.5}
        stroke-linejoin="miter"
      />
    </svg>
  );
});

function toIntervals(log: string): TimelineInterval[] {
  try {
    return toTimelineIntervals(parseLogs(log).value);
  } catch {
    return [];
  }
}

export const HosTimeline = component$((props: HosTimelineProps) => {
  const isOpen = useSignal(false);
  const zoom = useSignal(1);
  const intervals = useComputed$(() => toIntervals(props.log));
  const cutoff = props.cutoffMinute ?? 1440;

  const open = $(() => {
    zoom.value = 1;
    isOpen.value = true;
  });

  return (
    <>
      <button
        type="button"
        class="block w-full cursor-zoom-in rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-blue-300"
        aria-label="Open full-size timeline"
        onClick$={open}
      >
        <TimelineSvg
          intervals={intervals.value}
          hourWidth={COMPACT_HOUR_WIDTH}
          cutoffMinute={cutoff}
          fit
        />
      </button>
      {isOpen.value && (
        <div
          class="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4"
          onClick$={() => (isOpen.value = false)}
        >
          <section
            class="max-h-full w-full max-w-6xl overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/20"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hos-timeline-title"
            onClick$={(event) => event.stopPropagation()}
          >
            <div class="mb-2 flex items-center justify-between">
              <h2
                id="hos-timeline-title"
                class="text-xl font-bold tracking-tight text-slate-900"
              >
                Timeline
              </h2>
              <div class="flex gap-2">
                <div class="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700">
                  <button
                    type="button"
                    class="px-3 py-2 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Zoom out"
                    disabled={zoom.value <= 0.5}
                    onClick$={() =>
                      (zoom.value = Math.max(0.5, zoom.value - 0.25))
                    }
                  >
                    −
                  </button>
                  <span class="min-w-12 text-center tabular-nums">
                    {Math.round(zoom.value * 100)}%
                  </span>
                  <button
                    type="button"
                    class="px-3 py-2 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Zoom in"
                    disabled={zoom.value >= 3}
                    onClick$={() =>
                      (zoom.value = Math.min(3, zoom.value + 0.25))
                    }
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick$={() => (isOpen.value = false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div class="overflow-x-auto">
              <TimelineSvg
                intervals={intervals.value}
                hourWidth={FULL_HOUR_WIDTH * zoom.value}
                cutoffMinute={cutoff}
                fit={false}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
});
