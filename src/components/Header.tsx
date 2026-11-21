import { useRouter, Link } from "../router";

export type EngineState = "idle" | "loading" | "ready" | "failed";

export function Header({ engineState }: { engineState?: EngineState }) {
  const { path, navigate } = useRouter();

  // Normalize current path to select value
  const selectValue = path === "/video" ? "/video" : path === "/image" ? "/image" : "/";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2.5 group">
          <Logo />
          <span className="wide text-lg font-black tracking-tight uppercase group-hover:text-cobalt transition-colors">
            Bench
          </span>
        </Link>

        {/* Dropdown mode switcher */}
        <div className="flex items-center gap-2 border-l border-rule/60 pl-3">
          <label htmlFor="mode-switcher" className="sr-only">Switch converter tool</label>
          <div className="relative">
            <select
              id="mode-switcher"
              value={selectValue}
              onChange={(e) => navigate(e.target.value)}
              className="h-8 appearance-none rounded-md border border-rule bg-plate pr-7 pl-2.5 font-mono text-xs font-medium text-ink hover:border-cobalt focus:border-cobalt cursor-pointer transition-colors shadow-2xs"
            >
              <option value="/">🏠 Menu</option>
              <option value="/video">🎥 Video Converter</option>
              <option value="/image">🖼️ Image Converter</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-dim">
              <svg className="size-3 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {path === "/video" && engineState && <EngineLamp state={engineState} />}
        {path === "/image" && (
          <span className="flex items-center gap-2 font-mono text-xs text-dim">
            <span className="size-2 rounded-full bg-cobalt" />
            Instant client engine
          </span>
        )}
      </div>
    </header>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 16 16" className="size-6 shrink-0" aria-hidden>
      <rect width="16" height="16" rx="3" className="fill-cobalt" />
      <rect x="3" y="9" width="2" height="4" className="fill-amber" />
      <rect x="7" y="6" width="2" height="7" className="fill-amber" />
      <rect x="11" y="3" width="2" height="10" className="fill-amber" />
    </svg>
  );
}

export function EngineLamp({ state }: { state: EngineState }) {
  const text = {
    idle: "Engine off",
    loading: "Loading engine…",
    ready: "Engine ready",
    failed: "Engine failed",
  }[state];
  const color = {
    idle: "bg-led-off",
    loading: "bg-amber animate-pulse",
    ready: "bg-cobalt",
    failed: "bg-fault",
  }[state];
  return (
    <span className="flex items-center gap-2 font-mono text-xs text-dim" aria-live="polite">
      <span className={`size-2 rounded-full ${color}`} />
      {text}
    </span>
  );
}
