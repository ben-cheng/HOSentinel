import { component$, useComputed$, useSignal, $ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import {
  STATUS_LABEL,
  createEmptyStatusDuration,
  type DutyEntry,
  type StatusKey,
} from "./hours-of-service";
import {
  addStatusAt,
  clampNodeMinute,
  formatMinute,
  moveNode,
  SNAP_MINUTES,
  removeNode,
  toLogText,
  toTimelineIntervals,
  type TimelineInterval,
} from "./hos-timeline-edit";

interface HosTimelineProps {
  entries: DutyEntry[];
  cutoffMinute?: number;
  onSave?: QRL<(logText: string) => Promise<boolean>>;
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

function toSvgPoint(
  svg: SVGSVGElement,
  event: PointerEvent | MouseEvent,
  width: number,
  hourWidth: number,
) {
  const box = svg.getBoundingClientRect();
  const scale = width / box.width;
  return {
    minute:
      (((event.clientX - box.left) * scale - LABEL_WIDTH) / hourWidth) * 60,
    y: (event.clientY - box.top) * scale,
  };
}

interface TimelineSvgProps {
  intervals: TimelineInterval[];
  hourWidth: number;
  fit: boolean;
  cutoffMinute: number;
  editable?: boolean;
  onAdd?: QRL<(minute: number, status: StatusKey) => void>;
  onRemove?: QRL<(index: number) => void>;
  onMove?: QRL<(index: number, minute: number) => void>;
}

const TimelineSvg = component$((props: TimelineSvgProps) => {
  const hourWidth = props.hourWidth;
  const xAt = (minute: number) => LABEL_WIDTH + (minute / 60) * hourWidth;
  const width = LABEL_WIDTH + hourWidth * 24 + TOTAL_WIDTH;
  const height = HEADER_HEIGHT + ROW_HEIGHT * ROWS.length + 4;

  const hoverIndex = useSignal(-1);
  const dragIndex = useSignal(-1);
  const dragMinute = useSignal(0);

  const view = useComputed$(() =>
    dragIndex.value >= 0
      ? moveNode(props.intervals, dragIndex.value, dragMinute.value)
      : props.intervals,
  );

  const totals = useComputed$(() =>
    getTotalHundredths(getTotals(view.value, props.cutoffMinute)),
  );
  const labelIndex = dragIndex.value >= 0 ? dragIndex.value : hoverIndex.value;
  const labelInterval = labelIndex >= 0 ? view.value[labelIndex] : undefined;

  return (
    <svg
      width={props.fit ? "100%" : width}
      height={props.fit ? undefined : height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="24-hour duty status timeline"
      style={props.editable ? { touchAction: "pan-x pan-y" } : undefined}
      onPointerMove$={(event, svg) => {
        if (dragIndex.value < 0) return;
        const { minute } = toSvgPoint(
          svg as unknown as SVGSVGElement,
          event,
          width,
          hourWidth,
        );
        const latest = Math.max(
          props.intervals[dragIndex.value].start + SNAP_MINUTES,
          Math.floor(props.cutoffMinute / SNAP_MINUTES) * SNAP_MINUTES,
        );
        dragMinute.value = Math.min(
          latest,
          clampNodeMinute(props.intervals, dragIndex.value, minute),
        );
      }}
      onPointerUp$={async () => {
        const index = dragIndex.value;
        if (index < 0) return;
        const moved = dragMinute.value !== props.intervals[index].end;
        dragIndex.value = -1;
        if (moved) await props.onMove?.(index, dragMinute.value);
        else await props.onRemove?.(index);
      }}
      onPointerCancel$={() => (dragIndex.value = -1)}
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
        d={buildTimelinePath(view.value, hourWidth, props.cutoffMinute)}
        fill="none"
        class="stroke-blue-600"
        stroke-width={2.5}
        stroke-linejoin="miter"
      />
      {props.editable && (
        <rect
          x={LABEL_WIDTH}
          y={HEADER_HEIGHT}
          width={hourWidth * 24}
          height={ROW_HEIGHT * ROWS.length}
          fill="transparent"
          class="cursor-crosshair"
          onClick$={async (event, rect) => {
            const svg = (rect as unknown as SVGElement).ownerSVGElement!;
            const { minute, y } = toSvgPoint(svg, event, width, hourWidth);
            const row = Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT);
            if (row < 0 || row >= ROWS.length || minute > props.cutoffMinute)
              return;
            await props.onAdd?.(minute, ROWS[row]);
          }}
        />
      )}
      {props.editable &&
        view.value.map(
          (interval, index) =>
            index < view.value.length - 1 &&
            isDrawn(interval) &&
            interval.end < props.cutoffMinute && (
              <circle
                key={`node-${index}`}
                cx={xAt(interval.end)}
                cy={yOf(interval.status)}
                r={6}
                class="cursor-grab fill-white stroke-blue-600 hover:fill-blue-100"
                stroke-width={2}
                style={{ touchAction: "none" }}
                onPointerEnter$={() => (hoverIndex.value = index)}
                onPointerLeave$={() => (hoverIndex.value = -1)}
                onPointerDown$={(event, circle) => {
                  dragIndex.value = index;
                  dragMinute.value = props.intervals[index].end;
                  (
                    circle as unknown as SVGElement
                  ).ownerSVGElement?.setPointerCapture(event.pointerId);
                }}
              />
            ),
        )}
      {labelInterval && isDrawn(labelInterval) && (
        <g pointer-events="none">
          <rect
            x={xAt(labelInterval.end) - 22}
            y={yOf(labelInterval.status) - 30}
            width={44}
            height={18}
            rx={4}
            class="fill-slate-900"
          />
          <text
            x={xAt(labelInterval.end)}
            y={yOf(labelInterval.status) - 17}
            text-anchor="middle"
            class="fill-white text-[11px] font-medium"
          >
            {formatMinute(labelInterval.end)}
          </text>
        </g>
      )}
    </svg>
  );
});

export const HosTimeline = component$((props: HosTimelineProps) => {
  const isOpen = useSignal(false);
  const draft = useSignal<TimelineInterval[]>([]);
  const saveError = useSignal<string | null>(null);
  const isSaving = useSignal(false);
  const baseline = useSignal("");
  const isEditing = useSignal(false);
  const zoom = useSignal(1);

  const compactIntervals = useComputed$(() =>
    toTimelineIntervals(props.entries),
  );
  const isDirty = useComputed$(() => toLogText(draft.value) !== baseline.value);

  const open = $(() => {
    draft.value = toTimelineIntervals(props.entries);
    baseline.value = toLogText(draft.value);
    saveError.value = null;
    isEditing.value = false;
    zoom.value = 1;
    isOpen.value = true;
  });

  const save = $(async () => {
    if (!props.onSave) return;
    isSaving.value = true;
    saveError.value = null;
    try {
      const saved = await props.onSave(toLogText(draft.value));
      if (saved) isOpen.value = false;
      else saveError.value = "The log could not be saved. Please try again.";
    } catch (cause) {
      saveError.value =
        cause instanceof Error
          ? `The log could not be saved: ${cause.message}`
          : "The log could not be saved. Please try again.";
    } finally {
      isSaving.value = false;
    }
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
          intervals={compactIntervals.value}
          hourWidth={COMPACT_HOUR_WIDTH}
          cutoffMinute={props.cutoffMinute ?? 1440}
          fit
        />
      </button>
      {isOpen.value && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
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
              <div class="flex flex-wrap justify-end gap-2">
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
                {props.onSave && (
                  <button
                    type="button"
                    aria-pressed={isEditing.value}
                    class={[
                      "rounded-xl border px-4 py-2 text-sm font-semibold",
                      isEditing.value
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                    ]}
                    onClick$={() => (isEditing.value = !isEditing.value)}
                  >
                    {isEditing.value ? "Editing" : "Edit"}
                  </button>
                )}
                <button
                  type="button"
                  class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick$={() => (isOpen.value = false)}
                >
                  {isDirty.value ? "Cancel" : "Close"}
                </button>
                {props.onSave && (
                  <button
                    type="button"
                    class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={!isDirty.value || isSaving.value}
                    onClick$={save}
                  >
                    {isSaving.value ? "Saving..." : "Save"}
                  </button>
                )}
              </div>
            </div>
            {props.onSave && isEditing.value && (
              <p class="mb-3 text-sm text-slate-500">
                Click a row to set a status at that time (15-minute steps),
                click a node to remove it, or drag a node to change its time.
              </p>
            )}
            {saveError.value && (
              <p
                role="alert"
                class="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {saveError.value}
              </p>
            )}
            <div class="overflow-x-auto">
              <TimelineSvg
                intervals={draft.value}
                hourWidth={FULL_HOUR_WIDTH * zoom.value}
                cutoffMinute={props.cutoffMinute ?? 1440}
                fit={false}
                editable={Boolean(props.onSave) && isEditing.value}
                onAdd={$((minute: number, status: StatusKey) => {
                  draft.value = addStatusAt(draft.value, minute, status);
                })}
                onRemove={$((index: number) => {
                  draft.value = removeNode(draft.value, index);
                })}
                onMove={$((index: number, minute: number) => {
                  draft.value = moveNode(draft.value, index, minute);
                })}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
});
