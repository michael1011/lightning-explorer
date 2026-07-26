import { bech32, utf8 } from "@scure/base";
import { AtSign, Link2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import useSWR from "swr";

import { lookup } from "../lib/dohLookup";
import { API_URL, CURRENCY, DNS_OVER_HTTPS } from "../lib/env";
import { isLnurl, isSatsAddress, trimLongString } from "../lib/utils";
import Error from "./Error";
import Header from "./Header";
import LoadingSpinner, { LoadingSpinnerFullscreen } from "./LoadingSpinner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const enum InfoType {
  LNURL = "LNURL",
  BIP353 = "BIP-353",
}

type Info = {
  type: InfoType;
  properties: Record<string, string>;
};

const getLnurl = async (lnurl: string): Promise<Info> => {
  const res = await fetch(lnurl);
  const data = await res.json();

  if (data.status === "ERROR") {
    throw "LNURL threw error";
  }

  return {
    type: InfoType.LNURL,
    properties: {
      url: lnurl,
      ...data,
    },
  };
};

const resolveBip353 = async (bip353: string): Promise<Info> => {
  const split = bip353.split("@");
  if (split.length !== 2) {
    throw "invalid BIP-353";
  }

  const bip353Prefix = "₿";
  if (split[0].startsWith(bip353Prefix)) {
    split[0] = split[0].substring(bip353Prefix.length);
  }

  console.log(`Fetching BIP-353: ${bip353}`);

  const res = await lookup(
    `${split[0]}.user._bitcoin-payment.${split[1]}`,
    "txt",
    DNS_OVER_HTTPS,
  );

  const nowUnix = Date.now() / 1_000;
  if (nowUnix < res.valid_from) {
    throw "proof is not valid yet";
  }
  if (nowUnix > res.expires) {
    throw "proof has expired";
  }

  if (res.verified_rrs === undefined || res.verified_rrs.length === 0) {
    throw "no TXT record";
  }

  if (res.verified_rrs[0].type !== "txt") {
    throw "invalid proof";
  }

  const paymentRequest = res.verified_rrs[0].contents;
  const offer = new URLSearchParams(paymentRequest.split("?")[1])
    .get("lno")!
    .replace(/"/g, "");

  console.log("Resolved offer for BIP-353:", offer);
  return {
    type: InfoType.BIP353,
    properties: {
      offer: offer,
    },
  };
};

const InfoCard = ({ type, properties }: Info) => {
  const [amount, setAmount] = useState(0);
  const [invoice, setInvoice] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [fetching, setFetching] = useState(false);

  const fetchInvoice = async () => {
    setInvoice(undefined);
    setError(undefined);
    setFetching(true);

    try {
      switch (type) {
        case InfoType.LNURL: {
          const url = new URL(properties.callback);
          url.searchParams.set(
            "amount",
            (BigInt(amount) * BigInt(1000)).toString(),
          );

          const res = await fetch(url.toString());
          const data = await res.json();

          if (data.status === "ERROR") {
            setError(data.reason);
            return;
          }

          setInvoice(data.pr);
          break;
        }

        default: {
          const res = await fetch(
            `${API_URL}/v2/lightning/${CURRENCY}/bolt12/fetch`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                offer: properties.offer,
                amount: amount,
              }),
            },
          );

          const data = await res.json();
          setInvoice(data.invoice);
        }
      }
    } catch (error) {
      setError(error as string);
      console.error("Invoice fetch error", error);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <span className="text-node-accent grid size-7 place-items-center rounded-md bg-[color-mix(in_oklab,var(--node-accent)_18%,transparent)]">
          {type === InfoType.LNURL ? (
            <Link2 className="size-4" />
          ) : (
            <AtSign className="size-4" />
          )}
        </span>
        <h2 className="text-lg font-semibold">{type}</h2>
      </div>

      <div className="text-muted-foreground mt-3 flex flex-col gap-1 font-mono text-sm break-all">
        {Object.entries(properties)
          .filter(([, value]) => typeof value !== "object")
          .map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
      </div>

      <div className="mt-4 flex flex-row gap-2">
        <Input
          type="number"
          placeholder="Amount (sats)"
          onChange={(e) => setAmount(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              fetchInvoice();
            }
          }}
        />
        <Button disabled={amount === 0 || fetching} onClick={fetchInvoice}>
          Fetch
        </Button>
      </div>

      {fetching && (
        <div className="mt-4 flex justify-center">
          <LoadingSpinner />
        </div>
      )}
      {invoice && (
        <p className="bg-secondary/50 mt-4 rounded-lg p-3 font-mono text-sm break-all">
          {invoice}
        </p>
      )}
      {error && <p className="text-destructive mt-4 text-center">{error}</p>}
    </div>
  );
};

const Resolver = () => {
  const { input } = useParams();
  const decodedInput = input ? decodeURIComponent(input) : undefined;

  const info = useSWR<Info[]>(decodedInput, async () => {
    if (decodedInput === undefined) {
      return [];
    }

    const promises: Promise<Info>[] = [];

    if (isSatsAddress(decodedInput)) {
      const urlsplit = decodedInput.split("@");
      const lnurl = `https://${urlsplit[1]}/.well-known/lnurlp/${urlsplit[0]}`;

      promises.push(getLnurl(lnurl));
      promises.push(resolveBip353(decodedInput));
    } else if (isLnurl(decodedInput)) {
      const { bytes } = bech32.decodeToBytes(decodedInput);
      promises.push(getLnurl(utf8.encode(bytes)));
    }

    return await Promise.allSettled(promises)
      .then((res) => res.filter((r) => r.status === "fulfilled"))
      .then((res) => res.map((r) => r.value));
  });

  if (info.error) {
    return <Error error={info.error} />;
  }
  if (info.isLoading) {
    return <LoadingSpinnerFullscreen />;
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 pt-12 pb-16">
        <span className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Resolve
        </span>
        <h1 className="mt-2 text-center break-all">
          Resolving: {trimLongString(decodedInput!)}
        </h1>

        <div className="mt-8 flex w-full flex-col gap-4">
          {info.data!.length === 0 && (
            <h2 className="text-muted-foreground text-center">No info found</h2>
          )}
          {info.data!.map((info) => (
            <InfoCard
              key={info.type}
              type={info.type}
              properties={info.properties}
            />
          ))}
        </div>
      </main>
    </>
  );
};

export default Resolver;
