import { useCallback, useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import {
  IMAGE_ACCEPT,
  IMAGE_TARGETS,
  defaultTarget,
  extOf,
  formatBytes,
  kindOf,
  outputName,
  targetByExt,
  type Kind,
} from "../formats";
import { Cancelled, convert, type Settings } from "../engine";
import { Meter, type Status } from "../components/Meter";
import { Field } from "../components/Field";
import { useRouter, Link } from "../router";

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

let nextId = 1000;

export function ImageView() {
  const { navigate } = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<Settings>({ bitrate: 192, height: 0, quality: 0.85 });
  const [running, setRunning] = useState(false);
  const [rejected, setRejected] = useState<{ name: string; kind: Kind | null }[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  const patch = (id: number, p: Partial<Job>) =>
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const addFiles = useCallback((list: FileList | File[]) => {
    const added: Job[] = [];
    const bad: { name: string; kind: Kind | null }[] = [];

    for (const file of Array.from(list)) {
      const kind = kindOf(file);
      if (kind !== "image") {
        bad.push({ name: file.name, kind });
        continue;
      }
      const srcExt = extOf(file.name);
      added.push({
        id: nextId++,
        file,
        kind,
        srcExt,
        target: defaultTarget(kind, srcExt),
        status: "waiting",
        progress: 0,
      });
    }

    setRejected(bad);
    setJobs((js) => [...js, ...added]);
  }, []);

  // Paste image straight from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files.length) addFiles(e.clipboardData.files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function runAll() {
    setRunning(true);
    stopRef.current = false;
    for (;;) {
      if (stopRef.current) break;
      const job = jobsRef.current.find((j) => j.status === "waiting");
      if (!job) break;
      patch(job.id, { status: "running", progress: 0.1, error: undefined });
      try {
        const blob = await convert(job.file, job.target, settings, (p) => patch(job.id, { progress: p }));
        patch(job.id, { status: "done", progress: 1, result: blob });
      } catch (e) {
        if (e instanceof Cancelled) {
          patch(job.id, { status: "waiting", progress: 0 });
          break;
        }
        patch(job.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    setRunning(false);
  }

  function stop() {
    stopRef.current = true;
  }

  function setTarget(id: number, target: string) {
    patch(id, { target, status: "waiting", progress: 0, result: undefined, error: undefined });
  }

  function setAll(target: string) {
    setJobs((js) =>
      js.map((j) =>
        j.status !== "running"
          ? { ...j, target, status: "waiting", progress: 0, result: undefined, error: undefined }
          : j,
      ),
    );
  }

  function changeSettings(p: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...p }));
    setJobs((js) =>
      js.map((j) =>
        j.status === "done" || j.status === "error"
          ? { ...j, status: "waiting", progress: 0, result: undefined, error: undefined }
          : j,
      ),
    );
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
      save(new Blob([zipSync(files).slice()], { type: "application/zip" }), "converted-images.zip");
    });
  }

  const waiting = jobs.filter((j) => j.status === "waiting").length;
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const hasLossyTarget = jobs.some((j) => {
    const t = targetByExt(j.target, "image");
    return t.quality;
  });

  return (
    <div
      className="pt-6 sm:pt-10"
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
      {/* Switcher bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 font-mono text-xs text-dim">
        <div className="flex items-center gap-2">
          <span>Viewing:</span>
          <select
            value="/image"
            onChange={(e) => navigate(e.target.value)}
            className="h-7 rounded border border-rule bg-plate px-2 font-bold text-ink hover:border-cobalt cursor-pointer"
          >
            <option value="/image">🖼️ Image Converter (/image)</option>
            <option value="/video">🎥 Video Converter (/video)</option>
            <option value="/">🏠 Selection Menu (/)</option>
          </select>
        </div>
        <Link to="/video" className="text-cobalt hover:underline flex items-center gap-1">
          Switch to Video Converter →
        </Link>
      </div>

      <section className="pt-4 pb-8 sm:pt-6">
        <h1 className="wide text-[clamp(2.5rem,8.5vw,6rem)] leading-[0.88] font-black tracking-[-0.03em] uppercase">
          WebP in.
          <br />
          <span className="text-cobalt">JPG out.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-dim sm:text-lg">
          Convert WEBP, PNG, JPG, AVIF, GIF, BMP, ICO, TIFF, and SVG. Convert any image format to any format instantly with zero uploads.
        </p>
      </section>

      {/* Drop area */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative block w-full rounded-xl border-2 border-dashed px-6 text-left transition-colors ${
          jobs.length ? "py-6" : "py-12 sm:py-16"
        } ${dragging ? "border-cobalt bg-cobalt/10" : "border-rule bg-plate hover:border-cobalt"}`}
      >
        <span className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="wide block text-xl font-extrabold uppercase sm:text-2xl">
              {dragging ? "Drop images here" : jobs.length ? "Add more images" : "Drop image files here"}
            </span>
            <span className="mt-1 block text-sm text-dim">
              WEBP, PNG, JPG, AVIF, SVG, BMP, ICO, TIFF · batch conversion · or paste with ⌘V
            </span>
          </span>
          <span className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-panel group-hover:bg-cobalt transition-colors">
            Choose images
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Warnings & Notices */}
      {rejected.length > 0 && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-fault/30 bg-fault/10 p-3 text-sm text-fault">
          <span>
            Skipped {rejected.map((r) => r.name).join(", ")} — only image files can be converted here.
          </span>
          {rejected.some((r) => r.kind === "video" || r.kind === "audio") && (
            <button
              type="button"
              onClick={() => navigate("/video")}
              className="font-semibold underline underline-offset-2 hover:text-ink"
            >
              Go to Video Converter →
            </button>
          )}
        </div>
      )}

      {/* Jobs queue & controls */}
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
                <option value="">Choose format…</option>
                {IMAGE_TARGETS.map((t) => (
                  <option key={t.ext} value={t.ext}>
                    {t.label} — {t.note}
                  </option>
                ))}
              </select>
            </Field>

            {(hasLossyTarget || jobs.length > 0) && (
              <Field label={`Quality · ${Math.round(settings.quality * 100)}% (JPG / WEBP / AVIF)`}>
                <input
                  type="range"
                  min={0.4}
                  max={1}
                  step={0.05}
                  value={settings.quality}
                  disabled={running}
                  onChange={(e) => changeSettings({ quality: Number(e.target.value) })}
                  className="h-9 w-44 accent-cobalt cursor-pointer"
                />
              </Field>
            )}
          </div>

          <ul className="divide-y divide-rule">
            {jobs.map((j) => (
              <ImageJobRow
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
              <button
                type="button"
                onClick={stop}
                className="h-11 rounded-md border-2 border-ink px-5 font-semibold hover:bg-plate"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={runAll}
                disabled={!waiting}
                className="wide h-11 rounded-md bg-cobalt px-6 text-sm font-extrabold tracking-wide text-white uppercase disabled:opacity-40 hover:bg-cobalt/90 cursor-pointer"
              >
                Convert {waiting > 1 ? `${waiting} images` : waiting === 1 ? "image" : ""}
              </button>
            )}
            <button
              type="button"
              onClick={downloadAll}
              disabled={!doneCount}
              className="h-11 rounded-md border border-ink/30 px-4 font-semibold disabled:opacity-40 hover:bg-plate cursor-pointer"
            >
              {doneCount > 1 ? `Download all ${doneCount} (.zip)` : "Download"}
            </button>
            <button
              type="button"
              onClick={() => setJobs([])}
              disabled={running}
              className="ml-auto h-11 px-2 text-sm text-dim underline-offset-4 hover:underline disabled:opacity-40 cursor-pointer"
            >
              Clear list
            </button>
          </div>
        </>
      )}

      {jobs.length === 0 && <ImageRoutes />}
    </div>
  );
}

function ImageJobRow({
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
  const t = targetByExt(job.target, "image");

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4 sm:grid-cols-[minmax(0,1fr)_15rem_12rem_auto]">
      <div className="col-span-2 min-w-0 sm:col-span-1">
        <p className="truncate font-medium" title={job.file.name}>
          {job.file.name}
        </p>
        <p className="mt-0.5 font-mono text-xs text-dim uppercase">
          {job.srcExt || "IMAGE"} · {formatBytes(job.file.size)}
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
          {IMAGE_TARGETS.map((o) => (
            <option key={o.ext} value={o.ext}>
              {o.label} — {o.note}
            </option>
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
            className="h-9 rounded-md bg-ink px-3 text-sm font-semibold text-panel hover:bg-cobalt transition-colors"
          >
            Download {t.label}
          </button>
        )}
        {job.status === "error" && !locked && (
          <button
            type="button"
            onClick={onRetry}
            className="h-9 rounded-md border border-rule px-3 text-sm font-semibold hover:border-cobalt"
          >
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

const IMAGE_ROUTES: [string, string][] = [
  ["WEBP", "JPG"],
  ["PNG", "JPG"],
  ["JPG", "WEBP"],
  ["SVG", "PNG"],
  ["WEBP", "PNG"],
  ["Image", "ICO"],
  ["Image", "BMP"],
  ["Image", "AVIF"],
];

function ImageRoutes() {
  return (
    <section className="mt-14">
      <h2 className="font-mono text-[11px] font-medium tracking-wider text-dim uppercase">
        Common image conversions
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4">
        {IMAGE_ROUTES.map(([from, to]) => (
          <li key={from + to} className="flex items-baseline gap-2 bg-plate px-4 py-3 font-mono text-sm">
            <span>{from}</span>
            <span className="text-dim">→</span>
            <span className="font-semibold text-cobalt">{to}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-dim">
        Images are processed instantly in your browser tab using hardware acceleration and Canvas APIs without uploading anywhere.
      </p>
    </section>
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
