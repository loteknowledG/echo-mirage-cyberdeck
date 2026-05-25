"use client";

type PanelLoaderProps = {
  label?: string;
};

/** Lightweight placeholder while a deferred cyberdeck subsystem chunk loads. */
export function PanelLoader({ label = "SUBSYSTEM" }: PanelLoaderProps) {
  return (
    <div
      className="flex min-h-[8rem] flex-1 flex-col items-center justify-center gap-2 bg-black p-6 font-mono text-[10px] tracking-[0.12em] text-[#6a6a6a]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-px w-16 bg-emerald-500/35" />
      <span>{label} // LOADING</span>
      <div className="h-px w-16 bg-emerald-500/35" />
    </div>
  );
}
