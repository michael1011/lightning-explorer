import { AlertTriangle } from "lucide-react";
import { Link } from "react-router";

import Header from "./Header";

const errorToString = (error: unknown) => {
  if (error instanceof Error) {
    return (error as Error).message;
  }

  return String(error);
};

export default function Error({ error }: { error: unknown }) {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 pt-24 text-center">
        <span className="text-destructive bg-destructive/10 grid size-14 place-items-center rounded-2xl">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="mt-5">Error</h1>
        <p className="text-muted-foreground mt-3 font-mono text-sm break-all">
          {errorToString(error)}
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
