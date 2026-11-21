import React from "react";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] font-medium tracking-wider text-dim uppercase">{label}</p>
      {children}
    </div>
  );
}
