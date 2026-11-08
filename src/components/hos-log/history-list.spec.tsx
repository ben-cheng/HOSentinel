import { $, component$ } from "@qwik.dev/core";
import { createDOM } from "@qwik.dev/core/testing";
import { expect, test } from "vitest";
import { HistoryList } from "./history-list";

const HistoryHarness = component$(() => (
  <HistoryList
    maxDate="2026-10-13"
    items={[
      { date: "2026-10-13", log: "2026-10-13\nO0630D", hasRecord: true },
      { date: "2026-10-12", log: "2026-10-12\nO", hasRecord: false },
    ]}
    onSave$={$(async () => true)}
  />
));

test("shows the selected day and switches details using a week shortcut", async () => {
  const { render, screen, userEvent } = await createDOM();
  await render(<HistoryHarness />);

  const dateInput = screen.querySelector('input[type="date"]') as HTMLInputElement;
  expect(dateInput.value).toBe("2026-10-13");
  expect(dateInput.max).toBe("2026-10-13");
  expect(screen.querySelectorAll('[aria-label="Past week"] button')).toHaveLength(7);
  expect(screen.querySelector("ol")?.textContent).toContain("06:30");
  expect(screen.querySelector('[aria-label="24-hour duty status timeline"]')).toBeTruthy();

  await userEvent('[aria-label="Past week"] button:nth-child(2)', "click");

  expect(dateInput.value).toBe("2026-10-12");
  expect(screen.textContent).toContain("No record");
  expect(screen.querySelector("ol")?.textContent).not.toContain("06:30");
  expect(screen.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(1);
});

test("disables editing while history is unavailable", async () => {
  const { render, screen } = await createDOM();
  await render(
    <HistoryList
      maxDate="2026-10-13"
      items={[]}
      disabled
      onSave$={$(async () => true)}
    />,
  );
  const edit = Array.from(screen.querySelectorAll("button")).find(
    (button) => button.textContent === "Edit log",
  );
  expect(edit?.hasAttribute("disabled")).toBe(true);
});
