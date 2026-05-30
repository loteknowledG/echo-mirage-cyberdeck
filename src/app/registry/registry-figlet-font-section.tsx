'use client';

import * as React from 'react';

import { FigletFontPicker } from '@/components/cyberdeck/figlet-font-picker';
import { FigletFontPreviewPanel } from '@/components/cyberdeck/figlet-font-preview-panel';
import { DEFAULT_FIGLET_FONT } from '@/lib/figlet-fonts';
import {
  resolveFigletPickerValue,
  useFigletFontCatalog,
} from '@/lib/use-figlet-font-catalog';

export function RegistryFigletFontSection() {
  const [font, setFont] = React.useState(DEFAULT_FIGLET_FONT);
  const { pickerFonts } = useFigletFontCatalog();
  const resolved = resolveFigletPickerValue(font, pickerFonts);
  const currentIndex = pickerFonts.findIndex(
    (name) => name.toLowerCase() === resolved.toLowerCase(),
  );

  return (
    <section className="rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-5 shadow-[var(--realmorphism-shadow-rest)]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Figlet Font Selector</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#9eada7]">
            Rolling picker from the glyph channel. Scroll or drag the wheel to browse fonts; the
            row above and below stay visible while you spin. The panel renders a live figlet preview
            of the settled font.
          </p>
        </div>
        <span className="font-mono text-xs text-[#7dffb4]">glyph / figlet</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col items-center gap-3">
          <div className="flex w-fit flex-col items-center gap-2 rounded border border-[#2a3530] bg-[#060708] px-3 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6f7a75]">
              Font wheel
            </span>
            <FigletFontPicker variant="showroom" value={font} onChange={setFont} />
          </div>

          <div className="realmorphism-panel w-full max-w-[10.5rem] space-y-1 p-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f7a75]">
              Selected
            </div>
            <div className="font-mono text-sm text-[#e8efeb]">{resolved}</div>
            {pickerFonts.length > 1 && currentIndex >= 0 ? (
              <div className="font-mono text-xs text-[#6f7a75]">
                {currentIndex + 1} / {pickerFonts.length}
              </div>
            ) : null}
          </div>
        </div>

        <FigletFontPreviewPanel font={resolved} text="ECHO" />
      </div>
    </section>
  );
}
