"use client";

export type TunesBandcampEmbedProps = {
  embedUrl?: string;
  pageUrl: string;
  title: string;
};

export function TunesBandcampEmbed({ embedUrl, pageUrl, title }: TunesBandcampEmbedProps) {
  if (embedUrl) {
    return (
      <div className="relative w-full overflow-hidden rounded-sm border border-[#2a2a2a] bg-black">
        <iframe
          title={title}
          src={embedUrl}
          className="h-[120px] w-full border-0"
          allow="autoplay"
        />
        <p className="border-t border-[#1c1c1c] px-2 py-1 font-mono text-[8px] tracking-[0.08em] text-[#6a6a6a]">
          BANDCAMP // AUTO-NEXT NOT RELIABLE — USE SKIP
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] p-4">
      <p className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
        BANDCAMP EMBED UNAVAILABLE — PASTE EMBED IFRAME OR OPEN EXTERNALLY
      </p>
      <a
        href={pageUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit rounded-sm border border-emerald-500/30 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-emerald-300 hover:bg-emerald-500/10"
      >
        OPEN ON BANDCAMP
      </a>
    </div>
  );
}
