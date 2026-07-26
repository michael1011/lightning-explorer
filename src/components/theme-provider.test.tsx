import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "./theme-provider";

const rootClassList = () => document.documentElement.classList;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  // jsdom has no matchMedia; default to "not dark".
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
});
afterEach(() => vi.unstubAllGlobals());

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      <ThemeProvider>
        <span>content</span>
      </ThemeProvider>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("applies the default theme class to the document root", () => {
    render(<ThemeProvider defaultTheme="dark">x</ThemeProvider>);
    expect(rootClassList().contains("dark")).toBe(true);
  });

  it("prefers a stored theme over the default", () => {
    localStorage.setItem("ui-theme", "light");
    render(
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        x
      </ThemeProvider>,
    );
    expect(rootClassList().contains("light")).toBe(true);
    expect(rootClassList().contains("dark")).toBe(false);
  });

  it("resolves the system theme via matchMedia (prefers dark)", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    render(<ThemeProvider defaultTheme="system">x</ThemeProvider>);
    expect(rootClassList().contains("dark")).toBe(true);
  });
});
