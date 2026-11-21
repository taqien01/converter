import { useState } from "react";
import { RouterProvider, useRouter } from "./router";
import { Header, type EngineState } from "./components/Header";
import { HomeView } from "./views/HomeView";
import { VideoView } from "./views/VideoView";
import { ImageView } from "./views/ImageView";

function AppContent() {
  const { path } = useRouter();
  const [engine, setEngine] = useState<EngineState>("idle");

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-8 flex-1">
        <Header engineState={engine} />

        <main>
          {path === "/video" && <VideoView engine={engine} setEngine={setEngine} />}
          {path === "/image" && <ImageView />}
          {path !== "/video" && path !== "/image" && <HomeView />}
        </main>
      </div>

      <footer className="border-t border-rule/50 py-6 text-center font-mono text-xs text-dim">
        <p>Bench · Files never leave your device · Processed locally with WebAssembly &amp; Canvas</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
