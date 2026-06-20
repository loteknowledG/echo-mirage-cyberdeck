import { EchoLogoTwinkle } from "@/components/cyberdeck/echo-logo-twinkle";
import { MORPHISM_ZONE_ASCIIMORPHISM } from "@/lib/cyberdeck/morphism-zones";

export function EchoHeader() {
  return (
    <header
      data-morphism={MORPHISM_ZONE_ASCIIMORPHISM}
      className="relative flex w-full shrink-0 flex-col overflow-visible border-b border-gray-800 bg-black px-6 py-2"
    >
      <div className="flex w-full items-end justify-end">
        <EchoLogoTwinkle />
      </div>
    </header>
  );
}
