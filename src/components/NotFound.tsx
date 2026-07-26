import { SearchX } from "lucide-react";
import { Link } from "react-router";

import Header from "./Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 pt-24 text-center">
        <span className="text-muted-foreground bg-secondary grid size-14 place-items-center rounded-2xl">
          <SearchX className="size-7" />
        </span>
        <h1 className="mt-5">Not found</h1>
        <p className="text-muted-foreground mt-3">
          That page doesn't exist on the network.
        </p>
        <Link
          to="/"
          className="text-node-accent mt-6 text-sm font-medium hover:underline">
          Back to search
        </Link>
      </main>
    </>
  );
}
