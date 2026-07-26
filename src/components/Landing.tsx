import { SearchBox } from "@/components/SearchBox";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Zap } from "lucide-react";

const examples = [
  { label: "Node key", hint: "66-char pubkey" },
  { label: "Channel ID", hint: "812345x1x0" },
  { label: "Invoice or offer", hint: "lnbc… / lno…" },
  { label: "⚡ address", hint: "alice@site.com" },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Ambient voltage glow — the one bold moment, kept quiet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-10rem] left-1/2 size-[32rem] -translate-x-1/2 rounded-full opacity-25 blur-[120px]"
        style={{ background: "var(--node-accent)" }}
      />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-10 px-4 py-16">
        <div className="flex flex-col items-center gap-5 text-center">
          <span
            aria-hidden
            className="text-node-accent grid size-14 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--node-accent)_16%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--node-accent)_30%,transparent)]">
            <Zap className="size-7" fill="currentColor" strokeWidth={0} />
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Lightning Explorer
          </h1>
          <p className="text-muted-foreground max-w-md text-balance">
            Look up any node, channel, or payment string on the Bitcoin
            Lightning Network.
          </p>
        </div>

        <SearchBox variant="hero" autoFocus />

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          {examples.map((e) => (
            <div
              key={e.label}
              className="border-border/60 bg-card/40 flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-center">
              <span className="text-xs font-medium">{e.label}</span>
              <span className="text-muted-foreground font-mono text-[0.7rem]">
                {e.hint}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default Landing;
