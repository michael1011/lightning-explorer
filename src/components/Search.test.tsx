import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Channel, NodeInfo } from "./Node";
import Search from "./Search";

// Drives the real SWR data layer (both the search fetcher and the per-node
// channels fetcher) with a mocked global.fetch.

const nodes: NodeInfo[] = [
  { alias: "Node A", color: "#000", id: `02${"a".repeat(64)}` },
  { alias: "Node B", color: "#111", id: `03${"b".repeat(64)}` },
];

// A BOLT12 offer whose issuer id is a known pubkey (spec test vector).
const OFFER = "lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese";
const OFFER_ISSUER_ID =
  "02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619";

const channel = (capacity: number): Channel => ({
  source: { id: `03${"f".repeat(64)}`, alias: "peer", color: "#000" },
  shortChannelId: "1x1x1",
  capacity,
  active: true,
  info: {
    baseFeeMillisatoshi: 0,
    feePpm: 1,
    delay: 40,
    htlcMinimumMillisatoshi: 1000,
    htlcMaximumMillisatoshi: 1000,
  },
});

type Resp = { ok?: boolean; statusText?: string; body: unknown };
const routeFetch = (routes: Array<[string, Resp]>) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = routes.find(([needle]) => url.includes(needle));
    if (!match) throw new Error(`unexpected fetch: ${url}`);
    const { ok = true, statusText = "", body } = match[1];
    return { ok, statusText, json: async () => body } as Response;
  });

const renderSearch = (query: string) =>
  renderWithProviders("search/:query", <Search />, `/search/${query}`);

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("Search page", () => {
  it("renders alias search results with aggregated channel counts", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        ["/search?", { body: nodes }],
        [`/channels/${nodes[0].id}`, { body: [channel(1_000_000)] }],
        [
          `/channels/${nodes[1].id}`,
          { body: [channel(2_000_000), channel(500_000)] },
        ],
      ]),
    );

    renderSearch("node");

    expect(
      await screen.findByRole("heading", { name: "Search result" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('2 results found for "node"'),
    ).toBeInTheDocument();
    expect(screen.getByText("Node A")).toBeInTheDocument();
    expect(screen.getByText("Node B")).toBeInTheDocument();
    expect(await screen.findByText("Channels: 2")).toBeInTheDocument();
    expect(await screen.findByText("Channels: 1")).toBeInTheDocument();
  });

  it("decodes a pasted BOLT12 offer and looks up its node", async () => {
    const offerNode: NodeInfo = {
      alias: "Offer Node",
      color: "#222",
      id: OFFER_ISSUER_ID,
    };
    vi.stubGlobal(
      "fetch",
      routeFetch([
        [`/node/${OFFER_ISSUER_ID}`, { body: offerNode }],
        [`/channels/${OFFER_ISSUER_ID}`, { body: [] }],
      ]),
    );

    renderSearch(OFFER);

    expect(
      await screen.findByText("Invoice type: BOLT12 offer"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Offer Node")).toBeInTheDocument();
  });

  it("shows the error view when the search request fails", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        ["/search?", { ok: false, statusText: "Bad", body: { error: "boom" } }],
      ]),
    );

    renderSearch("node");

    expect(
      await screen.findByRole("heading", { name: "Error" }),
    ).toBeInTheDocument();
  });
});
