import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link, useParams } from "react-router";
import useSWR from "swr";

import { CURRENCY } from "../lib/env";
import { API_URL } from "../lib/env";
import { trimPubkey } from "../lib/utils";
import Error from "./Error";
import Header from "./Header";
import { LoadingSpinnerFullscreen } from "./LoadingSpinnter";
import type { NodeInfo } from "./Node";

function SearchResult({ nodeInfo }: { nodeInfo: NodeInfo }) {
  return (
    <div className="mt-4">
      <Link to={`/node/${nodeInfo.id}`}>
        <Card className="cursor-pointer shadow-none hover:shadow-sm shadow-yellow-500/50 transition duration-300">
          <CardHeader>
            <CardTitle>{nodeInfo.alias}</CardTitle>
            <CardDescription>{trimPubkey(nodeInfo.id)}</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}

export default function Search() {
  const { query } = useParams();
  const nodeInfo = useSWR<NodeInfo[]>(
    `${API_URL}/v2/lightning/${CURRENCY}/search?${new URLSearchParams({
      alias: query!,
    })}`,
  );

  if (nodeInfo.error) return <Error error={nodeInfo.error} />;
  if (nodeInfo.isLoading) {
    return <LoadingSpinnerFullscreen />;
  }

  return (
    <>
      <Header />
      <div className="flex flex-col items-center justify-center">
        <h1>Search result</h1>
        <p>
          {nodeInfo.data!.length} results found for "{query}"
        </p>
        <div className="w-full max-w-xl">
          {nodeInfo.data!.map((node) => (
            <SearchResult key={node.id} nodeInfo={node} />
          ))}
        </div>
      </div>
    </>
  );
}
