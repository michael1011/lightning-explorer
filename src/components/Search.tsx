import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";
import { Link, useParams } from "react-router";
import useSWR from "swr";

import { CURRENCY } from "../lib/env";
import { API_URL } from "../lib/env";
import {
  DecodedInvoice,
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

function SearchResult({
  nodeInfo,
  channels,
}: {
  nodeInfo: NodeInfo;
  channels: Channel[] | undefined;
}) {
  return (
    <div className="mt-4">
      <Link to={`/node/${nodeInfo.id}`}>
        <Card className="cursor-pointer shadow-none hover:shadow-sm shadow-yellow-500/50 transition duration-300">
          <CardHeader>
            <CardTitle>{nodeInfo.alias}</CardTitle>
            <CardDescription>{trimLongString(nodeInfo.id)}</CardDescription>
            <CardDescription>
              {channels !== undefined ? (
                <>
                  <p>Channels: {channels.length}</p>
                  <p>
                    Capacity:{" "}
                    {satoshisToSatcomma(
                      channels.reduce(
                        (acc, channel) => acc + channel.capacity,
                        0,
                      ),
                    )}
                  </p>
                </>
              ) : (
                <p>Loading...</p>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}

function InvoiceInfo({ decoded }: { decoded: DecodedInvoice }) {
  return (
    <div className="flex flex-row justify-between gap-4 mt-1">
      <p>Invoice type: {decoded.invoiceType}</p>
      {decoded.invoiceAmountSat && (
        <p>Amount: {satoshisToSatcomma(decoded.invoiceAmountSat)}</p>
      )}
    </div>
  );
}

export default function Search() {
  const { query } = useParams();
  const [decodedInvoice, setDecodedInvoice] = useState<
    DecodedInvoice | undefined
  >(undefined);
  const nodeInfo = useSWR<NodeInfo[]>(
    `${API_URL}/v2/lightning/${CURRENCY}/search?${new URLSearchParams({
      alias: query!,
    })}`,
    async (url: string) => {
      const invoiceType = isInvoice(query!);
      if (invoiceType !== undefined) {
        const decoded = await decodeInvoice(invoiceType, query!);
        setDecodedInvoice(decoded);
        const nodes = await Promise.allSettled(
          decoded.pubkeys.map(async (pubkey) => {
            return await fetcher<NodeInfo>(
              `${API_URL}/v2/lightning/${CURRENCY}/node/${pubkey}`,
            );
          }),
        );
        if (nodes.every((node) => node.status === "rejected")) {
          throw nodes.map((node) => node.reason).join(", ");
        }

        return nodes
          .filter(
            (node): node is PromiseFulfilledResult<NodeInfo> =>
              node.status === "fulfilled",
          )
          .map((node) => node.value);
      }

      return await fetcher<NodeInfo[]>(url);
    },
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
    const channelsA = channelsData.data?.[a.id] || [];
    const channelsB = channelsData.data?.[b.id] || [];
    const capacityA = channelsA.reduce(
      (acc, channel) => acc + channel.capacity,
      0,
    );
    const capacityB = channelsB.reduce(
      (acc, channel) => acc + channel.capacity,
      0,
    );
    return capacityB - capacityA;
  });

  return (
    <>
      <Header />
      <div className="flex flex-col items-center justify-center">
        <h1>Search result</h1>
        <p>
          {nodeInfo.data!.length} results found for "{trimLongString(query!)}"
        </p>
        {decodedInvoice && <InvoiceInfo decoded={decodedInvoice} />}
        <div className="w-full max-w-xl">
          {sortedNodes.map((node) => (
            <SearchResult
              key={node.id}
              nodeInfo={node}
              channels={channelsData.data?.[node.id]}
            />
          ))}
        </div>
      </div>
    </>
  );
}
