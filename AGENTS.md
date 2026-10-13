# HOSentinel Project Guide

## Purpose

HOSentinel is a Qwik City app for entering hours-of-service (HOS) status logs
and calculating daily time totals by duty status.

## Stack and commands

- Qwik and Qwik City, built with Vite and TypeScript.
- `npm start` runs the development server.
- `npm run build.types` checks TypeScript.
- `npm run lint` runs ESLint on `src`.
- `npm run test.unit -- --run` runs the Vitest component/parser tests.
- `npm run build` runs the Qwik production build.

## Important files

- `src/routes/index.tsx`: Main log-entry UI, status buttons, and duration display.
- `src/libs/hos-log-normalizer.ts`: Input parsing, interval construction, and
  duration calculation.
- `src/models/duty-status.ts`: Status codes, labels, and duration types.
- `src/models/duty-entry.ts`: Parsed duty interval type.
- `src/components/hos-log-normalizer/hos-log-normalizer.spec.ts`: Duration
  regression test.

## Log format and calculation rules

- Status codes are case-insensitive. Status-first entries such as `O0600` or
  `n0630` assign that status to the interval ending at the given time.
- Input spaces are ignored, so status-first entries can be concatenated
  (for example, `O630N645D900O`) or separated by spaces and line breaks.
- A timestamp-first line such as `0104D` means Driving starts at 01:04. Keep
  each timestamp-first entry on its own line; these are transitions, unlike
  status-first interval-end entries.
- Supported times are `HHmm`/`Hmm` and `HH:mm`/`H:mm`; output intervals use
  normalized `HH:mm`.
- A timed entry's status applies from the previous checkpoint (starting at
  `00:00`) through that entry's time. For example, `N0630` assigns the interval
  ending at `06:30` to On Duty (Not Driving).
- Time entries must be strictly increasing and no later than `24:00`.
- Time after the final timed entry defaults to Off Duty (`O`). A single
  status-only line, such as `O`, changes that trailing/default status. With no
  timed entries, that status covers the full day. Without a status-only line,
  Off Duty is the default.
- More than one status-only entry is invalid.

When changing the parser or these conventions, update the duration tests and
the explanatory copy and examples in `src/routes/index.tsx` together.

## Implementation notes

- Keep parsing and duration logic in the normalizer rather than duplicating it
  in UI components.
- Preserve the existing Qwik patterns and Tailwind utility styling.
- Avoid modifying unrelated staged or untracked work in the working tree.
