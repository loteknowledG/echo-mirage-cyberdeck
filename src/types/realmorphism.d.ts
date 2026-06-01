declare module "realmorphism/styles/kit.css";

declare module "realmorphism" {
  import type { ReactNode } from "react";

  export type DemoTextCatalogEntry = {
    id: string;
    title: string;
    content: string;
  };

  export type KitInstallCommand = {
    label: string;
    command: string;
  };

  export type ShowroomFontWheelPreviewRender = (font: string, active: boolean) => ReactNode;

  export type KitShowroomFigletSectionProps = {
    fonts?: readonly string[];
    defaultFont?: string;
    previewText?: string;
    renderWheelPreview?: ShowroomFontWheelPreviewRender;
    renderDetailPreview?: (font: string, previewText: string) => ReactNode;
  };

  export type KitShowroomProps = {
    variant?: "page" | "embedded";
    badgeLabel?: string;
    installCommands?: KitInstallCommand[];
    showFormControls?: boolean;
    textCatalog?: DemoTextCatalogEntry[];
    figlet?: KitShowroomFigletSectionProps;
  };

  export function KitShowroom(props: KitShowroomProps): React.JSX.Element;

  export type RollingPickerItem = {
    value: string;
    label: string;
    slide?: ReactNode;
    renderSlide?: (active: boolean) => ReactNode;
    labelSlide?: ReactNode;
    renderLabelSlide?: (active: boolean) => ReactNode;
  };

  export type RollingPickerProps = {
    items: RollingPickerItem[];
    value: string;
    onChange: (value: string) => void;
    onUserSelect?: (value: string) => void;
    ariaLabel: string;
    viewportClassName?: string;
    showTextWhileScrolling?: boolean;
    alwaysShowLabel?: boolean;
    showSnapHint?: boolean;
    wheelExpandOnScroll?: boolean;
    wheelPinnedOpen?: boolean;
    wheelTransparent?: boolean;
    wheelNeighborCount?: number;
    slideHeightPx?: number;
    wheelScrollStep?: number;
    wheelMomentum?: boolean;
    wheelMomentumGain?: number;
    wheelMomentumFriction?: number;
    wheelMomentumDuration?: number;
    wheelSettledShowsSlide?: boolean;
    inlinePanelClassName?: string;
    wheelFullWidth?: boolean;
    loop?: boolean;
    rollerType?: string;
  };

  export function RollingPicker(props: RollingPickerProps): React.JSX.Element;

  export type RollingPickerRowMode = "compact" | "expand" | "showroom";

  export function rollingPickerLayoutForMode(
    mode: RollingPickerRowMode,
    overrides?: Partial<RollingPickerProps>,
  ): Partial<RollingPickerProps>;
}
