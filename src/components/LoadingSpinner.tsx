import { Loader2 } from "lucide-react";

export default function LoadingSpinner() {
  return <Loader2 className="text-node-accent size-10 animate-spin" />;
}

export function LoadingSpinnerFullscreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="text-node-accent size-10 animate-spin" />
    </div>
  );
}
