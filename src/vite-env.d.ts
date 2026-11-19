/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of @ffmpeg/core's dist/esm folder. Unset = bundle the core locally. */
  readonly VITE_FFMPEG_CORE_CDN?: string;
}
