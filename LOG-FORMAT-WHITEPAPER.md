# HOSentinel Daily Log Format

**Status:** Agreed behavior contract

**Purpose:** Define the meaning and canonical representation of daily HOS logs
before further parser or status-button changes are made.

## 1. Summary

The canonical daily log contains a date header, zero or more timed status
entries, and an optional temporary status:

```text
{log-day: YYYYMMDD}
{status}{end-time}
...
{temporary-status}
```

- Each timed entry assigns its status to the interval from the previous
  boundary through its end time.
- Time not assigned another status is Off-duty (`O`).
- A final status without a time is temporary on the current day. It applies
  from the last boundary through the current local time; the remainder of the
  day is Off-duty.
- For a log whose date is in the past, a final temporary status is extended
  through `2400`.
- Input without a date header is interpreted as today's local log, but
  canonical storage and copied/exported text always include the date header.

For example:

```text
20260812
O0630
N0645
D0900
```

means:

| Time interval | Status               |
| ------------- | -------------------- |
| 00:00–06:30   | Off-duty             |
| 06:30–06:45   | On-duty, not driving |
| 06:45–09:00   | Driving              |
| 09:00–24:00   | Off-duty             |

The compact form is `20260812O0630N0645D0900`. Whitespace and line breaks are
ignored between tokens.

### Temporary-status example

At local time 08:55 on 2026-08-12, this log:

```text
20260812
O0630
N0645
D
```

means:

| Time interval | Status               |
| ------------- | -------------------- |
| 00:00–06:30   | Off-duty             |
| 06:30–06:45   | On-duty, not driving |
| 06:45–08:55   | Driving              |
| 08:55–24:00   | Off-duty             |

If the same log is read on 2026-08-13, the dated record is historical. Its
temporary Driving status is extended to the end of that logged day:

| Time interval | Status               |
| ------------- | -------------------- |
| 00:00–06:30   | Off-duty             |
| 06:30–06:45   | On-duty, not driving |
| 06:45–24:00   | Driving              |

## 2. Status codes

| Code | Status               |
| ---- | -------------------- |
| `O`  | Off-duty             |
| `S`  | Sleeper berth        |
| `D`  | Driving              |
| `N`  | On-duty, not driving |

Codes are case-insensitive when parsing. Canonical output uses uppercase
codes.

## 3. Date header

The date header has the form `YYYYMMDD` and identifies the local calendar day
described by the log:

```text
20260812
O0630
D
```

The header is required in canonical stored, copied, and exported logs. When
reading input without a header, interpret it as belonging to the current
local date. In the human-readable editor, the date may be displayed as
`YYYY-MM-DD`; canonical log text uses `YYYYMMDD`.

The date is included even though the app also stores daily records by date in
IndexedDB. This lets a copied or exported log retain its day independently of
the browser database.

When the app initializes a new day's log, it starts with the final status
from the most recent earlier saved day. If there is no earlier saved record,
it starts Off-duty (`O`).

## 4. Timed-entry meaning

A status followed by a time marks the **end** of that status interval:

```text
O0630
```

means Off-duty from the previous boundary (or midnight for the first entry)
through 06:30. The status for the next interval begins at 06:30.

For example:

```text
O0600
N0630
D0900
```

means Off-duty from midnight to 06:00, On-duty not driving from 06:00 to
06:30, Driving from 06:30 to 09:00, then Off-duty for the remainder of the
day.

Supported input times are `H:mm`, `HH:mm`, `Hmm`, and `HHmm`. Canonical
output uses zero-padded `HHmm`, including `2400` for the end-of-day boundary.
Timed entries must be strictly increasing and no later than `2400`.

## 5. Temporary status and implicit Off-duty time

A final status code without a time is the temporary status for the end of the
log:

```text
O0630
D
```

The log starts with Off-duty through 06:30. Driving then applies from 06:30
through the applicable end of the log:

- For today's log, Driving applies through the current local time. The
  remaining time to midnight is Off-duty.
- For a past dated log, Driving applies through `2400`.

A standalone status is interpreted by the same rule. For example, a
standalone `D` on today's log means Driving from midnight through now, then
Off-duty for the rest of today. On a past dated log, it means Driving for the
full day. A standalone `O` is Off-duty for the full day under either rule.

There may be at most one temporary status, and it must be the final token.
If no temporary status is present, any time after the final timed interval is
Off-duty. All unassigned time is Off-duty.

## 6. Compact storage and readable display

The canonical storage form is one whitespace-free line, including its date
header:

```text
20160823O0630N0645D0900
```

The editor may display the same information across lines:

```text
20160823
O0630
N0645
D0900
```

The date may be rendered in the UI as `2016-08-23`. Whitespace is for
readability only and does not change token meaning.

The date header must be distinguished from a time token: it is the first
eight-digit date value, before any status token. `2400` is a time only when
attached to a status code.

## 7. Status-changing behavior

The status buttons record a change beginning at the time the user presses the
button. They do not record when the selected status ends. A button press
closes the prior status interval at the current local minute and makes the
selected status the final temporary status.

Starting with:

```text
20260812
O0630
D
```

if the user presses **On-duty, not driving** at 07:15, the result is:

```text
20260812
O0630
D0715
N
```

This means Off-duty from 00:00 to 06:30, Driving from 06:30 to 07:15, and
On-duty not driving from 07:15 through the current time. For today's
breakdown, only elapsed time is displayed until the date passes or the user
confirms the day is complete. For a past dated log, the final temporary
status extends to `2400`.

### Button update rules

1. **Use local time.** Record a status change at the current local minute in
   `HHmm` format.
2. **Close the prior status.** When a different status is selected, add a
   timed entry for the previous status ending now, then place the selected
   status as the final status-only token.
3. **Correct within the same minute.** If another status is selected in the
   same minute, replace the status at that boundary instead of making a
   zero-length interval or duplicate timestamp.
4. **Merge repeats.** Merge adjacent intervals with the same status. In
   particular, selecting Off-duty while Off-duty is active must not append
   redundant Off-duty entries.
5. **Keep the active status temporary.** The final status-only token
   represents the active status; it has no end time until the next change or
   end of day.
6. **Save according to view.** Today's button changes save automatically.
   Log edits for today and past days are saved from their detail dialogs.
7. **Do nothing when the selected status is already active.** Do not add a
   boundary or change the existing start time. To correct a start time, use
   **Edit log**.

## 8. Legacy timestamp-first entries

Older records may use timestamp-first transitions:

```text
O
0630D
0900N
```

In this legacy syntax, a time marks the **start** of the status after that
time. For example, `0630D` means Driving starts at 06:30. In the canonical
status-first syntax, `D0630` instead means Driving ends at 06:30.

Timestamp-first syntax is not canonical and should not be generated or saved.
Migrate legacy records to status-first intervals. If a legacy record has no
status before its first timestamp, insert an initial Off-duty interval from
midnight to that timestamp:

```text
Legacy:     0630D
Canonical:  O0630
            D
```

Do not mix timestamp-first and status-first entries in a canonical log.
Mixed-format legacy records must be interpreted and migrated before editing
or saving.

## 9. Duration breakdown

The duration breakdown is a runtime display behavior; it does not change the
log-file syntax or rewrite the log text.

For today's unfinished log, the breakdown shows elapsed time through the
current local time:

- Completed timed intervals retain their logged durations.
- A temporary status applies through now.
- Future time is not included before the day is complete.
- This calculation is a projection and does not modify the log text.

The elapsed-time breakdown remains in effect until the date passes or the
user confirms that the day is complete. Once the day is marked complete, the
remaining time through midnight is counted as Off-duty, bringing the day's
total to 24 hours.

The completion action records the local completion time with the daily record.
Reopening a completed day removes that completion time and restores the
elapsed-time breakdown.

When a day is completed, any temporary status is written as a timed entry
ending at the completion minute, followed by an explicit Off-duty `O2400`
boundary. If there is no temporary status, the completed log is still closed
with `O2400` unless its final timed entry already ends at `2400`. Reopening
removes this generated closure and restores the temporary status when its end
matches the saved completion minute.

The Today log dialog is editable until the day is complete. A completed Today
log opens read-only; it can be edited again after reopening the day. Past-day
logs remain editable so missing or incorrect entries can be patched, including
records whose day was marked complete. Saving a Today log whose final timed
entry ends at `2400` automatically marks the day complete and records the
completion timestamp.

For a past dated log, a final temporary status extends through midnight, so
the day's durations total 24 hours. Historical breakdowns do not use the
current clock.

For example, if Driving is the temporary status and it is currently 10:00,
the unfinished-day breakdown counts statuses only through 10:00. It does not
include the remaining 14 hours until the user marks the day complete or the
date passes. If that dated log is viewed after its date has passed, Driving
is counted through 24:00.

## 10. Implementation status

The implementation follows the behavior defined in Sections 1–9.

- Parsing, date headers, legacy conversion, interval construction, and
  elapsed-time breakdowns are implemented in
  `src/libs/hos-log-normalizer.ts`.
- Status-button updates are implemented in
  `src/libs/hos-log-status-updater.ts`.
- Daily records persist compact date-prefixed logs and an optional completion
  timestamp in IndexedDB.
- Loading legacy or headerless records normalizes and saves them in canonical
  format. The indexed record date and an included header must match.
- Today’s controls expose day completion and reopening; status buttons are
  disabled while the day is marked complete.
- Parser and status-updater tests cover date headers, temporary statuses,
  elapsed and completed breakdowns, and migration from timestamp-first logs.
