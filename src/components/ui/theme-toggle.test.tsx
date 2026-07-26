import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "../theme-provider";
import { ThemeToggle } from "./theme-toggle";

const rootClasses = () => document.documentElement.classList;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  // jsdom has no matchMedia; default the system preference to "not dark".
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});

describe("ThemeToggle", () => {
  it("toggles the document theme and persists the choice", async () => {
    render(
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        <ThemeToggle />
      </ThemeProvider>,
    );

    // Starts dark -> offers to switch to light.
    expect(rootClasses().contains("dark")).toBe(true);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Switch to light theme" }),
    );

    expect(rootClasses().contains("light")).toBe(true);
    expect(localStorage.getItem("ui-theme")).toBe("light");

    // Now offers to switch back to dark.
    await user.click(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    );
    expect(rootClasses().contains("dark")).toBe(true);
  });
});
