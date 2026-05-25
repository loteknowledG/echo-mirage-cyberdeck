"use client";

import type { RefObject } from "react";
import { useCustomTabBrowserController } from "@/lib/use-custom-tab-browser-controller";

type Props = {
  operatorBrowserRef: RefObject<HTMLWebViewElement | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateCustomTab: (tabId: string, updater: (tab: any) => any) => void;
};

/** Leaf sync — keeps webview URL in sync without re-rendering the cyberdeck page shell. */
export function CyberdeckCustomTabBrowserSync({ operatorBrowserRef, updateCustomTab }: Props) {
  useCustomTabBrowserController({ operatorBrowserRef, updateCustomTab });
  return null;
}
