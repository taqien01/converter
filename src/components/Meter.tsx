const SEGMENTS = 20;

export type Status = "waiting" | "running" | "done" | "error";

/** The signature: an amber LED ladder that fills as engine works, then locks cobalt when ready. */
export function Meter({ value, status }: { value: number; status: Status }) {
  const lit = Math.round(value * SEGMENTS);
  const label = status === "done" ? "Ready" : status === "running" ? `${Math.round(value * 100)}%` : "Waiting";
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-label="Progress"
    >
      <div className="flex h-4 flex-1 gap-[3px]">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`led flex-1 rounded-[2px] ${
              status === "done" ? "bg-cobalt" : i < lit ? "led-on-run" : "bg-led-off"
            } ${status === "running" && i === lit ? "animate-pulse bg-amber/40" : ""}`}
          />
        ))}
      </div>
      <span className={`w-14 text-right font-mono text-xs ${status === "done" ? "text-cobalt" : "text-dim"}`}>{label}</span>
    </div>
  );
}
