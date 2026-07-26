import { lookup } from "@/lib/dohLookup";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Resolver from "./Resolver";

vi.mock("../lib/dohLookup", () => ({ lookup: vi.fn() }));
const lookupMock = vi.mocked(lookup);

// Route global.fetch by URL substring; every caller here only reads .json().
type Json = Record<string, unknown>;
const routeFetch = (routes: Array<[string, Json]>) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = routes.find(([needle]) => url.includes(needle));
    if (!match) throw new Error(`unexpected fetch: ${url}`);
    return { json: async () => match[1] } as Response;
  });

const bip353Ok = () =>
  lookupMock.mockResolvedValue({
    expires: 9_999_999_999,
    valid_from: 0,
    max_cache_ttl: 0,
    verified_rrs: [
      { type: "txt", name: "n", contents: "bitcoin:?lno=lno1testoffer" },
    ],
  });

const renderResolver = (input: string) =>
  renderWithProviders(
    "resolver/:input",
    <Resolver />,
    `/resolver/${encodeURIComponent(input)}`,
  );

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Resolver", () => {
  it("resolves a lightning address to both LNURL and BIP-353 cards", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        [
          "/.well-known/lnurlp/alice",
          { tag: "payRequest", callback: "https://example.com/cb" },
        ],
      ]),
    );
    bip353Ok();

    renderResolver("alice@example.com");

    expect(await screen.findByText("LNURL")).toBeInTheDocument();
    expect(await screen.findByText("BIP-353")).toBeInTheDocument();
    expect(
      screen.getByText("callback: https://example.com/cb"),
    ).toBeInTheDocument();
    expect(screen.getByText("offer: lno1testoffer")).toBeInTheDocument();
    // resolveBip353 queries the derived DNS name.
    expect(lookupMock).toHaveBeenCalledWith(
      "alice.user._bitcoin-payment.example.com",
      "txt",
      expect.any(String),
    );
  });

  it("resolves a bech32 lnurl to an LNURL card", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([["ln.example/p", { callback: "https://ln.example/cb" }]]),
    );

    // Decodes to https://ln.example/p
    renderResolver("lnurl1dp68gurn8ghj7mrw9ejhsctdwpkx2tmsns8u87");

    expect(await screen.findByText("LNURL")).toBeInTheDocument();
    expect(
      screen.getByText("callback: https://ln.example/cb"),
    ).toBeInTheDocument();
  });

  it("fetches an invoice from an LNURL callback", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch([
        ["ln.example/p", { callback: "https://ln.example/cb" }],
        ["ln.example/cb", { pr: "lnbc1fetchedinvoice" }],
      ]),
    );

    renderResolver("lnurl1dp68gurn8ghj7mrw9ejhsctdwpkx2tmsns8u87");
    await screen.findByText("LNURL");

    const user = userEvent.setup();
    await user.type(screen.getByRole("spinbutton"), "100");
    await user.click(screen.getByRole("button", { name: "Fetch" }));

    expect(await screen.findByText("lnbc1fetchedinvoice")).toBeInTheDocument();
  });

  it("fetches a BOLT12 invoice for a BIP-353 offer", async () => {
    // LNURL lookup fails so only the BIP-353 card renders (single Fetch button).
    vi.stubGlobal(
      "fetch",
      routeFetch([
        ["/.well-known/lnurlp/bob", { status: "ERROR", reason: "nope" }],
        ["bolt12/fetch", { invoice: "lni1fetchedoffer" }],
      ]),
    );
    bip353Ok();

    renderResolver("bob@example.com");
    await screen.findByText("BIP-353");

    const user = userEvent.setup();
    await user.type(screen.getByRole("spinbutton"), "250");
    await user.click(screen.getByRole("button", { name: "Fetch" }));

    expect(await screen.findByText("lni1fetchedoffer")).toBeInTheDocument();
  });

  it("shows 'No info found' when nothing resolves", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    lookupMock.mockRejectedValue(new Error("dns down"));

    renderResolver("nobody@example.com");

    expect(await screen.findByText("No info found")).toBeInTheDocument();
  });
});
