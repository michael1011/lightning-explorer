import { convertChannelid } from "@/lib/utils";
import { renderAtRoute } from "@/test/render";
import { screen } from "@testing-library/react";
import useSWR from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Channel from "./Channel";

vi.mock("swr");
const mockSWR = vi.mocked(useSWR);

const policy = (
  id: string,
  alias: string,
  active: boolean,
  feePpm: number,
) => ({
  node: { id, alias, color: "#000000" },
  active,
  baseFeeMillisatoshi: 1000,
  feePpm,
  delay: 40,
  htlcMinimumMillisatoshi: 1000,
  htlcMaximumMillisatoshi: 16_000_000_000,
});

const channelInfo = {
  shortChannelId: "800000x1x0",
  capacity: 16_777_215,
  policies: [
    policy(`02${"a".repeat(64)}`, "Alice", true, 200),
    policy(`03${"b".repeat(64)}`, "Bob", false, 50),
  ],
};

describe("Channel page", () => {
  beforeEach(() => {
    mockSWR.mockReset();
    mockSWR.mockReturnValue({
      data: channelInfo,
      error: undefined,
      isLoading: false,
    } as never);
  });

  it("renders both short-channel-id formats and the capacity", () => {
    renderAtRoute("channel/:channel", <Channel />, "/channel/800000x1x0");

    expect(
      screen.getByRole("heading", { name: "Channel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("800000x1x0")).toBeInTheDocument();
    // The opposite (LND numeric) representation of the scid.
    expect(
      screen.getByText(convertChannelid("800000x1x0")),
    ).toBeInTheDocument();
    expect(screen.getByText("Capacity: 0.16 777 215")).toBeInTheDocument();
  });

  it("renders a policy block for each direction", () => {
    const { container } = renderAtRoute(
      "channel/:channel",
      <Channel />,
      "/channel/800000x1x0",
    );

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Bob/)).toBeInTheDocument();
    expect(screen.getByText("Fee PPM: 200")).toBeInTheDocument();
    expect(screen.getByText("Fee PPM: 50")).toBeInTheDocument();
    // Bob's side is inactive, and one arrow separates the two directions.
    expect(screen.getByText("inactive")).toBeInTheDocument();
    expect(
      container.querySelectorAll("svg.lucide-arrow-left-right"),
    ).toHaveLength(1);
  });

  it("renders a response with a single policy without crashing", () => {
    // The API types promise two policies, but the page must not white-screen
    // if only one side is present.
    mockSWR.mockReturnValue({
      data: {
        ...channelInfo,
        policies: [policy(`02${"a".repeat(64)}`, "Alice", true, 200)],
      },
      error: undefined,
      isLoading: false,
    } as never);

    const { container } = renderAtRoute(
      "channel/:channel",
      <Channel />,
      "/channel/800000x1x0",
    );

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    // No separator arrow when there is nothing to separate.
    expect(
      container.querySelectorAll("svg.lucide-arrow-left-right"),
    ).toHaveLength(0);
  });

  it("shows a fullscreen spinner while loading", () => {
    mockSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    } as never);

    const { container } = renderAtRoute(
      "channel/:channel",
      <Channel />,
      "/channel/800000x1x0",
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("shows the error view when the request fails", () => {
    mockSWR.mockReturnValue({
      data: undefined,
      error: new Error("channel not found"),
      isLoading: false,
    } as never);

    renderAtRoute("channel/:channel", <Channel />, "/channel/800000x1x0");

    expect(screen.getByRole("heading", { name: "Error" })).toBeInTheDocument();
    expect(screen.getByText(/channel not found/)).toBeInTheDocument();
  });
});
