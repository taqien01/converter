# Bench — file converter

Converts video, audio and images entirely in the browser. Nothing is uploaded.

- **Video → audio:** MP3, M4A, WAV, FLAC, OGG, OPUS (bitrate 128–320k)
- **Video → video:** MP4, WEBM, MOV, MKV, AVI, GIF (optional 1080p/720p/480p downscale)
- **Audio → audio:** same audio formats
- **Image → image:** PNG, JPG, WEBP (quality slider)

Batch queue, per-file target, "convert all to", download one or all as a zip, drag-and-drop or paste.

## Local development

Requires [Bun](https://bun.sh).

```sh
bun install
bun run dev        # http://localhost:5173
```

| Script               | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `bun run dev`        | Vite dev server                                                           |
| `bun run build`      | Self-contained build in `dist/` (ffmpeg engine bundled, ~32 MB wasm)      |
| `bun run build:cf`   | Cloudflare build in `dist/` (ffmpeg engine loaded from jsDelivr)          |
| `bun run preview:cf` | `build:cf`, then serve it with `wrangler dev` on http://localhost:8787    |
| `bun run deploy`     | `build:cf`, then `wrangler deploy` to Cloudflare                          |
| `bun run typecheck`  | `tsc --noEmit`                                                            |

## Deploy to Cloudflare

The app is a static site, deployed as a **Worker with static assets** (no server code). Config is in
`wrangler.jsonc`; the Worker is named `bench-converter`.

### Why the Cloudflare build is different

Cloudflare rejects any single static asset over **25 MiB**, and `ffmpeg-core.wasm` is ~32 MB. So
`build:cf` runs `vite build --mode cloudflare`, which reads `.env.cloudflare`:

```
VITE_FFMPEG_CORE_CDN=https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm
```

With that set, the wasm is left out of `dist/` and the browser fetches the engine from jsDelivr the
first time a video or audio file is queued. Only the engine comes from the CDN — user files still
never leave the browser.

**When you upgrade `@ffmpeg/core`, update the version in `.env.cloudflare` to match.** A mismatch
between `@ffmpeg/ffmpeg` and the core breaks loading.

To self-host the engine instead (e.g. on R2 behind your own domain), upload `ffmpeg-core.js` and
`ffmpeg-core.wasm` from `node_modules/@ffmpeg/core/dist/esm/` and point `VITE_FFMPEG_CORE_CDN` at
that folder. It must send CORS headers allowing your site's origin.

### First deploy (from your machine)

```sh
bun install
bunx wrangler login          # opens the browser once
bun run preview:cf           # optional: check it at http://localhost:8787
bun run deploy
```

Wrangler prints the URL, e.g. `https://bench-converter.<your-subdomain>.workers.dev`.

To use your own domain, add it under **Workers & Pages → bench-converter → Settings → Domains &
Routes**, or add a `routes` entry to `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "convert.example.com", "custom_domain": true }]
```

### Deploy on every push (Workers Builds)

In the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**, pick the repo, then set:

| Setting        | Value                    |
| -------------- | ------------------------ |
| Build command  | `bun run build:cf`       |
| Deploy command | `bunx wrangler deploy`   |
| Root directory | `/` (or the app's folder) |

Cloudflare detects Bun from `bun.lock`. No environment variables or secrets are needed;
`.env.cloudflare` is committed and supplies the CDN URL.

### Deploy from GitHub Actions instead

Create an API token with the **Edit Cloudflare Workers** template, then add repo secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### Caching and headers

`public/_headers` is copied into `dist/` and applied by Cloudflare:

- `/assets/*` — fingerprinted by Vite, cached for a year (`immutable`).
- Everything else — `nosniff` and a strict referrer policy.

### Rolling back

```sh
bunx wrangler versions list
bunx wrangler rollback            # previous version
bunx wrangler rollback <VERSION_ID>
```

## How it works

- Video/audio use [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (single-thread core),
  loaded the first time a media file is queued. Recipes live in `src/engine.ts`.
- Images are re-encoded with `<canvas>` (fast, no engine needed).
- Formats and which source can become which target: `src/formats.ts`.

## Limits

- Files over 1.5 GB are refused (browser wasm memory cap).
- Single-thread wasm is several times slower than native ffmpeg; MP3 extraction is fast,
  re-encoding long video to WEBM is slow.
