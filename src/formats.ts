export type Kind = "video" | "audio" | "image";

export type Target = {
  ext: string;
  label: string;
  kind: Kind;
  mime: string;
  /** Lossy audio formats take a bitrate. */
  bitrate?: boolean;
  /** Image formats encoded by the browser take a quality value. */
  quality?: boolean;
  note: string;
};

export const TARGETS: Target[] = [
  { ext: "mp3", label: "MP3", kind: "audio", mime: "audio/mpeg", bitrate: true, note: "Plays everywhere" },
  { ext: "m4a", label: "M4A", kind: "audio", mime: "audio/mp4", bitrate: true, note: "AAC, Apple devices" },
  { ext: "wav", label: "WAV", kind: "audio", mime: "audio/wav", note: "Uncompressed, large" },
  { ext: "flac", label: "FLAC", kind: "audio", mime: "audio/flac", note: "Lossless, smaller than WAV" },
  { ext: "ogg", label: "OGG", kind: "audio", mime: "audio/ogg", bitrate: true, note: "Vorbis" },
  { ext: "opus", label: "OPUS", kind: "audio", mime: "audio/ogg", bitrate: true, note: "Best quality per KB" },

  { ext: "mp4", label: "MP4", kind: "video", mime: "video/mp4", note: "H.264, plays everywhere" },
  { ext: "webm", label: "WEBM", kind: "video", mime: "video/webm", note: "VP8, for the web — slow" },
  { ext: "mov", label: "MOV", kind: "video", mime: "video/quicktime", note: "H.264 in QuickTime" },
  { ext: "mkv", label: "MKV", kind: "video", mime: "video/x-matroska", note: "Repackaged, no re-encode" },
  { ext: "avi", label: "AVI", kind: "video", mime: "video/x-msvideo", note: "MPEG-4, older players" },
  { ext: "gif", label: "GIF", kind: "video", mime: "image/gif", note: "Animated, 12 fps, 480 px" },

  { ext: "png", label: "PNG", kind: "image", mime: "image/png", note: "Lossless, keeps transparency" },
  { ext: "jpg", label: "JPG", kind: "image", mime: "image/jpeg", quality: true, note: "Small, no transparency" },
  { ext: "webp", label: "WEBP", kind: "image", mime: "image/webp", quality: true, note: "Small, keeps transparency" },
];

const VIDEO_EXT = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "flv", "wmv", "3gp", "mpg", "mpeg", "ts", "mts"];
const AUDIO_EXT = ["mp3", "wav", "m4a", "aac", "flac", "ogg", "oga", "opus", "wma", "aiff", "aif", "amr"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif", "svg", "ico", "tif", "tiff"];

export const ACCEPT = [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT].map((e) => "." + e).join(",") + ",video/*,audio/*,image/*";

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function kindOf(file: File): Kind | null {
  const ext = extOf(file.name);
  if (VIDEO_EXT.includes(ext)) return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (IMAGE_EXT.includes(ext)) return "image";
  const t = file.type.split("/")[0];
  if (t === "video" || t === "audio" || t === "image") return t;
  return null;
}

/** Which targets a source kind can become. Video can drop its picture to become audio. */
export function targetsFor(kind: Kind): Target[] {
  if (kind === "video") return TARGETS.filter((t) => t.kind === "video" || t.kind === "audio");
  return TARGETS.filter((t) => t.kind === kind);
}

export function defaultTarget(kind: Kind, srcExt: string): string {
  if (kind === "video") return "mp3";
  if (kind === "audio") return srcExt === "mp3" ? "m4a" : "mp3";
  return srcExt === "png" ? "jpg" : "png";
}

export function targetByExt(ext: string): Target {
  const t = TARGETS.find((t) => t.ext === ext);
  if (!t) throw new Error(`Unknown format ${ext}`);
  return t;
}

export const BITRATES = [128, 192, 256, 320] as const;
export const HEIGHTS = [0, 1080, 720, 480] as const;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function outputName(name: string, ext: string): string {
  const i = name.lastIndexOf(".");
  return (i < 0 ? name : name.slice(0, i)) + "." + ext;
}
