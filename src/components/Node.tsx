import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NavLink, useParams } from "react-router";
import useSWR from "swr";

import { API_URL, CURRENCY } from "../lib/env";
import { satoshisToSatcomma } from "../lib/utils";
import Error from "./Error";
import Header from "./Header";
import LoadingSpinnter, { LoadingSpinnerFullscreen } from "./LoadingSpinnter";

export type NodeInfo = {
  alias: string;
  color: string;
  id: string;
};

type Channel = {
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

function Channels({ channels }: { channels: Channel[] }) {
  return (
    <>
      <h2>Channels: {channels.length}</h2>
      <h2>
        Capacity:{" "}
        {satoshisToSatcomma(
          channels.reduce((acc, channel) => acc + channel.capacity, 0),
        )}
      </h2>

      <hr />

      <div className="m-8 w-full max-w-7xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Channel ID</TableHead>
              <TableHead className="w-[100px]">Node</TableHead>
              <TableHead className="w-[100px]">Alias</TableHead>
              <TableHead className="text-right">Capacity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => (
              <TableRow>
                <TableCell className="font-medium">
                  {channel.shortChannelId}
                </TableCell>
                <TableCell className="font-medium">
                  <NavLink to={`/node/${channel.source.id}`}>
                    {channel.source.id}
                  </NavLink>
                </TableCell>
                <TableCell className="font-medium">
                  {channel.source.alias}
                </TableCell>
                <TableCell className="text-right">
                  {satoshisToSatcomma(channel.capacity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

  return (
    <>
      <Header />
      <div className="flex flex-col items-center justify-center">
        <h1>Node: {nodeInfo.data!.alias}</h1>
        <h2>ID: {nodeInfo.data!.id}</h2>

        {channels.isLoading ? (
          <div className="flex justify-center items-center h-full mt-4">
            <LoadingSpinnter />
          </div>
        ) : (
          <Channels channels={channels.data!} />
        )}
      </div>
    </>
  );
}

export default Node;
