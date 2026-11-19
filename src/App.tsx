import { useCallback, useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import {
  ACCEPT,
  BITRATES,
  HEIGHTS,
  defaultTarget,
  extOf,
  formatBytes,
  kindOf,
  outputName,
  targetByExt,
  targetsFor,
  type Kind,
} from "./formats";
import { Cancelled, cancelEngine, convert, isEngineReady, loadEngine, type Settings } from "./engine";

type Status = "waiting" | "running" | "done" | "error";

type Job = {
  id: number;
  file: File;
  kind: Kind;
  srcExt: string;
  target: string;
  status: Status;
  progress: number;
  result?: Blob;
  error?: string;
};

let nextId = 1;

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<Settings>({ bitrate: 192, height: 0, quality: 0.85 });
  const [running, setRunning] = useState(false);
  const [engine, setEngine] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const patch = (id: number, p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const addFiles = useCallback((list: FileList | File[]) => {
    const added: Job[] = [];
    const bad: string[] = [];
    for (const file of Array.from(list)) {
      const kind = kindOf(file);
      if (!kind) {
        bad.push(file.name);
        continue;
      }
      const srcExt = extOf(file.name);
      added.push({ id: nextId++, file, kind, srcExt, target: defaultTarget(kind, srcExt), status: "waiting", progress: 0 });
    }
    setRejected(bad);
    setJobs((js) => [...js, ...added]);
  }, []);

  // Paste files straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) addFiles(e.clipboardData.files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const needsEngine = jobs.some((j) => targetByExt(j.target).kind !== "image");

  // Fetch the 31 MB engine in the background as soon as a media file is queued.
  useEffect(() => {
    if (!needsEngine || engine !== "idle") return;
    setEngine("loading");
    loadEngine().then(
      () => setEngine("ready"),
      () => setEngine("failed"),
    );
  }, [needsEngine, engine]);

  async function runAll() {
    setRunning(true);
    stopRef.current = false;
    for (;;) {
      if (stopRef.current) break;
      const job = jobsRef.current.find((j) => j.status === "waiting");
      if (!job) break;
      patch(job.id, { status: "running", progress: 0, error: undefined });
      try {
        if (targetByExt(job.target).kind !== "image" && !isEngineReady()) setEngine("loading");
        const blob = await convert(job.file, job.target, settings, (p) => patch(job.id, { progress: p }));
        if (isEngineReady()) setEngine("ready");
        patch(job.id, { status: "done", progress: 1, result: blob });
      } catch (e) {
        if (e instanceof Cancelled) {
          patch(job.id, { status: "waiting", progress: 0 });
          setEngine("idle");
          break;
        }
        patch(job.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    setRunning(false);
  }

  function stop() {
    stopRef.current = true;
    cancelEngine();
  }

  function setTarget(id: number, target: string) {
    patch(id, { target, status: "waiting", progress: 0, result: undefined, error: undefined });
  }

  function setAll(target: string) {
    setJobs((js) =>
      js.map((j) =>
        j.status !== "running" && targetsFor(j.kind).some((t) => t.ext === target)
          ? { ...j, target, status: "waiting", progress: 0, result: undefined, error: undefined }
          : j,
      ),
    );
  }

  function changeSettings(p: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...p }));
    // Finished files no longer match the new settings; queue them again.
    setJobs((js) => js.map((j) => (j.status === "done" || j.status === "error" ? { ...j, status: "waiting", progress: 0, result: undefined, error: undefined } : j)));
  }

  function remove(id: number) {
    setJobs((js) => js.filter((j) => j.id !== id));
  }

  function downloadAll() {
    const done = jobs.filter((j) => j.result);
    if (done.length === 1) return download(done[0]!);
    Promise.all(done.map((j) => j.result!.arrayBuffer())).then((bufs) => {
      const files: Record<string, [Uint8Array, { level: 0 }]> = {};
      done.forEach((j, i) => {
        let name = outputName(j.file.name, j.target);
        for (let n = 2; files[name]; n++) name = outputName(j.file.name, j.target).replace(/(\.[^.]+)$/, ` (${n})$1`);
        files[name] = [new Uint8Array(bufs[i]!), { level: 0 }];
      });
      save(new Blob([zipSync(files).slice()], { type: "application/zip" }), "converted.zip");
    });
  }

  const waiting = jobs.filter((j) => j.status === "waiting").length;
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const kinds = new Set(jobs.map((j) => j.kind));
  const targetsInQueue = new Set(jobs.map((j) => targetByExt(j.target)));
  const showBitrate = [...targetsInQueue].some((t) => t.bitrate);
  const showHeight = [...targetsInQueue].some((t) => t.kind === "video");
  const showQuality = [...targetsInQueue].some((t) => t.quality);
  const setAllOptions = kinds.size
    ? [...new Map([...kinds].flatMap((k) => targetsFor(k)).map((t) => [t.ext, t])).values()]
    : [];

  return (
    <div
      className="min-h-dvh"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.relatedTarget === null) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="mx-auto max-w-5xl px-4 pb-24 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-rule py-4">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="wide text-lg font-black tracking-tight uppercase">Bench</span>
          </div>
          <EngineLamp state={engine} />
        </header>

        <section className="pt-10 pb-8 sm:pt-16">
          <h1 className="wide text-[clamp(2.6rem,9vw,6.5rem)] leading-[0.88] font-black tracking-[-0.03em] uppercase">
            MP4 in.
            <br />
            <span className="text-cobalt">MP3 out.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-dim sm:text-lg">
            And MOV, WAV, FLAC, WEBM, GIF, PNG, JPG, WEBP and more. Everything is converted on this computer —
            your files are never uploaded.
          </p>
        </section>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`group relative block w-full rounded-xl border-2 border-dashed px-6 text-left transition-colors ${
            jobs.length ? "py-6" : "py-14 sm:py-20"
          } ${dragging ? "border-cobalt bg-cobalt/10" : "border-rule bg-plate hover:border-cobalt"}`}
        >
          <span className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="wide block text-xl font-extrabold uppercase sm:text-2xl">
                {dragging ? "Drop to add" : jobs.length ? "Add more files" : "Drop files here"}
              </span>
              <span className="mt-1 block text-sm text-dim">Video, audio or images · several at once · or paste with ⌘V</span>
            </span>
            <span className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-panel group-hover:bg-cobalt">
              Choose files
            </span>
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {rejected.length > 0 && (
          <p role="alert" className="mt-3 text-sm text-fault">
            Skipped {rejected.join(", ")} — only video, audio and image files can be converted.
          </p>
        )}
        {engine === "failed" && (
          <p role="alert" className="mt-3 text-sm text-fault">
            The video and audio engine didn't load. Check your connection and reload the page. Image conversion still works.
          </p>
        )}

        {jobs.length > 0 && (
          <>
            <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-5 border-y border-rule py-5">
              <Field label="Convert all to">
                <select
                  className="h-9 rounded-md border border-rule bg-plate px-2 font-mono text-sm"
                  value=""
                  onChange={(e) => e.target.value && setAll(e.target.value)}
                  disabled={running}
                >
                  <option value="">Choose…</option>
                  {setAllOptions.map((t) => (
                    <option key={t.ext} value={t.ext}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              {showBitrate && (
                <Field label="Audio bitrate">
                  <Segmented
                    options={BITRATES.map((b) => ({ value: b, label: `${b}k` }))}
                    value={settings.bitrate}
                    onChange={(bitrate) => changeSettings({ bitrate })}
                    disabled={running}
                  />
                </Field>
              )}
              {showHeight && (
                <Field label="Video size">
                  <Segmented
                    options={HEIGHTS.map((h) => ({ value: h, label: h ? `${h}p` : "Original" }))}
                    value={settings.height}
                    onChange={(height) => changeSettings({ height })}
                    disabled={running}
                  />
                </Field>
              )}
              {showQuality && (
                <Field label={`Image quality · ${Math.round(settings.quality * 100)}`}>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={settings.quality}
                    disabled={running}
                    onChange={(e) => changeSettings({ quality: Number(e.target.value) })}
                    className="h-9 w-40 accent-cobalt"
                  />
                </Field>
              )}
            </div>

            <ul className="divide-y divide-rule">
              {jobs.map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  locked={running}
                  onTarget={(t) => setTarget(j.id, t)}
                  onRemove={() => remove(j.id)}
                  onRetry={() => patch(j.id, { status: "waiting", error: undefined, progress: 0 })}
                />
              ))}
            </ul>

            <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-rule bg-panel/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
              {running ? (
                <button type="button" onClick={stop} className="h-11 rounded-md border-2 border-ink px-5 font-semibold">
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runAll}
                  disabled={!waiting}
                  className="wide h-11 rounded-md bg-cobalt px-6 text-sm font-extrabold tracking-wide text-white uppercase disabled:opacity-40"
                >
                  Convert {waiting > 1 ? `${waiting} files` : waiting === 1 ? "file" : ""}
                </button>
              )}
              <button
                type="button"
                onClick={downloadAll}
                disabled={!doneCount}
                className="h-11 rounded-md border border-ink/30 px-4 font-semibold disabled:opacity-40"
              >
                {doneCount > 1 ? `Download all ${doneCount} (.zip)` : "Download"}
              </button>
              <button
                type="button"
                onClick={() => setJobs([])}
                disabled={running}
                className="ml-auto h-11 px-2 text-sm text-dim underline-offset-4 hover:underline disabled:opacity-40"
              >
                Clear list
              </button>
            </div>
          </>
        )}

        {jobs.length === 0 && <Routes />}
      </div>
    </div>
  );
}

function JobRow({
  job,
  locked,
  onTarget,
  onRemove,
  onRetry,
}: {
  job: Job;
  locked: boolean;
  onTarget: (t: string) => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const t = targetByExt(job.target);
  const options = targetsFor(job.kind);
  const groups: [string, typeof options][] =
    job.kind === "video"
      ? [
          ["Audio only", options.filter((o) => o.kind === "audio")],
          ["Video", options.filter((o) => o.kind === "video")],
        ]
      : [["Formats", options]];

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_15rem_12rem_auto]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate font-medium" title={job.file.name}>
          {job.file.name}
        </p>
        <p className="mt-0.5 font-mono text-xs text-dim uppercase">
          {job.srcExt || job.kind} · {formatBytes(job.file.size)}
          {job.result && <> → {formatBytes(job.result.size)}</>}
        </p>
      </div>

      <label className="col-span-2 flex items-center gap-2 font-mono text-sm sm:col-span-1">
        <span aria-hidden className="text-dim">
          →
        </span>
        <span className="sr-only">Convert {job.file.name} to</span>
        <select
          value={job.target}
          disabled={locked || job.status === "running"}
          onChange={(e) => onTarget(e.target.value)}
          title={t.note}
          className="h-9 w-full min-w-0 rounded-md border border-rule bg-plate px-2 font-semibold"
        >
          {groups.map(([label, opts]) => (
            <optgroup key={label} label={label}>
              {opts.map((o) => (
                <option key={o.ext} value={o.ext}>
                  {o.label} — {o.note}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="min-w-0">
        {job.status === "error" ? (
          <p className="text-sm text-fault">{job.error}</p>
        ) : (
          <Meter value={job.progress} status={job.status} />
        )}
      </div>

      <div className="flex justify-end gap-2">
        {job.status === "done" && job.result && (
          <button
            type="button"
            onClick={() => download(job)}
            className="h-9 rounded-md bg-ink px-3 text-sm font-semibold text-panel hover:bg-cobalt"
          >
            Download {t.label}
          </button>
        )}
        {job.status === "error" && !locked && (
          <button type="button" onClick={onRetry} className="h-9 rounded-md border border-rule px-3 text-sm font-semibold">
            Try again
          </button>
        )}
        {job.status !== "running" && (
          <button
            type="button"
            onClick={onRemove}
            disabled={locked}
            aria-label={`Remove ${job.file.name}`}
            className="grid size-9 place-items-center rounded-md text-dim hover:bg-plate hover:text-ink disabled:opacity-30"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

const SEGMENTS = 20;

/** The signature: an amber LED ladder that fills as ffmpeg works, then locks cobalt when the file is ready. */
function Meter({ value, status }: { value: number; status: Status }) {
  const lit = Math.round(value * SEGMENTS);
  const label = status === "done" ? "Ready" : status === "running" ? `${Math.round(value * 100)}%` : "Waiting";
  return (
    <div className="flex items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label="Progress">
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

function Segmented<T extends number>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex h-9 rounded-md border border-rule bg-plate p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 font-mono text-xs font-medium disabled:opacity-50 ${
            o.value === value ? "bg-ink text-panel" : "text-dim hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] font-medium tracking-wider text-dim uppercase">{label}</p>
      {children}
    </div>
  );
}

const ROUTES: [string, string][] = [
  ["MP4", "MP3"],
  ["MOV", "MP4"],
  ["MKV", "MP4"],
  ["Video", "GIF"],
  ["WAV", "MP3"],
  ["FLAC", "M4A"],
  ["PNG", "JPG"],
  ["JPG", "WEBP"],
];

function Routes() {
  return (
    <section className="mt-14">
      <h2 className="font-mono text-[11px] font-medium tracking-wider text-dim uppercase">Common conversions</h2>
      <ul className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
        {ROUTES.map(([from, to]) => (
          <li key={from + to} className="flex items-baseline gap-2 bg-plate px-4 py-3 font-mono text-sm">
            <span>{from}</span>
            <span className="text-dim">→</span>
            <span className="font-semibold text-cobalt">{to}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-dim">
        Video and audio run on ffmpeg inside the page; the first conversion downloads its 31 MB engine once.
      </p>
    </section>
  );
}

function EngineLamp({ state }: { state: "idle" | "loading" | "ready" | "failed" }) {
  const text = { idle: "Engine off", loading: "Loading engine…", ready: "Engine ready", failed: "Engine failed" }[state];
  const color = { idle: "bg-led-off", loading: "bg-amber animate-pulse", ready: "bg-cobalt", failed: "bg-fault" }[state];
  return (
    <span className="flex items-center gap-2 font-mono text-xs text-dim" aria-live="polite">
      <span className={`size-2 rounded-full ${color}`} />
      {text}
    </span>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 16 16" className="size-6" aria-hidden>
      <rect width="16" height="16" rx="3" className="fill-cobalt" />
      <rect x="3" y="9" width="2" height="4" className="fill-amber" />
      <rect x="7" y="6" width="2" height="7" className="fill-amber" />
      <rect x="11" y="3" width="2" height="10" className="fill-amber" />
    </svg>
  );
}

function download(job: Job) {
  if (job.result) save(job.result, outputName(job.file.name, job.target));
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
