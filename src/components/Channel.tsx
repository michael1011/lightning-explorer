import { nodeSwatch } from "@/lib/color";
import { ArrowLeftRight } from "lucide-react";
import { Fragment } from "react";
import { Link, useParams } from "react-router";
import useSWR from "swr";

import { API_URL, CURRENCY } from "../lib/env";
import {
  convertChannelid,
  satoshisToSatcomma,
  trimLongString,
} from "../lib/utils";
import Error from "./Error";
import Header from "./Header";
import { LoadingSpinnerFullscreen } from "./LoadingSpinner";

type Policy = {
  node: {
    id: string;
    alias: string;
    color: string;
  };
  active: boolean;
  baseFeeMillisatoshi: number;
  feePpm: number;
  delay: number;
  htlcMinimumMillisatoshi: number;
  htlcMaximumMillisatoshi: number;
};

type ChannelInfo = {
  shortChannelId: string;
  capacity: number;
  policies: [Policy, Policy];
};

function Policy({ policy }: { policy: Policy }) {
  return (
    <div
      className={`border-border bg-card flex-1 rounded-2xl border p-5 ${
        !policy.active ? "opacity-70" : ""
      }`}>
      <Link
        to={`/node/${policy.node.id}`}
        className="group flex items-center gap-2">
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/30"
          style={{ background: nodeSwatch(policy.node.color) }}
        />
        <h2 className="truncate text-lg font-semibold group-hover:underline">
          {policy.node.alias || "Unknown"}
        </h2>
        {!policy.active && (
          <span className="border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[0.65rem] uppercase">
            inactive
          </span>
        )}
      </Link>
      <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
        {trimLongString(policy.node.id)}
      </p>

      <div className="mt-5 grid grid-cols-1 gap-y-2 font-mono text-sm sm:grid-cols-2 sm:gap-x-6">
        <span>
          Base Fee: {(policy.baseFeeMillisatoshi / 1_000).toFixed(3)} sat
        </span>
        <span>Fee PPM: {policy.feePpm}</span>
        <span>
          HTLC Min: {satoshisToSatcomma(policy.htlcMinimumMillisatoshi / 1_000)}
        </span>
        <span>
          HTLC Max: {satoshisToSatcomma(policy.htlcMaximumMillisatoshi / 1_000)}
        </span>
        <span>Delay: {policy.delay}</span>
      </div>
    </div>
  );
}

export default function Channel() {
  const { channel } = useParams();
  const channelInfo = useSWR<ChannelInfo>(
    `${API_URL}/v2/lightning/${CURRENCY}/channel/${channel}`,
  );

  if (channelInfo.error) {
    return <Error error={channelInfo.error} />;
  }
  if (channelInfo.isLoading) {
    return <LoadingSpinnerFullscreen />;
  }

  const data = channelInfo.data!;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-12 pb-16">
        <span className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Channel
        </span>
        <h1 className="mt-2">Channel</h1>

        <div className="mt-3 flex flex-col items-center gap-0.5">
          <span className="font-mono text-lg">{data.shortChannelId}</span>
          <span className="text-muted-foreground font-mono text-sm">
            {convertChannelid(data.shortChannelId)}
          </span>
        </div>

        <p className="mt-4 font-mono">
          Capacity: {satoshisToSatcomma(data.capacity)}
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch gap-4 md:flex-row md:items-center">
          {data.policies.map((policy, i) => (
            <Fragment key={policy.node.id}>
              {i > 0 && (
                <ArrowLeftRight className="text-muted-foreground mx-auto hidden size-5 shrink-0 md:block" />
              )}
              <Policy policy={policy} />
            </Fragment>
          ))}
        </div>
      </main>
    </>
  );
}
