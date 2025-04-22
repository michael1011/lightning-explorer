import { Loader2 } from "lucide-react";

export default function LoadingSpinnter() {
  return <Loader2 className="w-10 h-10 animate-spin" />;
}

export function LoadingSpinnerFullscreen() {
  return (
    <div className="flex justify-center items-center h-screen">
      <Loader2 className="w-10 h-10 animate-spin" />
    </div>
  );
}
