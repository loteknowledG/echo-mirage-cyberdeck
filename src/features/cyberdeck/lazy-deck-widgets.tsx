"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, ComponentType } from "react";
import { PanelLoader } from "@/features/cyberdeck/panel-loader";

export const CardTablePane = dynamic(
  () => import("@/components/cyberdeck/card-table-pane").then((m) => ({ default: m.CardTablePane })),
  { ssr: false, loading: () => <PanelLoader label="CARD TABLE" /> },
);

export const IndicateOverlay = dynamic(
  () => import("@/lib/computer-use/IndicateOverlay"),
  { ssr: false, loading: () => null },
);

type StreamdownProps = ComponentProps<
  typeof import("@/features/cyberdeck/streamdown-markdown-preview").StreamdownMarkdownPreview
>;

export const CyberdeckMarkdownPreview = dynamic(
  () =>
    import("@/features/cyberdeck/streamdown-markdown-preview").then((m) => ({
      default: m.StreamdownMarkdownPreview,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="font-mono text-[10px] tracking-[0.08em] text-[#707070]">MARKDOWN // LOADING</div>
    ),
  },
) as ComponentType<StreamdownProps>;
