import { $, component$ } from "@qwik.dev/core";
import { createDOM } from "@qwik.dev/core/testing";
import { expect, test } from "vitest";
import { TodayLogView } from "./today-log-view";

const TodayHarness = component$(() => (
  <TodayLogView
    now={new Date(2026, 9, 13, 8).getTime()}
    date="2026-10-13"
    log={"2026-10-13\nO0630D"}
    isComplete={false}
    disabled={false}
    error={null}
    storageError={null}
    storageMessage={null}
    onChange$={$(() => {})}
    onSave$={$(async () => true)}
    onSetComplete$={$(async () => true)}
  />
));

test("shows current status and opens the log details", async () => {
  const { render, screen, userEvent } = await createDOM();
  await render(<TodayHarness />);

  expect(screen.querySelector('button[aria-pressed="true"]')?.textContent).toContain(
    "Driving",
  );
  expect(screen.querySelector('[aria-label="24-hour duty status timeline"]')).toBeTruthy();

  const details = Array.from(screen.querySelectorAll("button")).find(
    (button) => button.textContent === "Details",
  );
  expect(details).toBeTruthy();
  await userEvent(details!, "click");
  expect(screen.querySelector('[role="dialog"]')?.textContent).toContain("06:30");
});

test("disables changes while today's log is loading", async () => {
  const { render, screen } = await createDOM();
  await render(
    <TodayLogView
      now={new Date(2026, 9, 13, 8).getTime()}
      date="2026-10-13"
      log="O"
      isComplete={false}
      disabled
      loading
      error={null}
      storageError={null}
      storageMessage={null}
      onChange$={$(() => {})}
      onSave$={$(async () => true)}
      onSetComplete$={$(async () => true)}
    />,
  );
  expect(screen.textContent).toContain("Loading today's log");
  expect(screen.querySelectorAll("button[disabled]")).toHaveLength(6);
});
