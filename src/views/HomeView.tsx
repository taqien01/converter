import { Link } from "../router";

export function HomeView() {
  return (
    <div className="py-10 sm:py-16">
      <section className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-rule/80 bg-plate px-3 py-1 font-mono text-xs text-dim mb-6">
          <span className="size-2 rounded-full bg-cobalt animate-pulse" />
          100% Private · In-Browser Engine · Zero Server Uploads
        </div>
        <h1 className="wide text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.9] font-black tracking-[-0.03em] uppercase">
          Local file <br />
          <span className="text-cobalt">Converter.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-dim sm:text-lg">
          Select what kind of files you want to convert today. All processing takes place locally on your computer using
          WebAssembly and hardware-accelerated Canvas.
        </p>
      </section>

      {/* Select Menu: Cards */}
      <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Video Card */}
        <Link
          to="/video"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-rule bg-plate p-7 transition-all duration-200 hover:border-cobalt hover:shadow-lg sm:p-8"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="grid size-14 place-items-center rounded-xl bg-cobalt/10 text-cobalt group-hover:bg-cobalt group-hover:text-white transition-colors">
                <VideoIcon className="size-7" />
              </div>
              <span className="font-mono text-xs font-semibold text-dim uppercase tracking-wider">
                FFmpeg WASM
              </span>
            </div>

            <div>
              <h2 className="wide text-2xl font-black uppercase tracking-tight text-ink sm:text-3xl">
                Video Converter
              </h2>
              <p className="mt-2 text-sm text-dim leading-relaxed sm:text-base">
                Extract audio from videos, convert video formats, compress size, or create animated GIFs.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {["MP4", "MOV", "MKV", "WEBM", "MP3", "WAV", "M4A", "FLAC", "GIF"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-rule/60 bg-panel px-2 py-0.5 font-mono text-xs text-dim group-hover:border-cobalt/40"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-rule/60 pt-5 font-mono text-sm font-bold text-cobalt">
            <span>Open Video Converter</span>
            <span className="text-lg transition-transform group-hover:translate-x-1.5">→</span>
          </div>
        </Link>

        {/* Image Card */}
        <Link
          to="/image"
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-rule bg-plate p-7 transition-all duration-200 hover:border-cobalt hover:shadow-lg sm:p-8"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="grid size-14 place-items-center rounded-xl bg-amber/15 text-amber group-hover:bg-amber group-hover:text-ink transition-colors">
                <ImageIcon className="size-7" />
              </div>
              <span className="font-mono text-xs font-semibold text-cobalt uppercase tracking-wider">
                Instant · No Download
              </span>
            </div>

            <div>
              <h2 className="wide text-2xl font-black uppercase tracking-tight text-ink sm:text-3xl">
                Image Converter
              </h2>
              <p className="mt-2 text-sm text-dim leading-relaxed sm:text-base">
                Convert WebP to JPG, PNG to WebP, or any image format to any format. Fast, high-res with transparency support.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {["WEBP", "JPG", "PNG", "AVIF", "BMP", "ICO", "TIFF", "SVG", "GIF"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-rule/60 bg-panel px-2 py-0.5 font-mono text-xs text-dim group-hover:border-cobalt/40"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-rule/60 pt-5 font-mono text-sm font-bold text-cobalt">
            <span>Open Image Converter</span>
            <span className="text-lg transition-transform group-hover:translate-x-1.5">→</span>
          </div>
        </Link>
      </section>

      {/* Feature Highlights */}
      <section className="mt-16 border-t border-rule pt-10">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-dim">
          Why Bench converter is different
        </h3>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-rule/80 bg-plate p-5">
            <div className="font-mono text-base font-bold text-ink">🔒 100% Private</div>
            <p className="mt-2 text-sm text-dim">
              Your confidential audio, videos, and images never touch a server. All computations happen in your browser memory.
            </p>
          </div>
          <div className="rounded-xl border border-rule/80 bg-plate p-5">
            <div className="font-mono text-base font-bold text-ink">⚡ Zero Waiting & Limits</div>
            <p className="mt-2 text-sm text-dim">
              No daily conversion caps, no queues, no registration. Image conversions happen in milliseconds.
            </p>
          </div>
          <div className="rounded-xl border border-rule/80 bg-plate p-5">
            <div className="font-mono text-base font-bold text-ink">📦 Batch Queue & ZIP</div>
            <p className="mt-2 text-sm text-dim">
              Add multiple files at once, customize bitrates or qualities, and download individually or packaged in a ZIP archive.
            </p>
          </div>
        </div>
      </section>

      {/* Popular Shortcuts */}
      <section className="mt-12">
        <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-dim">
          Popular conversions
        </h3>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            to="/image"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>WEBP → JPG</span>
            <span className="text-cobalt">Image</span>
          </Link>
          <Link
            to="/image"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>PNG → WEBP</span>
            <span className="text-cobalt">Image</span>
          </Link>
          <Link
            to="/image"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>SVG → PNG</span>
            <span className="text-cobalt">Image</span>
          </Link>
          <Link
            to="/image"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>Image → ICO</span>
            <span className="text-cobalt">Image</span>
          </Link>
          <Link
            to="/video"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>MP4 → MP3</span>
            <span className="text-cobalt">Video</span>
          </Link>
          <Link
            to="/video"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>MOV → MP4</span>
            <span className="text-cobalt">Video</span>
          </Link>
          <Link
            to="/video"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>Video → GIF</span>
            <span className="text-cobalt">Video</span>
          </Link>
          <Link
            to="/video"
            className="flex items-center justify-between rounded-lg border border-rule bg-plate px-4 py-2.5 font-mono text-xs hover:border-cobalt transition-colors"
          >
            <span>MKV → MP4</span>
            <span className="text-cobalt">Video</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
