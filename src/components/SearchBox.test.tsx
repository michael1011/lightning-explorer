import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Imported after the mock so SearchBox picks up the mocked useNavigate.
import { SearchBox } from "./SearchBox";

const navigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigate,
}));

beforeEach(() => navigate.mockClear());

describe("SearchBox routing", () => {
  it.each([
    ["a".repeat(66), `/node/${"a".repeat(66)}`],
    ["800000x1x0", "/channel/800000x1x0"],
    ["alice@example.com", "/resolver/alice%40example.com"],
    ["lnurl1abcdef", "/resolver/lnurl1abcdef"],
    ["acinq", "/search/acinq"],
  ])("routes %s to the right page", async (input, expected) => {
    render(<SearchBox />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), input);
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(navigate).toHaveBeenCalledWith(expected);
  });

  it("submits on Enter and trims surrounding whitespace", async () => {
    render(<SearchBox />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "  acinq  {Enter}");
    expect(navigate).toHaveBeenCalledWith("/search/acinq");
  });

  it("ignores an empty query", async () => {
    render(<SearchBox />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "   {Enter}");
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("SearchBox variants and shortcut", () => {
  it("renders the compact variant without a visible Search button", () => {
    render(<SearchBox variant="compact" />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("focuses the input on Ctrl/Cmd+K", () => {
    render(<SearchBox variant="compact" />);
    const input = screen.getByRole("textbox");
    expect(input).not.toHaveFocus();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(input).toHaveFocus();

    input.blur();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(input).toHaveFocus();
  });
});
