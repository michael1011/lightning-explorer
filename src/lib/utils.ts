import { Buffer } from "buffer";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const decimals = 8;
const satFactor = 100_000_000;

export const enum InvoiceType {
  Bolt11 = "BOLT11",
  Offer = "BOLT12 offer",
  Bolt12 = "BOLT12 invoice",
}

export type DecodedField = {
  label: string;
  value: string;
};

export type DecodedInvoice = {
  invoiceType: InvoiceType;
  // The node that signed the invoice/offer, kept separate from routing info.
  signer?: string;
  // Routing hints (BOLT11) or blinded-path introduction nodes (BOLT12).
  routingNodes: string[];
  // Every other field encoded in the invoice/offer, formatted for display.
  fields: DecodedField[];
  invoiceAmountSat?: number;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorRes = await res.json();
    throw new Error(errorRes.error ?? res.statusText);
  }

  return res.json();
};

export const satoshisToSatcomma = (satoshis: number): string => {
  let coins = (satoshis / satFactor).toFixed(decimals);
  for (const [num, index] of [3, 6].entries()) {
    coins = `${coins.substring(
      0,
      coins.length - index - num,
    )} ${coins.substring(coins.length - index - num)}`;
  }
  return coins;
};

export const isPubkey = (pubkey: string) => {
  return /^[0-9a-fA-F]{66}$/.test(pubkey);
};

export const isChannelId = (channelId: string) => {
  return (
    (channelId.split("x").length === 3 && channelId.length < 15) ||
    !isNaN(Number(channelId))
  );
};

export const isSatsAddress = (input: string) => {
  return input.includes("@");
};

export const isLnurl = (input: string) => {
  return input.trim().toLowerCase().startsWith("lnurl");
};

export const isToBeResolved = (input: string) => {
  return isSatsAddress(input) || isLnurl(input);
};

export const trimLongString = (str: string) => {
  if (str.length < 23) {
    return str;
  }

  return `${str.slice(0, 10)}...${str.slice(-10)}`;
};

export const isInvoice = (invoice: string): InvoiceType | undefined => {
  const cmp = invoice.toLowerCase();

  if (cmp.startsWith("lnbc")) {
    return InvoiceType.Bolt11;
  } else if (cmp.startsWith("lno")) {
    return InvoiceType.Offer;
  } else if (cmp.startsWith("lni")) {
    return InvoiceType.Bolt12;
  }

  return undefined;
};

// A field is only emitted when it carries a value.
const field = (
  label: string,
  value: string | number | bigint | undefined | null,
): DecodedField | undefined =>
  value === undefined || value === null || value === ""
    ? undefined
    : { label, value: String(value) };

const collectFields = (entries: (DecodedField | undefined)[]): DecodedField[] =>
  entries.filter((entry): entry is DecodedField => entry !== undefined);

// The formatting helpers below are pure and exported so they can be unit-tested
// directly — real invoice vectors rarely populate every optional field.
export const toHex = (bytes?: Uint8Array): string | undefined =>
  bytes === undefined ? undefined : Buffer.from(bytes).toString("hex");

export const toUtf8 = (bytes: Uint8Array): string =>
  new TextDecoder().decode(bytes);

export const formatUnix = (seconds: bigint | number): string =>
  // Slice off the milliseconds instead of matching ".000Z", which would leave
  // a stray "Z" if a fractional timestamp ever slipped through.
  `${new Date(Number(seconds) * 1000).toISOString().slice(0, 19).replace("T", " ")} UTC`;

export const formatDuration = (seconds: bigint | number): string => {
  let remaining = Number(seconds);
  const parts: string[] = [];
  for (const [size, suffix] of [
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
    [1, "s"],
  ] as const) {
    const count = Math.floor(remaining / size);
    if (count > 0) {
      parts.push(`${count}${suffix}`);
    }
    remaining -= count * size;
  }
  return parts.length > 0 ? parts.join(" ") : "0s";
};

// BOLT chain hashes (genesis block hash, internal byte order).
const CHAIN_NAMES: Record<string, string> = {
  "6fe28c0ab6f1b372c1a6a246ae63f74f931e8365e15a089c68d6190000000000": "bitcoin",
  "43497fd7f826957108f4a30fd9cec3aeba79972084e90ead01ea330900000000": "testnet",
};

export const chainName = (bytes: Uint8Array): string => {
  const hex = Buffer.from(bytes).toString("hex");
  return CHAIN_NAMES[hex] ?? hex;
};

const NETWORK_NAMES: Record<string, string> = {
  bc: "bitcoin",
  tb: "testnet",
  bcrt: "regtest",
  tbs: "signet",
};

type FeatureFlag = { required?: boolean; supported?: boolean };

export const bolt11Features = (
  featureBits: Record<string, unknown> | undefined,
): string | undefined => {
  if (featureBits === undefined) {
    return undefined;
  }
  const names = Object.entries(featureBits)
    .filter(([key]) => key !== "word_length" && key !== "extra_bits")
    .filter(([, value]) => {
      const flag = value as FeatureFlag;
      return (
        Boolean(flag) && (flag.required === true || flag.supported === true)
      );
    })
    .map(([key]) => key);
  return names.length > 0 ? names.join(", ") : undefined;
};

export const decodeInvoice = async (
  invoiceType: InvoiceType,
  invoice: string,
): Promise<DecodedInvoice> => {
  let res: DecodedInvoice;

  switch (invoiceType) {
    case InvoiceType.Bolt11:
      res = await decodeBolt11(invoice);
      break;
    case InvoiceType.Offer:
      res = await decodeOffer(invoice);
      break;
    case InvoiceType.Bolt12:
      res = await decodeBolt12(invoice);
      break;
  }

  // Deduplicate routing nodes, and drop any that is also the signer (e.g. a
  // single blinded path leading back to the payee) so the two are cleanly split.
  const routingNodes = [...new Set(res.routingNodes)].filter(
    (pubkey) => pubkey !== res.signer,
  );

  return { ...res, routingNodes };
};

export const decodeBolt11 = async (
  invoice: string,
): Promise<DecodedInvoice> => {
  const bolt11 = await import("@atomiqlabs/bolt11");
  const decoded = bolt11.decode(invoice);
  const tags = decoded.tagsObject;

  // Routing hints and any blinded-path introduction nodes — not the signer.
  const routingNodes = [
    ...(tags.routing_info?.map((hop) => hop.pubkey) ?? []),
    ...(tags.blinded_payinfo
      ?.map((path) => path.introduction_node)
      .filter((node): node is string => Boolean(node)) ?? []),
  ];

  const fields = collectFields([
    field(
      "Network",
      decoded.network
        ? (NETWORK_NAMES[decoded.network.bech32] ?? decoded.network.bech32)
        : undefined,
    ),
    field("Description", tags.description),
    field("Payment hash", tags.payment_hash),
    field("Payment secret", tags.payment_secret),
    decoded.timestamp !== undefined
      ? field("Created", formatUnix(decoded.timestamp))
      : undefined,
    tags.expire_time !== undefined
      ? field("Expiry", formatDuration(tags.expire_time))
      : undefined,
    field("Min final CLTV", tags.min_final_cltv_expiry),
    field("Fallback address", tags.fallback_address?.address),
    field(
      "Features",
      bolt11Features(
        tags.feature_bits as unknown as Record<string, unknown> | undefined,
      ),
    ),
    tags.routing_info?.length
      ? field("Routing hints", tags.routing_info.length)
      : undefined,
  ]);

  return {
    invoiceType: InvoiceType.Bolt11,
    signer: decoded.payeeNodeKey,
    routingNodes,
    fields,
    invoiceAmountSat: decoded.satoshis ?? undefined,
  };
};

// Extract the first_node_id (introduction node) pubkey of every blinded path in
// a BOLT12 blinded_path array (the raw bytes of an offer_paths/invoice_paths
// TLV value). Paths whose first_node_id is a short_channel_id reference (prefix
// 0x00 or 0x01) carry no pubkey and are skipped. Per-path layout:
//   first_node_id: 33-byte point (0x02/0x03) or 9-byte sciddir (0x00/0x01)
//   path_key:      33-byte point
//   num_hops:      u8
//   hops:          num_hops * (blinded_node_id[33] + enclen[u16] + data[enclen])
const blindedPathIntroductionNodes = (data?: Uint8Array): string[] => {
  if (data === undefined) {
    return [];
  }

  const nodes: string[] = [];
  let offset = 0;

  try {
    while (offset < data.length) {
      const prefix = data[offset];
      if (prefix === 0x02 || prefix === 0x03) {
        nodes.push(
          Buffer.from(data.subarray(offset, offset + 33)).toString("hex"),
        );
        offset += 33;
      } else if (prefix === 0x00 || prefix === 0x01) {
        offset += 9; // sciddir reference: no node pubkey
      } else {
        break;
      }

      offset += 33; // path_key
      const numHops = data[offset];
      offset += 1;
      for (let hop = 0; hop < numHops; hop++) {
        offset += 33; // blinded_node_id
        const enclen = (data[offset] << 8) | data[offset + 1];
        offset += 2 + enclen; // enclen field + encrypted_recipient_data
      }
    }
  } catch {
    // Best-effort: return whatever was parsed before hitting malformed data
  }

  return nodes;
};

export const decodeOffer = async (offer: string): Promise<DecodedInvoice> => {
  const {
    decodeBolt12: decodeBolt12String,
    parseTlvStream,
    extractGeneratedOfferFields,
  } = await import("bolt12-utils");

  const offerFields = extractGeneratedOfferFields(
    parseTlvStream(decodeBolt12String(offer).data),
  );

  const fields = collectFields([
    field("Description", offerFields.offer_description),
    field("Issuer", offerFields.offer_issuer),
    offerFields.offer_amount !== undefined
      ? field(
          "Amount",
          offerFields.offer_currency
            ? `${offerFields.offer_amount} ${offerFields.offer_currency}`
            : `${satoshisToSatcomma(Number(offerFields.offer_amount / 1_000n))} BTC`,
        )
      : undefined,
    field("Currency", offerFields.offer_currency),
    offerFields.offer_chains?.length
      ? field("Chains", offerFields.offer_chains.map(chainName).join(", "))
      : undefined,
    offerFields.offer_quantity_max !== undefined
      ? field(
          "Max quantity",
          offerFields.offer_quantity_max === 0n
            ? "unlimited"
            : offerFields.offer_quantity_max,
        )
      : undefined,
    offerFields.offer_absolute_expiry !== undefined
      ? field("Expires at", formatUnix(offerFields.offer_absolute_expiry))
      : undefined,
    field("Metadata", toHex(offerFields.offer_metadata)),
    field("Features", toHex(offerFields.offer_features)),
  ]);

  return {
    invoiceType: InvoiceType.Offer,
    signer: toHex(offerFields.offer_issuer_id),
    routingNodes: blindedPathIntroductionNodes(offerFields.offer_paths),
    fields,
  };
};

export const decodeBolt12 = async (
  invoice: string,
): Promise<DecodedInvoice> => {
  const {
    decodeBolt12: decodeBolt12String,
    parseTlvStream,
    extractInvoiceFields,
  } = await import("bolt12-utils");

  const invoiceFields = extractInvoiceFields(
    parseTlvStream(decodeBolt12String(invoice).data),
  );

  const invoiceAmountSat =
    invoiceFields.invoice_amount !== undefined
      ? Number(invoiceFields.invoice_amount / 1_000n)
      : undefined;

  const fields = collectFields([
    field("Description", invoiceFields.offer_description),
    field("Issuer", invoiceFields.offer_issuer),
    invoiceFields.invoice_created_at !== undefined
      ? field("Created", formatUnix(invoiceFields.invoice_created_at))
      : undefined,
    invoiceFields.invoice_relative_expiry !== undefined
      ? field("Expiry", formatDuration(invoiceFields.invoice_relative_expiry))
      : undefined,
    field("Payment hash", toHex(invoiceFields.invoice_payment_hash)),
    field("Payer note", invoiceFields.invreq_payer_note),
    field("Payer key", toHex(invoiceFields.invreq_payer_id)),
    invoiceFields.invreq_quantity !== undefined
      ? field("Quantity", invoiceFields.invreq_quantity)
      : undefined,
    invoiceFields.invreq_bip_353_name !== undefined
      ? field(
          "BIP-353",
          `${toUtf8(invoiceFields.invreq_bip_353_name.name)}@${toUtf8(
            invoiceFields.invreq_bip_353_name.domain,
          )}`,
        )
      : undefined,
    invoiceFields.offer_chains?.length
      ? field("Chains", invoiceFields.offer_chains.map(chainName).join(", "))
      : undefined,
    field("Features", toHex(invoiceFields.invoice_features)),
    field("Fallbacks", toHex(invoiceFields.invoice_fallbacks)),
  ]);

  return {
    invoiceType: InvoiceType.Bolt12,
    signer: toHex(invoiceFields.invoice_node_id),
    routingNodes: [
      ...blindedPathIntroductionNodes(invoiceFields.invoice_paths),
      ...blindedPathIntroductionNodes(invoiceFields.offer_paths),
    ],
    fields,
    invoiceAmountSat,
  };
};

export const scidLndToCln = (s: string): string => {
  const big = BigInt(s);
  const block = big >> BigInt(40);
  const tx = (big >> BigInt(16)) & BigInt(0xffffff);
  const output = big & BigInt(0xffff);
  return [block, tx, output].join("x");
};

export const scidClnToLnd = (s: string): string => {
  const parts = s.split("x").map((part) => BigInt(part));
  return (
    (parts[0] << BigInt(40)) |
    (parts[1] << BigInt(16)) |
    parts[2]
  ).toString();
};

export const convertChannelid = (id: string): string => {
  if (id.includes("x")) {
    return scidClnToLnd(id);
  }

  return scidLndToCln(id);
};
