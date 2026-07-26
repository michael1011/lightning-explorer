import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Imported after the mock so Landing picks up the mocked useNavigate.
import Landing from "./Landing";

const navigate = vi.fn();
vi.mock("react-router", () => ({
  useNavigate: () => navigate,
}));

const typeAndSearch = async (value: string) => {
  const user = userEvent.setup();
  const input = screen.getByRole("textbox");
  await user.clear(input);
  await user.type(input, value);
  await user.click(screen.getByRole("button", { name: "Search" }));
};

describe("Landing search routing", () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it("renders the heading, input and search button", () => {
    render(<Landing />);
    expect(
      screen.getByRole("heading", { name: "Lightning Explorer" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("routes a 66-char pubkey to the node page", async () => {
    render(<Landing />);
    const pubkey = "a".repeat(66);
    await typeAndSearch(pubkey);
    expect(navigate).toHaveBeenCalledWith(`/node/${pubkey}`);
  });

  it("routes a short channel id to the channel page", async () => {
    render(<Landing />);
    await typeAndSearch("800000x1x0");
    expect(navigate).toHaveBeenCalledWith("/channel/800000x1x0");
  });

  it("routes a lightning address to the resolver, URI-encoded", async () => {
    render(<Landing />);
    await typeAndSearch("alice@example.com");
    expect(navigate).toHaveBeenCalledWith("/resolver/alice%40example.com");
  });

  it("routes an lnurl to the resolver", async () => {
    render(<Landing />);
    await typeAndSearch("lnurl1abcdef");
    expect(navigate).toHaveBeenCalledWith("/resolver/lnurl1abcdef");
  });

  it("routes a free-text alias to the search page", async () => {
    render(<Landing />);
    await typeAndSearch("acinq");
    expect(navigate).toHaveBeenCalledWith("/search/acinq");
  });

  it("submits on Enter", async () => {
    render(<Landing />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "acinq{Enter}");
    expect(navigate).toHaveBeenCalledWith("/search/acinq");
  });
});
