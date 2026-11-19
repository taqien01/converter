import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { extOf, targetByExt } from "./formats";

export type Settings = {
  bitrate: number; // kbps, lossy audio
  height: number; // 0 = keep original, video only
  quality: number; // 0.1–1, jpg/webp
};

export class Cancelled extends Error {
  constructor() {
    super("Cancelled");
  }
}

/** Browsers cap a wasm heap near 2 GB; input + output must both fit. */
export const MAX_BYTES = 1.5 * 1024 ** 3;

/**
 * Where the ffmpeg core comes from. By default it is bundled into dist/.
 * Hosts with a per-file size cap (Cloudflare: 25 MiB; the wasm is ~32 MB) build with
 * VITE_FFMPEG_CORE_CDN set, and the core is fetched from that URL instead.
 */
async function coreUrls(): Promise<{ coreURL: string; wasmURL: string }> {
  const cdn = import.meta.env.VITE_FFMPEG_CORE_CDN;
  if (cdn) {
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${cdn}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${cdn}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    return { coreURL, wasmURL };
  }
  const [core, wasm] = await Promise.all([import("@ffmpeg/core?url"), import("@ffmpeg/core/wasm?url")]);
  return { coreURL: core.default, wasmURL: wasm.default };
}

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let onProgress: ((p: number) => void) | null = null;

export function loadEngine(): Promise<FFmpeg> {
  if (ffmpeg) return Promise.resolve(ffmpeg);
  if (loading) return loading;
  loading = (async () => {
    const f = new FFmpeg();
    f.on("progress", ({ progress }) => {
      if (onProgress && Number.isFinite(progress)) onProgress(Math.min(1, Math.max(0, progress)));
    });
    await f.load(await coreUrls());
    ffmpeg = f;
    loading = null;
    return f;
  })();
  loading.catch(() => (loading = null));
  return loading;
}

export function isEngineReady() {
  return ffmpeg !== null;
}

/** Kills the running job. The engine reloads on the next conversion. */
export function cancelEngine() {
  ffmpeg?.terminate();
  ffmpeg = null;
  onProgress = null;
}

function scale(height: number) {
  // -2 keeps the width even, which H.264 requires.
  return height ? [`scale=-2:'min(${height},ih)'`] : [];
}

function ffmpegArgs(target: string, s: Settings): string[] {
  const br = `${s.bitrate}k`;
  const vf = (filters: string[]) => (filters.length ? ["-vf", filters.join(",")] : []);
  switch (target) {
    case "mp3": return ["-vn", "-c:a", "libmp3lame", "-b:a", br];
    case "m4a": return ["-vn", "-c:a", "aac", "-b:a", br];
    case "wav": return ["-vn", "-c:a", "pcm_s16le"];
    case "flac": return ["-vn", "-c:a", "flac"];
    case "ogg": return ["-vn", "-c:a", "libvorbis", "-b:a", br];
    case "opus": return ["-vn", "-c:a", "libopus", "-b:a", br];
    case "mp4":
    case "mov":
      return [
        ...vf([...scale(s.height), "format=yuv420p"]),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-b:a", "160k",
        ...(target === "mp4" ? ["-movflags", "+faststart"] : []),
      ];
    case "webm":
      return [...vf(scale(s.height)), "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-crf", "10", "-b:v", "2M", "-c:a", "libvorbis", "-b:a", "160k"];
    case "mkv":
      return s.height
        ? [...vf(scale(s.height)), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "copy"]
        : ["-c", "copy"];
    case "avi":
      return [...vf(scale(s.height)), "-c:v", "mpeg4", "-q:v", "4", "-c:a", "libmp3lame", "-b:a", "192k"];
    case "gif": {
      const h = s.height ? Math.min(s.height, 480) : 480;
      return ["-vf", `fps=12,scale=-1:'min(${h},ih)':flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`, "-loop", "0"];
    }
    default:
      throw new Error(`No recipe for ${target}`);
  }
}

let counter = 0;

async function runFfmpeg(file: File, target: string, s: Settings, progress: (p: number) => void): Promise<Blob> {
  const f = await loadEngine();
  const id = ++counter;
  const input = `in${id}.${extOf(file.name) || "bin"}`;
  const output = `out${id}.${target}`;
  await f.writeFile(input, await fetchFile(file));
  onProgress = progress;
  const log: string[] = [];
  const keepLog = ({ message }: { message: string }) => {
    log.push(message);
    if (log.length > 40) log.shift();
  };
  f.on("log", keepLog);
  try {
    const code = await f.exec(["-hide_banner", "-i", input, ...ffmpegArgs(target, s), "-y", output]);
    if (code !== 0) throw new Error(explain(log, target));
    const data = await f.readFile(output);
    if (typeof data === "string" || data.byteLength === 0) throw new Error(explain(log, target));
    return new Blob([data.slice()], { type: targetByExt(target).mime });
  } catch (e) {
    if (ffmpeg !== f) throw new Cancelled();
    throw e;
  } finally {
    onProgress = null;
    if (ffmpeg === f) {
      f.off("log", keepLog);
      await f.deleteFile(input).catch(() => {});
      await f.deleteFile(output).catch(() => {});
    }
  }
}

function explain(log: string[], target: string): string {
  const text = log.join("\n");
  if (/does not contain any stream|Output file .* does not contain|matches no streams/i.test(text))
    return target === "gif" || targetByExt(target).kind === "video"
      ? "This file has no video track."
      : "This file has no audio track, so there is nothing to put in the audio file.";
  if (/Invalid data found|moov atom not found/i.test(text)) return "The file looks damaged or isn't a real media file.";
  if (/Could not find tag for codec|codec not currently supported in container/i.test(text))
    return `The streams in this file can't go into ${target.toUpperCase()} without re-encoding. Pick MP4 instead.`;
  const last = log.filter((l) => /error|invalid|failed/i.test(l)).pop();
  return last ? `Conversion failed: ${last.trim()}` : "Conversion failed.";
}

async function runCanvas(file: File, target: string, s: Settings): Promise<Blob> {
  const t = targetByExt(target);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("This browser can't read this image format.");
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  if (target === "jpg") {
    // JPG has no transparency; paint white instead of letting it go black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, t.mime, t.quality ? s.quality : undefined));
  if (!blob || blob.type !== t.mime) throw new Error(`This browser can't write ${t.label}.`);
  return blob;
}

export async function convert(file: File, target: string, s: Settings, progress: (p: number) => void): Promise<Blob> {
  if (targetByExt(target).kind === "image") {
    progress(0.5);
    const b = await runCanvas(file, target, s);
    progress(1);
    return b;
  }
  if (file.size > MAX_BYTES) throw new Error("Files over 1.5 GB are too large to convert in a browser tab.");
  return runFfmpeg(file, target, s, progress);
}
