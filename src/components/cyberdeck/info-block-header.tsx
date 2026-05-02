'use client';

type CyberdeckInfoBlockHeaderProps = {
  title: string;
  subtitle: string;
  status: string;
  statusClassName?: string;
};

export function CyberdeckInfoBlockHeader({
  title,
  subtitle,
  status,
  statusClassName,
}: CyberdeckInfoBlockHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-mono text-[10px] tracking-[0.08em] text-green-200">{title}</div>
        <div className="mt-1 font-mono text-[9px] tracking-[0.04em] text-[#8a8a8a]">{subtitle}</div>
      </div>
      <div className={statusClassName ?? "font-mono text-[9px] tracking-[0.08em] text-[#8a8a8a]"}>
        {status}
      </div>
    </div>
  );
}
