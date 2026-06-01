'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KitShowroom, type ShowroomFontWheelPreviewRender } from 'realmorphism';
import 'realmorphism/styles/kit.css';

import { FigletFontPreviewPanel } from '@/components/cyberdeck/figlet-font-preview-panel';
import { FigletFontPreviewSlide } from '@/components/cyberdeck/figlet-font-preview-slide';
import { DEFAULT_FIGLET_FONT } from '@/lib/figlet-fonts';
import { prefetchGlyphCatalogs } from '@/lib/glyph-catalog-queries';
import { useFigletFontCatalog } from '@/lib/use-figlet-font-catalog';
import { useOnelineArtCatalog } from '@/lib/use-oneline-art-catalog';

const installCommands = [
  {
    label: 'Theme',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism.json',
  },
  {
    label: 'Base controls',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism-base.json',
  },
  {
    label: 'Rolling pickers',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism-rolling-pickers.json',
  },
  {
    label: 'Kit showroom',
    command: 'npx shadcn@latest add http://localhost:3050/registry/realmorphism-kit.json',
  },
  {
    label: 'Package (Echo monorepo)',
    command: 'pnpm add realmorphism@file:../realmorphism',
  },
];

type RegistryShowroomProps = {
  /** Fills the Mirage pane instead of the full viewport. */
  variant?: 'page' | 'embedded';
};

export function RegistryShowroom({ variant = 'page' }: RegistryShowroomProps) {
  const queryClient = useQueryClient();
  const { catalog } = useOnelineArtCatalog();
  const { pickerFonts } = useFigletFontCatalog();

  React.useEffect(() => {
    void prefetchGlyphCatalogs(queryClient);
  }, [queryClient]);

  const textCatalog = React.useMemo(
    () =>
      catalog.map((entry) => ({
        id: entry.id,
        title: entry.title,
        content: entry.content,
      })),
    [catalog],
  );

  const renderWheelPreview = React.useCallback<ShowroomFontWheelPreviewRender>(
    (font, active) => (
      <FigletFontPreviewSlide font={font} active={active} size="wheel" loadPreview={active} />
    ),
    [],
  );

  const renderDetailPreview = React.useCallback(
    (font: string) => <FigletFontPreviewPanel font={font} text="ECHO" />,
    [],
  );

  return (
    <KitShowroom
      variant={variant}
      badgeLabel="Echo Mirage Registry"
      installCommands={installCommands}
      textCatalog={textCatalog.length > 0 ? textCatalog : undefined}
      figlet={{
        fonts: pickerFonts.length > 0 ? pickerFonts : undefined,
        defaultFont: DEFAULT_FIGLET_FONT,
        previewText: 'ECHO',
        renderWheelPreview,
        renderDetailPreview,
      }}
    />
  );
}
