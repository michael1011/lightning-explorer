import { SearchBox } from "@/components/SearchBox";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Zap } from "lucide-react";
import { Link, useLocation } from "react-router";

export default function Header() {
  const onLanding = useLocation().pathname === "/";

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2"
          aria-label="Lightning Explorer">
          <span className="text-node-accent grid size-7 place-items-center rounded-md bg-[color-mix(in_oklab,var(--node-accent)_18%,transparent)]">
            <Zap className="size-4" fill="currentColor" strokeWidth={0} />
          </span>
          <span className="hidden font-semibold tracking-tight sm:inline">
            Lightning Explorer
          </span>
        </Link>

        {!onLanding && (
          <div className="mx-auto w-full max-w-md">
            <SearchBox variant="compact" />
          </div>
        )}

        <div className="ml-auto shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
