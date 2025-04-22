import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const decimals = 8;
const satFactor = 100_000_000;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
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

export const trimPubkey = (pubkey: string) =>
  `${pubkey.slice(0, 10)}...${pubkey.slice(-10)}`;
