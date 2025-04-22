import { AlertTriangle } from "lucide-react";

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
      <div className="flex flex-col items-center justify-center m-10">
        <div className="flex items-center justify-center gap-2">
          <AlertTriangle className="w-10 h-10" />
          <h1>Error</h1>
        </div>
        <p>{errorToString(error)}</p>
      </div>
    </>
  );
}
