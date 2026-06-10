"use client";

import type { ComponentProps } from "react";
import { CyberdeckOperatorPaneBody } from "@/components/cyberdeck/operator-pane-body";

type OperatorPaneProps = ComponentProps<typeof CyberdeckOperatorPaneBody>;

/** Operator rail tab — Echo Mirage document plane. */
export default function OperatorPaneRouter(props: OperatorPaneProps) {
  return <CyberdeckOperatorPaneBody {...props} />;
}
