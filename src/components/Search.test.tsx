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

    // The decoded view titles with the invoice type and labels the signer.
    expect(
      await screen.findByRole("heading", { name: "BOLT12 offer" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Offer issuer")).toBeInTheDocument();
    expect(await screen.findByText("Offer Node")).toBeInTheDocument();
  });

  it("shows a loading placeholder, not 'not found', while lookups are pending", async () => {
    // Node lookups that never settle: the card must not claim the node is
    // missing from the graph before the request has actually finished.
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL): Promise<Response> => {
        if (String(input).includes("/node/")) {
          return new Promise<Response>(() => {});
        }
        throw new Error(`unexpected fetch: ${String(input)}`);
      }),
    );

    renderSearch(OFFER);

    expect(
      await screen.findByRole("heading", { name: "BOLT12 offer" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Offer issuer")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("Unknown node")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Not found in the public graph"),
    ).not.toBeInTheDocument();
  });

  it("separates the issuer from unresolved blinded-path routing nodes", async () => {
    // Offer with an issuer id (signer) plus one blinded-path introduction node.
    const OFFER_WITH_PATH =
      "lno1pgx9getnwss8vetrw3hhyucs5ypjgef743p5fzqq9nqxh0ah7y87rzv3ud0eleps9kl2d5348hq2k8qzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgqpqqqqqqqqqqqqqqqqqqqqqqqqqqqzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqqzq3zyg3zyg3zyg3vggzamrjghtt05kvkvpcp0a79gmy3nt6jsn98ad2xs8de6sl9qmgvcvs";
    const INTRO =
      "0324653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c";
    vi.stubGlobal(
      "fetch",
      routeFetch([
        [
          `/node/${OFFER_ISSUER_ID}`,
          {
            body: { alias: "Issuer Node", color: "#0f0", id: OFFER_ISSUER_ID },
          },
        ],
        // The introduction node is not in the public graph.
        [`/node/${INTRO}`, { ok: false, statusText: "not found", body: {} }],
      ]),
    );

    renderSearch(OFFER_WITH_PATH);

    expect(await screen.findByText("Issuer Node")).toBeInTheDocument();
    expect(
      await screen.findByText("Blinded path introduction nodes"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Not found in the public graph"),
    ).toBeInTheDocument();
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
