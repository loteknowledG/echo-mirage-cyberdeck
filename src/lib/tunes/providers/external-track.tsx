"use client";

export type TunesExternalTrackProps = {
  url: string;
  title: string;
};

export function TunesExternalTrack({ url, title }: TunesExternalTrackProps) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-[#2a2a2a] bg-[#0a0a0a] p-4">
      <p className="font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]">
        EXTERNAL TRACK — NO INLINE PLAYER
      </p>
      <p className="truncate font-mono text-[10px] text-[#c0c0c0]">{title}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit rounded-sm border border-[#444] px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-[#c0c0c0] hover:bg-[#141414]"
      >
        OPEN EXTERNALLY
      </a>
    </div>
  );
}
