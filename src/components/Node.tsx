import { CopyButton } from "@/components/ui/copy-button";
import { nodeAccentDark, nodeAccentLight, nodeSwatch } from "@/lib/color";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import useSWR from "swr";

import { API_URL, CURRENCY } from "../lib/env";
import { satoshisToSatcomma, trimLongString } from "../lib/utils";
import Error from "./Error";
import Header from "./Header";
import LoadingSpinner, { LoadingSpinnerFullscreen } from "./LoadingSpinner";

export type NodeInfo = {
  alias: string;
  color: string;
  id: string;
};

export type Channel = {
  source: {
    id: string;
    alias: string;
    color: string;
  };
  shortChannelId: string;
  capacity: number;
  active: boolean;
  info: {
    baseFeeMillisatoshi: number;
    feePpm: number;
    delay: number;
    htlcMinimumMillisatoshi: number;
    htlcMaximumMillisatoshi: number;
  };
};

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border-border/60 bg-card/40 flex flex-col gap-1 rounded-xl border p-4">
      <span className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </span>
      <span className="font-mono text-xl font-medium">{value}</span>
      {sub && <span className="text-muted-foreground text-xs">{sub}</span>}
    </div>
  );
}

function ChannelRow({ channel, max }: { channel: Channel; max: number }) {
  const pct = max > 0 ? Math.max(2, (channel.capacity / max) * 100) : 0;

  return (
    // The whole card links to the channel via an overlay pseudo-element, so the
    // peer link below can still be clicked independently (no nested anchors).
    <li
      className={`border-border/50 relative grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border p-4 transition-colors md:grid-cols-[11rem_1fr_9rem] md:items-center ${
        channel.active
          ? "bg-card/30 hover:border-border hover:bg-card/70"
          : "bg-card/20 opacity-70"
      }`}>
      {/* Channel (primary link — its ::after overlays the entire card) */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          to={`/channel/${channel.shortChannelId}`}
          className="text-node-accent font-mono text-sm after:absolute after:inset-0 hover:underline">
          {channel.shortChannelId}
        </Link>
        {!channel.active && (
          <span className="text-muted-foreground text-[0.65rem] tracking-wide uppercase">
            inactive
          </span>
        )}
      </div>

      {/* Peer (sits above the overlay so it stays clickable on its own) */}
      <Link
        to={`/node/${channel.source.id}`}
        className="group relative z-10 flex w-fit min-w-0 items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
          style={{ background: nodeSwatch(channel.source.color) }}
        />
        <span className="truncate font-medium group-hover:underline">
          {channel.source.alias || "Unknown"}
        </span>
        <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
          {trimLongString(channel.source.id)}
        </span>
      </Link>

      {/* Capacity + charge bar */}
      <div className="flex flex-col gap-1.5 md:items-end">
        <span className="font-mono text-sm">
          {satoshisToSatcomma(channel.capacity)}
        </span>
        <div className="bg-secondary h-1 w-full overflow-hidden rounded-full md:w-28">
          <div
            className="bg-node-accent h-full rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

function Channels({ channels }: { channels: Channel[] }) {
  const stats = useMemo(() => {
    const total = channels.length;
    const active = channels.filter((c) => c.active);
    const capacity = channels.reduce((acc, c) => acc + c.capacity, 0);
    const activeCapacity = active.reduce((acc, c) => acc + c.capacity, 0);
    const adjustedPpm = (
      active.reduce((acc, c) => acc + c.info.feePpm * c.capacity, 0) /
        activeCapacity || 0
    ).toFixed(0);
    const activePct = total > 0 ? (active.length / total) * 100 : 0;

    return {
      total,
      inactive: total - active.length,
      capacity,
      adjustedPpm,
      activePct,
    };
  }, [channels]);

  const maxCapacity = useMemo(
    () => channels.reduce((acc, c) => Math.max(acc, c.capacity), 0),
    [channels],
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Channels" value={String(stats.total)} />
        <StatTile
          label="Capacity"
          value={satoshisToSatcomma(stats.capacity)}
          sub="BTC"
        />
        <StatTile
          label="Active"
          value={`${stats.activePct.toFixed(0)}%`}
          sub={`${stats.inactive} inactive`}
        />
        <StatTile
          label="Avg PPM"
          value={stats.adjustedPpm}
          sub="capacity-weighted"
        />
      </div>

      <div className="mt-8">
        <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
          All channels
        </h2>
        <ul className="flex flex-col gap-2">
          {channels.map((channel) => (
            <ChannelRow
              key={channel.shortChannelId}
              channel={channel}
              max={maxCapacity}
            />
          ))}
        </ul>
      </div>
    </>
  );
}

function Node() {
  const { node } = useParams();
  const nodeInfo = useSWR<NodeInfo>(
    `${API_URL}/v2/lightning/${CURRENCY}/node/${node}`,
  );
  const channels = useSWR<Channel[]>(
    `${API_URL}/v2/lightning/${CURRENCY}/channels/${node}`,
  );

  if (nodeInfo.error || channels.error) {
    return <Error error={nodeInfo.error || channels.error} />;
  }
  if (nodeInfo.isLoading) {
    return <LoadingSpinnerFullscreen />;
  }

  const info = nodeInfo.data!;
  // One variant per theme — index.css picks whichever suits the active
  // background, so a color that only reads on dark doesn't wash out on light.
  const accentStyle = {
    "--node-accent-light": nodeAccentLight(info.color),
    "--node-accent-dark": nodeAccentDark(info.color),
  } as CSSProperties;

  return (
    // Scope the node's accent over the whole page so the chrome (header bolt)
    // tunes to the node's color too, not just the content.
    <div style={accentStyle} data-node-accent="">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Identity */}
        <section className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-16 size-64 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--node-accent)" }}
          />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/30"
                style={{ background: nodeSwatch(info.color) }}
              />
              <span className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
                Node
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight break-words sm:text-4xl">
              {info.alias || "Unknown node"}
            </h1>
            <div className="bg-secondary/50 flex items-center gap-1 self-start rounded-lg py-1 pr-1 pl-3">
              <span className="text-muted-foreground font-mono text-sm break-all">
                {info.id}
              </span>
              <CopyButton value={info.id} label="Copy node key" />
            </div>
          </div>
        </section>

        <div className="mt-6">
          {channels.isLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : (
            <Channels
              channels={[...channels.data!].sort(
                (a, b) => b.capacity - a.capacity,
              )}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default Node;
