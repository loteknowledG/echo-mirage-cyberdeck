'use client';

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  OPERATOR_DOC_TYPE_ENTRIES,
  operatorDocTypeIndex,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";

type OperatorDocTypePickerProps = {
  value: OperatorDocumentPickerKind;
  onChange: (kind: OperatorDocumentPickerKind) => void;
};

/** Compact Y-axis rolling picker for operator document types. */
export function OperatorDocTypePicker({ value, onChange }: OperatorDocTypePickerProps) {
  const items = useMemo(
    () =>
      OPERATOR_DOC_TYPE_ENTRIES.map((entry) => {
        const Icon = entry.Icon;
        return {
          value: entry.value,
          label: entry.label,
          slide: <Icon className="h-3.5 w-3.5" aria-hidden />,
        };
      }),
    [],
  );

  const resolvedValue =
    OPERATOR_DOC_TYPE_ENTRIES[operatorDocTypeIndex(value)]?.value ?? value;

  return (
    <CyberdeckRollingPicker
      items={items}
      value={resolvedValue}
      onChange={(next) => onChange(next as OperatorDocumentPickerKind)}
      ariaLabel="Document type"
      viewportClassName="h-7 w-7"
    />
  );
}
