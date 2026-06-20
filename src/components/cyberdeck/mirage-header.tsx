import { MirageLogoTwinkle } from "@/components/cyberdeck/mirage-logo-twinkle";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";
import { cn } from "@/lib/utils";

type MirageHeaderProps = {
  /** 0 = fully shown, 1 = fully collapsed (mobile split drag). */
  collapse?: number;
};

export function MirageHeader({ collapse = 0 }: MirageHeaderProps) {
  const clamped = Math.min(1, Math.max(0, collapse));
  const visible = 1 - clamped;

  return (
    <header
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      aria-hidden={clamped >= 0.98}
      className={cn(
        "relative flex w-full min-w-0 max-w-full shrink-0 items-start overflow-hidden border-b border-gray-800 bg-black px-4 transition-[max-height,opacity,padding,border-color] duration-200 ease-out",
        clamped >= 0.98 && "pointer-events-none border-transparent py-0",
      )}
      style={{
        maxHeight: `${visible * 96}px`,
        opacity: visible,
        paddingTop: `${visible * 8}px`,
        paddingBottom: `${visible * 8}px`,
      }}
    >
      <MirageLogoTwinkle className="min-w-0 max-w-full flex-1 overflow-hidden" />
    </header>
  );
}
