import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./copy-button";

// jsdom has no clipboard API; install (or remove) one per test.
const defineClipboard = (clipboard: unknown) =>
  Object.defineProperty(window.navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });

afterEach(() => {
  vi.useRealTimers();
  defineClipboard(undefined);
});

const checkIcon = (container: HTMLElement) =>
  container.querySelector("svg.lucide-check");

describe("CopyButton", () => {
  it("copies the value and flashes the checkmark for 1.2s", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    defineClipboard({ writeText });

    const { container } = render(
      <CopyButton value="02abc" label="Copy node key" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy node key" }));
    // Flush the async clipboard write.
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith("02abc");
    expect(checkIcon(container)).not.toBeNull();

    act(() => vi.advanceTimersByTime(1200));
    expect(checkIcon(container)).toBeNull();
  });

  it("stays idle when the clipboard API is unavailable", async () => {
    defineClipboard(undefined);

    const { container } = render(<CopyButton value="02abc" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy 02abc" }));
    await act(async () => {});

    // No false success: the checkmark must not appear.
    expect(checkIcon(container)).toBeNull();
  });

  it("stays idle when the clipboard write is denied", async () => {
    defineClipboard({
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });

    const { container } = render(<CopyButton value="02abc" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy 02abc" }));
    await act(async () => {});

    expect(checkIcon(container)).toBeNull();
  });
});
