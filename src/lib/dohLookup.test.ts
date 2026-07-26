import { beforeEach, describe, expect, it, vi } from "vitest";

import initWasm, * as wasm from "./dnssec/dnssec_prover_wasm.js";
import { lookup } from "./dohLookup";

// Replace the WASM prover with controllable stubs so we can exercise dohLookup's
// own logic (type mapping, base64url encoding, recursion, error handling)
// without loading real WebAssembly or hitting the network.
vi.mock("./dnssec/dnssec_prover_wasm.js", () => ({
  default: vi.fn(async () => undefined),
  get_next_query: vi.fn(),
  get_unverified_proof: vi.fn(),
  verify_byte_stream: vi.fn(),
  init_proof_builder: vi.fn(),
  process_query_response: vi.fn(),
}));

const wasmMock = vi.mocked(wasm);
const initMock = vi.mocked(initWasm);
const DOH = "https://doh.test/dns-query";

const okResponse = (bytes: number[]) => ({
  ok: true,
  arrayBuffer: async () => new Uint8Array(bytes).buffer,
});

beforeEach(() => {
  vi.clearAllMocks();
  initMock.mockResolvedValue(undefined);
});

describe("lookup", () => {
  it("queries the DoH endpoint then returns the verified proof", async () => {
    const builder = {};
    wasmMock.init_proof_builder.mockReturnValue(builder);
    const query = new Uint8Array([248, 63, 255, 0, 191]);
    wasmMock.get_next_query
      .mockReturnValueOnce(query)
      .mockReturnValueOnce(null);
    wasmMock.get_unverified_proof.mockReturnValue(new Uint8Array([1, 2]));
    wasmMock.verify_byte_stream.mockReturnValue(
      JSON.stringify({
        expires: 1,
        valid_from: 0,
        max_cache_ttl: 1,
        verified_rrs: [{ type: "txt", name: "x", contents: "y" }],
      }),
    );
    const fetchMock = vi.fn(async () => okResponse([9, 9]));
    vi.stubGlobal("fetch", fetchMock);

    const res = await lookup("example.com", "txt", DOH);

    expect(initMock).toHaveBeenCalled();
    // txt -> type 16, and a trailing dot is appended.
    expect(wasmMock.init_proof_builder).toHaveBeenCalledWith(
      "example.com.",
      16,
    );
    expect(res.verified_rrs).toHaveLength(1);

    // The query is base64url-encoded (url-safe, unpadded).
    const url = fetchMock.mock.calls[0][0] as string;
    expect(new URL(url).searchParams.get("dns")).toBe(
      Buffer.from(query).toString("base64url"),
    );
    expect(wasmMock.process_query_response).toHaveBeenCalledWith(
      builder,
      new Uint8Array([9, 9]),
    );
    vi.unstubAllGlobals();
  });

  it.each([
    ["a", 1],
    ["aaaa", 28],
    ["tsla", 52],
    ["txt", 16],
  ] as const)("maps dns type %s to numeric type %d", async (dnsType, ty) => {
    wasmMock.init_proof_builder.mockReturnValue({});
    wasmMock.get_next_query.mockReturnValue(null);
    wasmMock.get_unverified_proof.mockReturnValue(new Uint8Array([1]));
    wasmMock.verify_byte_stream.mockReturnValue("{}");

    await lookup("d.example", dnsType, DOH);

    expect(wasmMock.init_proof_builder).toHaveBeenCalledWith("d.example.", ty);
  });

  it("does not double an existing trailing dot", async () => {
    wasmMock.init_proof_builder.mockReturnValue({});
    wasmMock.get_next_query.mockReturnValue(null);
    wasmMock.get_unverified_proof.mockReturnValue(new Uint8Array([1]));
    wasmMock.verify_byte_stream.mockReturnValue("{}");

    await lookup("already.dotted.", "txt", DOH);

    expect(wasmMock.init_proof_builder).toHaveBeenCalledWith(
      "already.dotted.",
      16,
    );
  });

  it("rejects an unknown dns type", async () => {
    await expect(lookup("d.example", "mx" as never, DOH)).rejects.toBe(
      "invalid DNS lookup type",
    );
  });

  it("rejects a bad domain when the builder is null", async () => {
    wasmMock.init_proof_builder.mockReturnValue(null);
    await expect(lookup("bad", "txt", DOH)).rejects.toBe("bad domain");
  });

  it("throws when the proof cannot be built", async () => {
    wasmMock.init_proof_builder.mockReturnValue({});
    wasmMock.get_next_query.mockReturnValue(null);
    wasmMock.get_unverified_proof.mockReturnValue(null);
    await expect(lookup("d.example", "txt", DOH)).rejects.toBe(
      "failed to build proof",
    );
  });

  it("throws when a DoH request is not ok", async () => {
    wasmMock.init_proof_builder.mockReturnValue({});
    wasmMock.get_next_query.mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    await expect(lookup("d.example", "txt", DOH)).rejects.toBe(
      "DoH query failed",
    );
    vi.unstubAllGlobals();
  });
});
