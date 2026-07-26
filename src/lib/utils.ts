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

export type DecodedInvoice = {
  invoiceType: InvoiceType;
  pubkeys: string[];
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

  return {
    invoiceType,
    // Deduplicate the pubkeys in the result
    pubkeys: [...new Set(res.pubkeys)],
    invoiceAmountSat: res.invoiceAmountSat,
  };
};

export const decodeBolt11 = async (
  invoice: string,
): Promise<DecodedInvoice> => {
  const bolt11 = await import("@atomiqlabs/bolt11");
  const decoded = bolt11.decode(invoice);

  return {
    invoiceType: InvoiceType.Bolt11,
    invoiceAmountSat: decoded.satoshis ?? undefined,
    pubkeys: [
      decoded.payeeNodeKey,
      ...(decoded.tagsObject.routing_info?.map((r) => r.pubkey) ?? []),
    ].filter((p): p is string => p !== undefined),
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

  const fields = extractGeneratedOfferFields(
    parseTlvStream(decodeBolt12String(offer).data),
  );

  return {
    invoiceType: InvoiceType.Offer,
    pubkeys: [
      ...(fields.offer_issuer_id !== undefined
        ? [Buffer.from(fields.offer_issuer_id).toString("hex")]
        : []),
      ...blindedPathIntroductionNodes(fields.offer_paths),
    ],
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

  const fields = extractInvoiceFields(
    parseTlvStream(decodeBolt12String(invoice).data),
  );

  return {
    invoiceType: InvoiceType.Bolt12,
    invoiceAmountSat:
      fields.invoice_amount !== undefined
        ? Number(fields.invoice_amount / 1_000n)
        : undefined,
    pubkeys: [
      ...(fields.invoice_node_id !== undefined
        ? [Buffer.from(fields.invoice_node_id).toString("hex")]
        : []),
      ...blindedPathIntroductionNodes(fields.invoice_paths),
      ...blindedPathIntroductionNodes(fields.offer_paths),
    ],
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
