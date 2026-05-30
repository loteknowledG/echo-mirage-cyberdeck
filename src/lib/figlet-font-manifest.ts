import bundled from '../../public/glyph/figlet-fonts.json';

/** Bundled font names — available on first paint (no fetch flash). */
export const BUNDLED_FIGLET_FONTS: readonly string[] = (
  bundled as { fonts: string[] }
).fonts;
