import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isChannelId, isPubkey, isToBeResolved } from "@/lib/utils";
import { Search as SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

// Route a raw query to the page that can handle it. Shared by the landing hero
// and the header so search works from anywhere.
const routeFor = (query: string): string => {
  if (isPubkey(query)) return `/node/${query}`;
  if (isChannelId(query)) return `/channel/${query}`;
  if (isToBeResolved(query)) return `/resolver/${encodeURIComponent(query)}`;
  return `/search/${query}`;
};

const isMac =
  typeof navigator !== "undefined" &&
  /mac/i.test(navigator.platform || navigator.userAgent || "");

function Shortcut({ className }: { className?: string }) {
  return (
    <kbd
      aria-hidden
      className={`border-border/70 bg-background/60 text-muted-foreground pointer-events-none hidden items-center gap-0.5 rounded border px-1.5 py-0.5 font-mono text-[0.7rem] sm:flex ${className ?? ""}`}>
      {isMac ? "⌘" : "Ctrl"} K
    </kbd>
  );
}

export function SearchBox({
  variant = "hero",
  autoFocus,
}: {
  variant?: "hero" | "compact";
  autoFocus?: boolean;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses and selects the search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const execute = () => {
    const query = search.trim();
    if (query === "") return;
    navigate(routeFor(query));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") execute();
  };

  if (variant === "compact") {
    return (
      <div className="relative w-full">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          ref={inputRef}
          aria-label="Search"
          value={search}
          placeholder="Search the network"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          className="bg-secondary/50 h-10 pr-16 pl-9 font-mono text-sm"
        />
        <Shortcut className="absolute top-1/2 right-2.5 -translate-y-1/2" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={search}
          placeholder="Node key, channel ID, invoice, or ⚡ address"
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-13 rounded-xl pr-20 pl-12 font-mono text-base shadow-lg shadow-black/20"
        />
        <Shortcut className="absolute top-1/2 right-4 -translate-y-1/2" />
      </div>
      <Button
        onClick={execute}
        className="h-13 rounded-xl px-8 text-base font-medium">
        Search
      </Button>
    </div>
  );
}
