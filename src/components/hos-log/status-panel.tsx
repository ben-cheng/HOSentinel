import { component$, useComputed$ } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
import type { StatusKey } from "~/components/hos-log/hours-of-service";

export type SelectableStatusKey = "O" | "D" | "N";

export const STATUS_OPTIONS: Array<{
  status: SelectableStatusKey;
  label: string;
}> = [
  { status: "O", label: "Off-duty" },
  { status: "D", label: "Driving" },
  { status: "N", label: "On-duty not driving" },
];

function getStatusPanelClass(status: StatusKey, isActive: boolean): string {
  const base =
    "relative flex min-h-36 w-full flex-col items-start justify-between rounded-2xl border p-3 text-left shadow-sm transition duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed sm:p-4";
  const activeStyles: Record<StatusKey, string> = {
    O: "border-slate-300 bg-slate-100 text-slate-900 shadow-slate-200",
    S: "border-violet-200 bg-violet-50 text-violet-950 shadow-violet-100",
    D: "border-blue-200 bg-blue-50 text-blue-950 shadow-blue-100",
    N: "border-amber-200 bg-amber-50 text-amber-950 shadow-amber-100",
  };
  const inactiveStyles =
    "border-slate-200 bg-slate-50 text-slate-500 opacity-65 hover:border-slate-300 hover:bg-white hover:opacity-100";
  return `${base} ${
    isActive ? `${activeStyles[status]} ring-2 ring-blue-200` : inactiveStyles
  }`;
}

interface StatusPanelProps {
  status: SelectableStatusKey;
  label: string;
  currentStatus?: StatusKey;
  currentSince?: string;
  disabled: boolean;
  onAddStatus: QRL<(status: SelectableStatusKey) => Promise<void>>;
}

export const StatusPanel = component$((props: StatusPanelProps) => {
  const isActive = useComputed$(() => props.currentStatus === props.status);

  return (
    <button
      type="button"
      class={getStatusPanelClass(props.status, isActive.value)}
      aria-pressed={isActive.value}
      disabled={props.disabled}
      onClick$={() => props.onAddStatus(props.status)}
    >
      <span class="flex h-6 w-full shrink-0 items-start justify-end">
        <span
          class={`rounded-full bg-blue-700 px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wide text-white sm:text-[0.65rem] ${
            isActive.value ? "" : "invisible"
          }`}
          aria-hidden={!isActive.value}
        >
          Current
        </span>
      </span>
      <span class="flex min-h-8 flex-1 items-center text-xs font-bold leading-tight sm:text-sm">
        {props.label}
      </span>
      <span
        class={`h-5 text-[0.65rem] font-medium text-slate-600 sm:text-xs ${
          isActive.value ? "" : "invisible"
        }`}
        aria-hidden={!isActive.value}
      >
        {isActive.value ? `Since ${props.currentSince}` : ""}
      </span>
    </button>
  );
});
