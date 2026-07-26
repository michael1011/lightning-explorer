import { nodeSwatch } from "@/lib/color";
import { Link, useParams } from "react-router";
import useSWR from "swr";

import { API_URL, CURRENCY } from "../lib/env";
import type { DecodedField, DecodedInvoice, InvoiceType } from "../lib/utils";
import {
  decodeInvoice,
  fetcher,
  isInvoice,
  satoshisToSatcomma,
  trimLongString,
} from "../lib/utils";
import Error from "./Error";
import Header from "./Header";
import { LoadingSpinnerFullscreen } from "./LoadingSpinner";
import type { Channel, NodeInfo } from "./Node";

// -- Alias search ----------------------------------------------------------

function SearchResult({
  nodeInfo,
  channels,
}: {
  nodeInfo: NodeInfo;
  channels: Channel[] | undefined;
}) {
  const capacity = channels?.reduce((acc, c) => acc + c.capacity, 0) ?? 0;

  return (
    <Link
      to={`/node/${nodeInfo.id}`}
      className="border-border/60 bg-card/40 hover:border-border hover:bg-card/70 block rounded-xl border p-4 transition-colors">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
          style={{ background: nodeSwatch(nodeInfo.color) }}
        />
        <span className="truncate font-semibold">{nodeInfo.alias}</span>
      </div>
      <p className="text-muted-foreground mt-1 font-mono text-xs">
        {trimLongString(nodeInfo.id)}
      </p>
      <div className="text-muted-foreground mt-3 flex gap-5 font-mono text-sm">
        {channels !== undefined ? (
          <>
            <span>Channels: {channels.length}</span>
            <span>Capacity: {satoshisToSatcomma(capacity)}</span>
          </>
        ) : (
          <span>Loading…</span>
        )}
      </div>
    </Link>
  );
}

function AliasSearchView({ query }: { query: string }) {
  const nodeInfo = useSWR<NodeInfo[]>(
    `${API_URL}/v2/lightning/${CURRENCY}/search?${new URLSearchParams({
      alias: query,
    })}`,
    (url: string) => fetcher<NodeInfo[]>(url),
  );

  const channelDataKeys = nodeInfo.data?.map(
    (node) => `${API_URL}/v2/lightning/${CURRENCY}/channels/${node.id}`,
  );

  const channelsData = useSWR<Record<string, Channel[]>>(
    nodeInfo.data ? ["channels", ...channelDataKeys!] : null,
    async () => {
      const results = await Promise.allSettled(
        nodeInfo.data!.map(async (node) => {
          try {
            const channels = await fetcher<Channel[]>(
              `${API_URL}/v2/lightning/${CURRENCY}/channels/${node.id}`,
            );
            return { nodeId: node.id, channels };
          } catch {
            return { nodeId: node.id, channels: [] };
          }
        }),
      );

      const channelMap: Record<string, Channel[]> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          channelMap[result.value.nodeId] = result.value.channels;
        }
      });
      return channelMap;
    },
  );

  if (nodeInfo.error) {
    return <Error error={nodeInfo.error} />;
  }
  if (nodeInfo.isLoading) {
    return <LoadingSpinnerFullscreen />;
  }

  const sortedNodes = [...nodeInfo.data!].sort((a, b) => {
    const capacityA = (channelsData.data?.[a.id] || []).reduce(
      (acc, c) => acc + c.capacity,
      0,
    );
    const capacityB = (channelsData.data?.[b.id] || []).reduce(
      (acc, c) => acc + c.capacity,
      0,
    );
    return capacityB - capacityA;
  });

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-12 pb-16">
        <span className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Search
        </span>
        <h1 className="mt-2">Search result</h1>
        <p className="text-muted-foreground mt-2">
          {nodeInfo.data!.length} results found for "{trimLongString(query)}"
        </p>
        <div className="mt-8 flex w-full flex-col gap-3">
          {sortedNodes.map((node) => (
            <SearchResult
              key={node.id}
              nodeInfo={node}
              channels={channelsData.data?.[node.id]}
            />
          ))}
        </div>
      </main>
    </>
  );
}

// -- Decoded invoice / offer ----------------------------------------------

// Keyed by the InvoiceType enum values so TS flags drift if one is reworded.
const SIGNER_LABEL = {
  BOLT11: "Payee node",
  "BOLT12 offer": "Offer issuer",
  "BOLT12 invoice": "Invoice node",
} satisfies Record<InvoiceType, string>;

const ROUTING_LABEL = {
  BOLT11: "Routing hints",
  "BOLT12 offer": "Blinded path introduction nodes",
  "BOLT12 invoice": "Blinded path introduction nodes",
} satisfies Record<InvoiceType, string>;

function FieldList({ fields }: { fields: DecodedField[] }) {
  if (fields.length === 0) {
    return null;
  }
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <dl className="flex flex-col divide-y divide-border/60">
        {fields.map((f) => (
          <div
            key={f.label}
            className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <dt className="text-muted-foreground shrink-0 text-sm">
              {f.label}
            </dt>
            <dd className="font-mono text-sm break-all sm:text-right">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NodeRef({
  label,
  pubkey,
  node,
  loading,
}: {
  label: string;
  pubkey: string;
  node?: NodeInfo;
  loading: boolean;
}) {
  return (
    <Link
      to={`/node/${pubkey}`}
      className="border-border/60 bg-card/40 hover:border-border hover:bg-card/70 block rounded-xl border p-4 transition-colors">
      <span className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
        {label}
      </span>
      <div className="mt-2 flex items-center gap-2">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/20"
          style={{ background: nodeSwatch(node?.color) }}
        />
        <span className="truncate font-semibold">
          {node?.alias ?? (loading ? "Loading…" : "Unknown node")}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 font-mono text-xs break-all">
        {pubkey}
      </p>
      {/* Only claim the node is missing once the lookup has actually finished. */}
      {!loading && node === undefined && (
        <p className="text-muted-foreground/70 mt-1 text-xs">
          Not found in the public graph
        </p>
      )}
    </Link>
  );
}

function DecodedInvoiceView({
  query,
  invoiceType,
}: {
  query: string;
  invoiceType: InvoiceType;
}) {
  const decoded = useSWR<DecodedInvoice>(["decode", query], () =>
    decodeInvoice(invoiceType, query),
  );

  const pubkeys = decoded.data
    ? [decoded.data.signer, ...decoded.data.routingNodes].filter(
        (pubkey): pubkey is string => Boolean(pubkey),
      )
    : [];

  const nodes = useSWR<Record<string, NodeInfo>>(
    decoded.data ? ["decode-nodes", ...pubkeys] : null,
    async () => {
      const results = await Promise.allSettled(
        pubkeys.map(async (pubkey) => {
          const node = await fetcher<NodeInfo>(
            `${API_URL}/v2/lightning/${CURRENCY}/node/${pubkey}`,
          );
          return [pubkey, node] as const;
        }),
      );
      const map: Record<string, NodeInfo> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          map[result.value[0]] = result.value[1];
        }
      });
      return map;
    },
  );

  if (decoded.error) {
    return <Error error={decoded.error} />;
  }
  if (decoded.isLoading || decoded.data === undefined) {
    return <LoadingSpinnerFullscreen />;
  }

  const data = decoded.data;
  const nodeMap = nodes.data ?? {};
  const nodesLoading = nodes.isLoading;

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-2xl flex-col px-4 pt-12 pb-16">
        <div className="flex flex-col items-center text-center">
          <span className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
            Decoded
          </span>
          <h1 className="mt-2">{data.invoiceType}</h1>
          {data.invoiceAmountSat !== undefined && (
            <p className="mt-2 font-mono text-lg">
              {satoshisToSatcomma(data.invoiceAmountSat)} BTC
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-6">
          <FieldList fields={data.fields} />

          {data.signer && (
            <NodeRef
              label={SIGNER_LABEL[data.invoiceType]}
              pubkey={data.signer}
              node={nodeMap[data.signer]}
              loading={nodesLoading}
            />
          )}

          {data.routingNodes.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {ROUTING_LABEL[data.invoiceType]}
              </h2>
              {data.routingNodes.map((pubkey) => (
                <NodeRef
                  key={pubkey}
                  label="Routing node"
                  pubkey={pubkey}
                  node={nodeMap[pubkey]}
                  loading={nodesLoading}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// -- Router ----------------------------------------------------------------

export default function Search() {
  const { query } = useParams();
  const invoiceType = isInvoice(query!);

  return invoiceType !== undefined ? (
    <DecodedInvoiceView query={query!} invoiceType={invoiceType} />
  ) : (
    <AliasSearchView query={query!} />
  );
}
