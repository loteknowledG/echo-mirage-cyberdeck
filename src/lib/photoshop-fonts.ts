export const PHOTOSHOP_FONT_FAMILIES = [
  { id: "sans", label: "Sans", family: "ui-sans-serif, system-ui, sans-serif", canvasFamily: "Arial" },
  { id: "serif", label: "Serif", family: "ui-serif, Georgia, serif", canvasFamily: "Times New Roman" },
  { id: "mono", label: "Mono", family: "ui-monospace, Cascadia Mono, monospace", canvasFamily: "Courier New" },
  { id: "arial", label: "Arial", family: "Arial, Helvetica, sans-serif", canvasFamily: "Arial" },
  { id: "impact", label: "Impact", family: "Impact, Haettenschweiler, sans-serif", canvasFamily: "Impact" },
  { id: "courier", label: "Courier", family: '"Courier New", Courier, monospace', canvasFamily: "Courier New" },
  { id: "times", label: "Times", family: '"Times New Roman", Times, serif', canvasFamily: "Times New Roman" },
  { id: "verdana", label: "Verdana", family: "Verdana, Geneva, sans-serif", canvasFamily: "Verdana" },
  { id: "georgia", label: "Georgia", family: "Georgia, serif", canvasFamily: "Georgia" },
  { id: "comic", label: "Comic", family: '"Comic Sans MS", cursive', canvasFamily: "Comic Sans MS" },
] as const;

export type PhotoshopFontFamilyId = (typeof PHOTOSHOP_FONT_FAMILIES)[number]["id"];

export const DEFAULT_PHOTOSHOP_FONT_FAMILY_ID: PhotoshopFontFamilyId = "sans";

export function resolvePhotoshopFontFamily(id: string): string {
  return (
    PHOTOSHOP_FONT_FAMILIES.find((entry) => entry.id === id)?.family ??
    PHOTOSHOP_FONT_FAMILIES[0].family
  );
}

export function resolvePhotoshopCanvasFont(id: string): string {
  return (
    PHOTOSHOP_FONT_FAMILIES.find((entry) => entry.id === id)?.canvasFamily ??
    PHOTOSHOP_FONT_FAMILIES[0].canvasFamily
  );
}

export function normalizePhotoshopFontFamilyId(id: string): PhotoshopFontFamilyId {
  return PHOTOSHOP_FONT_FAMILIES.some((entry) => entry.id === id)
    ? (id as PhotoshopFontFamilyId)
    : DEFAULT_PHOTOSHOP_FONT_FAMILY_ID;
}
