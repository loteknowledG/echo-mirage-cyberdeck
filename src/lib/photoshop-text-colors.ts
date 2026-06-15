export const PHOTOSHOP_TEXT_COLORS = [
  { id: "#ffffff", label: "White" },
  { id: "#000000", label: "Black" },
  { id: "#dddddd", label: "Light gray" },
  { id: "#333333", label: "Dark gray" },
  { id: "#ffff00", label: "Yellow" },
  { id: "#00ffff", label: "Cyan" },
  { id: "#ff00ff", label: "Magenta" },
  { id: "#ff0000", label: "Red" },
  { id: "#00ff00", label: "Green" },
] as const;

export type PhotoshopTextColorId = (typeof PHOTOSHOP_TEXT_COLORS)[number]["id"];

export const DEFAULT_PHOTOSHOP_TEXT_COLOR: PhotoshopTextColorId = "#ffffff";

export function normalizePhotoshopTextColor(value: string): PhotoshopTextColorId {
  const normalized = value.trim().toLowerCase();
  const match = PHOTOSHOP_TEXT_COLORS.find((entry) => entry.id.toLowerCase() === normalized);
  return match?.id ?? DEFAULT_PHOTOSHOP_TEXT_COLOR;
}
