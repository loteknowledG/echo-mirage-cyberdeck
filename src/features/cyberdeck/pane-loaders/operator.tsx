"use client";

import type { ComponentProps } from "react";
import { CyberdeckOperatorPaneBody } from "@/components/cyberdeck/operator-pane-body";
import PropertyManagementWorkspace from "@/extensions/property-management/workspace";
import { useDeckApp } from "@/lib/deck-app";

type OperatorPaneProps = ComponentProps<typeof CyberdeckOperatorPaneBody>;

/** Operator rail tab — Echo Mirage document plane or an activated deck app workspace. */
export default function OperatorPaneRouter(props: OperatorPaneProps) {
  const deckApp = useDeckApp();

  if (deckApp === "property-management") {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
        <PropertyManagementWorkspace className="h-full min-h-0" />
      </div>
    );
  }

  return <CyberdeckOperatorPaneBody {...props} />;
}
