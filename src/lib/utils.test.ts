import { describe, expect, it } from "vitest";

import {
  bolt11Features,
  chainName,
  cn,
  convertChannelid,
  decodeBolt11,
  decodeBolt12,
  decodeInvoice,
  decodeOffer,
  fetcher,
  formatDuration,
  formatUnix,
  isChannelId,
  isInvoice,
  isLnurl,
  isPubkey,
  isSatsAddress,
  isToBeResolved,
  satoshisToSatcomma,
  scidClnToLnd,
  scidLndToCln,
  toHex,
  toUtf8,
  trimLongString,
} from "./utils";

const bytesFromHex = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

// InvoiceType is a `const enum`; assert against its literal string values
// rather than importing the enum member (it has no reliable runtime object).
const BOLT11 = "BOLT11";
const OFFER = "BOLT12 offer";
const BOLT12 = "BOLT12 invoice";

// A real BOLT12 invoice (lni). Its single blinded path's introduction node is
// the same as the invoice node id, so the raw decoder yields a duplicate pubkey
// (exercising decodeInvoice's deduplication). 76000 msat -> 76 sat.
const BOLT12_INVOICE =
  "lni1qqg9sr0tna8ljw0tp9zk9uehh7s8vz3ufap52s2wypgxz7t0w468xgrxdaezqcnrx9chswp5ds6rwen2x4nhyees8qmnyuphvearscfhxdkhwar3x33hxe3kx3ehgmt9zcss8cjq3fylqlf0gzp6gu6yzw8038nkzlnrjxfq9jf24r2fk4622c9w2gpsz28qtqssxstnfpsaqtgdhchfv70shwvganrwuk28gwz9f6v5nlt37s0xh7hp5zvq8cjq3fylqlf0gzp6gu6yzw8038nkzlnrjxfq9jf24r2fk4622c9wq27sqsf52x7pdt5432aztt8ee3s5l20g3u0whwudkk5asanadjzz5qgzhgehdw5jyjf6m83awzntjkxykywzxycduph6gp5crv29qjf9gsasqv394jhcqgta9q4cr975hw4vl5nzekvuzujxv0u7rngsse707e0pq4duexv3930unvay593kd38t6z8em29zrsqqqqqqqqqqqqqqzgqqqqqqqqqqqqqayjedltzjqqqqqq9yq359nfhm4qst3qczk7fkkjhhqs6syjuygh3q87t8jsmtg04xvzu6vsys3fggzt92qvqj3c9wqvpqqq9syyp7ysy2f8c86t6qswj8x3qn3mufuashucu3jgpvj24g6jd4wjjkpthsgqtas84k74uvj2uvxh32exre34mu4vsc5cnmqpftru4cw0s6wujsk8ggn30v3jll8rn98r3xmlymy850udw2smfmse0amens93mk6fzt";
const BOLT12_INVOICE_NODE_ID =
  "03e2408a49f07d2f4083a47344138ef89e7617e63919202c92aa8d49b574a560ae";

// Canonical BOLT11 test invoice ("1 cup of coffee", 2500u) from the BOLT11 spec.
const COFFEE_INVOICE =
  "lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp";
const COFFEE_PAYEE =
  "03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad";

// BOLT12 offer test vectors (from the BOLT12 spec vectors); expected pubkeys are
// the ground-truth issuer_id (TLV type 22) plus any blinded-path introduction
// nodes (first_node_id of TLV type 16 paths).
const OFFER_MINIMAL =
  "lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese";
const OFFER_ISSUER_ID =
  "02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619";
const OFFER_WITH_PATH =
  "lno1pgx9getnwss8vetrw3hhyucs5ypjgef743p5fzqq9nqxh0ah7y87rzv3ud0eleps9kl2d5348hq2k8qzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgqpqqqqqqqqqqqqqqqqqqqqqqqqqqqzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqqzq3zyg3zyg3zyg3vggzamrjghtt05kvkvpcp0a79gmy3nt6jsn98ad2xs8de6sl9qmgvcvs";
const OFFER_PATH_INTRO =
  "0324653eac434488002cc06bbfb7f10fe18991e35f9fe4302dbea6d2353dc0ab1c";
const OFFER_NO_ISSUER_WITH_PATH =
  "lno1pgx9getnwss8vetrw3hhyucs5ypjgef743p5fzqq9nqxh0ah7y87rzv3ud0eleps9kl2d5348hq2k8qzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgqpqqqqqqqqqqqqqqqqqqqqqqqqqqqzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqqzq3zyg3zyg3zygs";
// Offer whose single blinded path uses a short_channel_id first_node_id (no pubkey).
const OFFER_SCIDDIR_PATH =
  "lno1pgx9getnwss8vetrw3hhyucs3yqqqqqqqqqqqqp2qgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqqyqqqqqqqqqqqqqqqqqqqqqqqqqqqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqqgzyg3zyg3zyg3z93pqthvwfzadd7jejes8q9lhc4rvjxd022zv5l44g6qah82ru5rdpnpj";
// Offer with two blinded paths: one via a pubkey, one via a sciddir reference.
const OFFER_MIXED_PATHS =
  "lno1pgx9getnwss8vetrw3hhyucsl5qj5qeyv5l2cs6y3qqzesrth7mlzrlp3xg7xhulusczm04x6g6nms9trspqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqqsqqqqqqqqqqqqqqqqqqqqqqqqqqpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsqpqg3zyg3zyg3zygpqqqqzqqqqgqqxqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqqgqqqqqqqqqqqqqqqqqqqqqqqqqqqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgqqsg3zyg3zyg3zygtzzqhwcuj966ma9n9nqwqtl032xeyv6755yeflt235pmww58egx6rxry";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "text-sm")).toBe("px-2 text-sm");
  });

  it("resolves conflicting tailwind classes in favour of the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignores falsy/conditional inputs", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

describe("satoshisToSatcomma", () => {
  it.each([
    [100_000_000, "1.00 000 000"],
    [1, "0.00 000 001"],
    [0, "0.00 000 000"],
    [250_000, "0.00 250 000"],
    [123_456_789, "1.23 456 789"],
  ])("formats %d sats as %s", (sats, expected) => {
    expect(satoshisToSatcomma(sats)).toBe(expected);
  });
});

describe("isPubkey", () => {
  it("accepts a 66-char hex string (compressed pubkey)", () => {
    expect(isPubkey("a".repeat(66))).toBe(true);
    expect(isPubkey(COFFEE_PAYEE)).toBe(true);
  });

  it("accepts uppercase hex", () => {
    expect(isPubkey("A".repeat(66))).toBe(true);
  });

  it("rejects wrong length (boundaries) and non-hex", () => {
    expect(isPubkey("a".repeat(65))).toBe(false);
    expect(isPubkey("a".repeat(67))).toBe(false);
    expect(isPubkey("g".repeat(66))).toBe(false);
    expect(isPubkey("")).toBe(false);
    expect(isPubkey(` ${"a".repeat(66)} `)).toBe(false);
  });
});

describe("isChannelId", () => {
  it("accepts CLN short channel ids below length 15", () => {
    expect(isChannelId("800000x1x0")).toBe(true);
  });

  it("accepts numeric LND short channel ids", () => {
    expect(isChannelId("899817253813747712")).toBe(true);
    expect(isChannelId("12345")).toBe(true);
  });

  it("rejects non-numeric aliases and long CLN scids", () => {
    expect(isChannelId("acinq")).toBe(false);
    // A CLN scid of length >= 15 fails both branches (documented quirk).
    expect(isChannelId("123456789012x1x0")).toBe(false);
  });

  it("treats the empty string as a channel id (documented quirk: Number('') === 0)", () => {
    expect(isChannelId("")).toBe(true);
  });
});

describe("isSatsAddress", () => {
  it("detects an @ separator", () => {
    expect(isSatsAddress("alice@example.com")).toBe(true);
    expect(isSatsAddress("no-at-sign")).toBe(false);
  });
});

describe("isLnurl", () => {
  it("matches the lnurl prefix case-insensitively and trims", () => {
    expect(isLnurl("lnurl1abcdef")).toBe(true);
    expect(isLnurl("LNURL1ABCDEF")).toBe(true);
    expect(isLnurl("   lnurl1abc")).toBe(true);
  });

  it("rejects strings that do not start with lnurl", () => {
    expect(isLnurl("not-an-lnurl")).toBe(false);
    expect(isLnurl("xlnurl1")).toBe(false);
  });
});

describe("isToBeResolved", () => {
  it("is true for lightning addresses and lnurls", () => {
    expect(isToBeResolved("alice@example.com")).toBe(true);
    expect(isToBeResolved("lnurl1abc")).toBe(true);
  });

  it("is false for plain aliases and ids", () => {
    expect(isToBeResolved("acinq")).toBe(false);
    expect(isToBeResolved("800000x1x0")).toBe(false);
  });
});

describe("trimLongString", () => {
  it("returns strings shorter than 23 chars unchanged", () => {
    expect(trimLongString("short")).toBe("short");
    expect(trimLongString("a".repeat(22))).toBe("a".repeat(22));
  });

  it("truncates the middle of strings of length 23+", () => {
    const pubkey = COFFEE_PAYEE; // 66 chars
    const trimmed = trimLongString(pubkey);
    expect(trimmed).toBe(`${pubkey.slice(0, 10)}...${pubkey.slice(-10)}`);
    expect(trimmed).toBe("03e7156ae3...0f934dd9ad");
  });
});

describe("isInvoice", () => {
  it("classifies by prefix, case-insensitively", () => {
    expect(isInvoice("lnbc2500u1p...")).toBe("BOLT11");
    expect(isInvoice("LNBC2500U1P...")).toBe("BOLT11");
    expect(isInvoice("lnbcrt1...")).toBe("BOLT11");
    expect(isInvoice("lno1abc...")).toBe("BOLT12 offer");
    expect(isInvoice("lni1abc...")).toBe("BOLT12 invoice");
  });

  it("returns undefined for non-invoice input", () => {
    expect(isInvoice("lnurl1abc")).toBeUndefined();
    expect(isInvoice("hello")).toBeUndefined();
    expect(isInvoice("ln")).toBeUndefined();
  });
});

describe("short channel id conversion", () => {
  it("converts CLN -> LND", () => {
    // (1 << 40) | (2 << 16) | 3
    expect(scidClnToLnd("1x2x3")).toBe("1099511758851");
    expect(scidClnToLnd("0x0x0")).toBe("0");
  });

  it("converts LND -> CLN", () => {
    expect(scidLndToCln("1099511758851")).toBe("1x2x3");
    expect(scidLndToCln("0")).toBe("0x0x0");
  });

  it("round-trips both directions", () => {
    expect(scidLndToCln(scidClnToLnd("820000x5x1"))).toBe("820000x5x1");
    expect(scidClnToLnd(scidLndToCln("899817253813747712"))).toBe(
      "899817253813747712",
    );
  });

  it("convertChannelid dispatches on the presence of 'x'", () => {
    expect(convertChannelid("1x2x3")).toBe("1099511758851");
    expect(convertChannelid("1099511758851")).toBe("1x2x3");
  });
});

describe("decodeBolt11", () => {
  it("separates the payee signer from routing and exposes all fields", async () => {
    const decoded = await decodeBolt11(COFFEE_INVOICE);
    expect(decoded.invoiceType).toBe(BOLT11);
    expect(decoded.invoiceAmountSat).toBe(250_000);
    // The signer (payee) is reported on its own, not mixed into routing.
    expect(decoded.signer).toBe(COFFEE_PAYEE);
    expect(isPubkey(decoded.signer!)).toBe(true);
    expect(decoded.routingNodes).toEqual([]);
    // Non-node fields are surfaced.
    const labels = decoded.fields.map((f) => f.label);
    expect(labels).toContain("Payment hash");
    expect(labels).toContain("Description");
  });
});

describe("decodeOffer", () => {
  it("reports the issuer id as signer for a minimal offer", async () => {
    const decoded = await decodeOffer(OFFER_MINIMAL);
    expect(decoded.invoiceType).toBe(OFFER);
    expect(decoded.signer).toBe(OFFER_ISSUER_ID);
    expect(decoded.routingNodes).toEqual([]);
    expect(decoded.invoiceAmountSat).toBeUndefined();
  });

  it("keeps the issuer as signer and the blinded-path intro as routing", async () => {
    const decoded = await decodeOffer(OFFER_WITH_PATH);
    expect(decoded.signer).toBe(OFFER_ISSUER_ID);
    expect(decoded.routingNodes).toEqual([OFFER_PATH_INTRO]);
  });

  it("has no signer when the offer omits the issuer id", async () => {
    const decoded = await decodeOffer(OFFER_NO_ISSUER_WITH_PATH);
    expect(decoded.signer).toBeUndefined();
    expect(decoded.routingNodes).toEqual([OFFER_PATH_INTRO]);
  });

  it("skips blinded paths whose first_node_id is a short_channel_id (sciddir)", async () => {
    const decoded = await decodeOffer(OFFER_SCIDDIR_PATH);
    expect(decoded.signer).toBe(OFFER_ISSUER_ID);
    expect(decoded.routingNodes).toEqual([]);
  });

  it("handles multiple paths mixing pubkey and sciddir first_node_ids", async () => {
    const decoded = await decodeOffer(OFFER_MIXED_PATHS);
    expect(decoded.signer).toBe(OFFER_ISSUER_ID);
    expect(decoded.routingNodes).toEqual([OFFER_PATH_INTRO]);
  });
});

describe("decodeBolt12 (invoice)", () => {
  it("reports node id as signer and converts the amount msat -> sat", async () => {
    const decoded = await decodeBolt12(BOLT12_INVOICE);
    expect(decoded.invoiceType).toBe(BOLT12);
    expect(decoded.invoiceAmountSat).toBe(76);
    expect(decoded.signer).toBe(BOLT12_INVOICE_NODE_ID);
    // Before dispatcher dedup, the single blinded path's intro equals the signer.
    expect(decoded.routingNodes).toContain(BOLT12_INVOICE_NODE_ID);
  });
});

describe("decodeInvoice", () => {
  it("dispatches to the BOLT11 decoder and reports the signer", async () => {
    const decoded = await decodeInvoice(BOLT11 as never, COFFEE_INVOICE);
    expect(decoded.invoiceType).toBe(BOLT11);
    expect(decoded.invoiceAmountSat).toBe(250_000);
    expect(decoded.signer).toBe(COFFEE_PAYEE);
  });

  it("drops the signer (and duplicates) from the routing nodes", async () => {
    const raw = await decodeBolt12(BOLT12_INVOICE);
    expect(raw.routingNodes).toContain(BOLT12_INVOICE_NODE_ID);
    const decoded = await decodeInvoice(BOLT12 as never, BOLT12_INVOICE);
    expect(decoded.signer).toBe(BOLT12_INVOICE_NODE_ID);
    // The only introduction node was the signer, so routing is now empty.
    expect(decoded.routingNodes).toEqual([]);
    expect(decoded.invoiceAmountSat).toBe(76);
  });

  it("dispatches to the offer decoder, separating signer and routing", async () => {
    const decoded = await decodeInvoice(OFFER as never, OFFER_WITH_PATH);
    expect(decoded.invoiceType).toBe(OFFER);
    expect(decoded.signer).toBe(OFFER_ISSUER_ID);
    expect(decoded.routingNodes).toEqual([OFFER_PATH_INTRO]);
  });
});

describe("decoded invoice fields", () => {
  it("formats every field encoded in a rich BOLT12 invoice", async () => {
    const decoded = await decodeBolt12(BOLT12_INVOICE);
    const byLabel = Object.fromEntries(
      decoded.fields.map((f) => [f.label, f.value]),
    );
    expect(byLabel["Description"]).toBe(
      "OCEAN Payouts for bc1qx84l47fj5grg0872p7fz8a73mwtq4csf64stme",
    );
    expect(byLabel["Created"]).toBe("2025-06-23 19:11:55 UTC");
    expect(byLabel["Payment hash"]).toBe(
      "b88302b7936b4af70435024b8445e203f9679436b43ea660b9a640908a50812c",
    );
    expect(byLabel["Payer key"]).toBe(
      "0341734861d02d0dbe2e9679f0bb988ecc6ee5947438454e9949fd71f41e6bfae1",
    );
    expect(byLabel["Features"]).toBe("020000");
  });
});

describe("formatUnix", () => {
  it("formats a unix timestamp (number or bigint) as a UTC string", () => {
    expect(formatUnix(0n)).toBe("1970-01-01 00:00:00 UTC");
    expect(formatUnix(1_000_000_000)).toBe("2001-09-09 01:46:40 UTC");
  });

  it("truncates fractional seconds instead of leaving a stray suffix", () => {
    expect(formatUnix(1.5)).toBe("1970-01-01 00:00:01 UTC");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [45, "45s"],
    [60, "1m"],
    [3600, "1h"],
    [90_000, "1d 1h"],
    [93_784, "1d 2h 3m 4s"],
  ])("formats %d seconds as %s", (secs, expected) => {
    expect(formatDuration(secs)).toBe(expected);
  });

  it("accepts bigint input", () => {
    expect(formatDuration(3661n)).toBe("1h 1m 1s");
  });
});

describe("chainName", () => {
  it("maps known chain hashes to human names", () => {
    expect(
      chainName(
        bytesFromHex(
          "6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000",
        ),
      ),
    ).toBe("bitcoin");
    expect(
      chainName(
        bytesFromHex(
          "43497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000",
        ),
      ),
    ).toBe("testnet");
  });

  it("falls back to hex for an unknown chain", () => {
    const hex = "00".repeat(32);
    expect(chainName(bytesFromHex(hex))).toBe(hex);
  });
});

describe("bolt11Features", () => {
  it("lists the enabled feature names in order", () => {
    expect(
      bolt11Features({
        word_length: 5,
        var_onion_optin: { supported: true },
        payment_secret: { required: true },
      }),
    ).toBe("var_onion_optin, payment_secret");
  });

  it("ignores metadata keys and unset flags", () => {
    expect(
      bolt11Features({
        word_length: 5,
        extra_bits: {},
        basic_mpp: { supported: false },
      }),
    ).toBeUndefined();
  });

  it("returns undefined when there are no feature bits", () => {
    expect(bolt11Features(undefined)).toBeUndefined();
  });
});

describe("toHex / toUtf8", () => {
  it("hex-encodes bytes or returns undefined", () => {
    expect(toHex(Uint8Array.from([1, 255]))).toBe("01ff");
    expect(toHex(undefined)).toBeUndefined();
  });

  it("utf8-decodes bytes", () => {
    expect(toUtf8(bytesFromHex("6269703335"))).toBe("bip35");
  });
});

describe("fetcher", () => {
  it("returns parsed JSON on a successful response", async () => {
    const payload = { alias: "test-node" };
    global.fetch = (async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
      })) as typeof fetch;

    await expect(fetcher("https://example.com/ok")).resolves.toEqual(payload);
  });

  it("throws the API error field when the response is not ok", async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ error: "node not found" }), {
        status: 404,
      })) as typeof fetch;

    await expect(fetcher("https://example.com/missing")).rejects.toThrow(
      "node not found",
    );
  });

  it("falls back to statusText when the error body has no error field", async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({}), {
        status: 500,
        statusText: "Internal Server Error",
      })) as typeof fetch;

    await expect(fetcher("https://example.com/boom")).rejects.toThrow(
      "Internal Server Error",
    );
  });
});
