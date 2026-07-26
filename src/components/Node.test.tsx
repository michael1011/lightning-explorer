import { renderAtRoute } from "@/test/render";
import { screen } from "@testing-library/react";
import useSWR from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Node, { type Channel, type NodeInfo } from "./Node";

vi.mock("swr");
const mockSWR = vi.mocked(useSWR);

const nodeInfo: NodeInfo = {
  alias: "ACINQ",
  color: "#ffffff",
  id: `02${"a".repeat(64)}`,
};

const channels: Channel[] = [
  {
    source: { id: `03${"b".repeat(64)}`, alias: "Peer One", color: "#000000" },
    shortChannelId: "800000x1x0",
    capacity: 16_777_215,
    active: true,
    info: {
      baseFeeMillisatoshi: 1000,
      feePpm: 200,
      delay: 40,
      htlcMinimumMillisatoshi: 1000,
      htlcMaximumMillisatoshi: 16_000_000_000,
    },
  },
  {
    source: { id: `03${"c".repeat(64)}`, alias: "Peer Two", color: "#111111" },
    shortChannelId: "800001x2x1",
    capacity: 5_000_000,
    active: false,
    info: {
      baseFeeMillisatoshi: 0,
      feePpm: 100,
      delay: 144,
      htlcMinimumMillisatoshi: 1000,
      htlcMaximumMillisatoshi: 5_000_000_000,
    },
  },
];

const ok = (data: unknown) =>
  ({ data, error: undefined, isLoading: false }) as never;

describe("Node page", () => {
  beforeEach(() => {
    mockSWR.mockReset();
    mockSWR.mockImplementation((key) => {
      const k = String(key);
      if (k.includes("/node/")) return ok(nodeInfo);
      if (k.includes("/channels/")) return ok(channels);
      return ok(undefined);
    });
  });

  it("renders the node alias, id and channel summary", () => {
    renderAtRoute("node/:node", <Node />, `/node/${nodeInfo.id}`);

    expect(screen.getByRole("heading", { name: "ACINQ" })).toBeInTheDocument();
    expect(screen.getByText(nodeInfo.id)).toBeInTheDocument();
    // Stat tiles.
    expect(screen.getByText("Channels")).toBeInTheDocument();
    // Total capacity 21,777,215 sats.
    expect(screen.getByText("0.21 777 215")).toBeInTheDocument();
    // 1 of 2 channels active.
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1 inactive")).toBeInTheDocument();
  });

  it("renders a row per channel", () => {
    renderAtRoute("node/:node", <Node />, `/node/${nodeInfo.id}`);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("800000x1x0")).toBeInTheDocument();
    expect(screen.getByText("Peer One")).toBeInTheDocument();
    // Peer keys are middle-truncated.
    expect(
      screen.getByText(`03${"b".repeat(8)}...${"b".repeat(10)}`),
    ).toBeInTheDocument();
  });

  it("scopes one accent variable per theme to the page", () => {
    const { container } = renderAtRoute(
      "node/:node",
      <Node />,
      `/node/${nodeInfo.id}`,
    );

    const scope = container.querySelector<HTMLElement>("[data-node-accent]");
    expect(scope).not.toBeNull();
    // White (#ffffff) reads on the night background but not on daylight,
    // so only the dark variant keeps the broadcast color.
    expect(scope!.style.getPropertyValue("--node-accent-dark")).toBe("#ffffff");
    expect(scope!.style.getPropertyValue("--node-accent-light")).toBe(
      "var(--volt)",
    );
  });

  it("shows a fullscreen spinner while the node loads", () => {
    mockSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
    } as never);

    const { container } = renderAtRoute(
      "node/:node",
      <Node />,
      `/node/${nodeInfo.id}`,
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows an inline spinner while channels load", () => {
    mockSWR.mockImplementation((key) => {
      const k = String(key);
      if (k.includes("/node/")) return ok(nodeInfo);
      if (k.includes("/channels/"))
        return { data: undefined, error: undefined, isLoading: true } as never;
      return ok(undefined);
    });

    const { container } = renderAtRoute(
      "node/:node",
      <Node />,
      `/node/${nodeInfo.id}`,
    );

    expect(screen.getByRole("heading", { name: "ACINQ" })).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the error view when a request fails", () => {
    mockSWR.mockImplementation((key) => {
      const k = String(key);
      if (k.includes("/node/"))
        return {
          data: undefined,
          error: new Error("node not found"),
          isLoading: false,
        } as never;
      return ok([]);
    });

    renderAtRoute("node/:node", <Node />, `/node/${nodeInfo.id}`);

    expect(screen.getByRole("heading", { name: "Error" })).toBeInTheDocument();
    expect(screen.getByText(/node not found/)).toBeInTheDocument();
  });
});
