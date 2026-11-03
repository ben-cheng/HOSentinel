import { describe, expect, it } from "vitest";
import { createDOM } from "@qwik.dev/core/testing";
import { LogEditForm } from "./log-edit-form";
import { StatusSwitcher } from "./status-switcher";
import { $ } from "@qwik.dev/core";

const LOG = "2026-10-13\nO0630D0930O";

describe("LogEditForm", () => {
  it("shows the raw log and no inputs in read mode", async () => {
    const { render, screen } = await createDOM();
    await render(<LogEditForm log={LOG} mode="read" />);
    expect(screen.querySelector("pre")?.textContent).toContain("O0630D0930O");
    expect(screen.querySelectorAll("select")).toHaveLength(0);
  });

  it("renders one row per timed entry in edit mode", async () => {
    const { render, screen } = await createDOM();
    await render(<LogEditForm log={LOG} mode="edit" onSave$={$(() => {})} />);
    const untils = screen.querySelectorAll('input[type="time"]');
    expect(untils).toHaveLength(2);
    expect((untils[1] as HTMLInputElement).value).toBe("09:30");
  });
});

describe("StatusSwitcher", () => {
  it("marks the status running at `now` as current", async () => {
    const { render, screen } = await createDOM();
    await render(
      <StatusSwitcher
        log={LOG}
        now={new Date(2026, 9, 13, 8, 0).getTime()}
        onChange$={$(() => {})}
      />,
    );
    const pressed = screen.querySelector('button[aria-pressed="true"]');
    expect(pressed?.textContent).toContain("Driving");
  });
});
