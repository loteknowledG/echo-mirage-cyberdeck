'use client';

import { useMemo } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  OPERATOR_DOC_TYPE_ENTRIES,
  operatorDocTypeIndex,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { operatorDocumentKindIcon, operatorIconSrc } from "@/lib/operator-file-icon";

type OperatorDocTypePickerProps = {
  value: OperatorDocumentPickerKind;
  onChange: (kind: OperatorDocumentPickerKind) => void;
};

/** Compact Y-axis rolling picker for operator document types. */
export function OperatorDocTypePicker({ value, onChange }: OperatorDocTypePickerProps) {
  const items = useMemo(
    () =>
      OPERATOR_DOC_TYPE_ENTRIES.map((entry) => {
        const icon = operatorDocumentKindIcon(entry.value);
        return {
          value: entry.value,
          label: entry.label,
          slide: (
            <img
              src={operatorIconSrc(icon)}
              alt=""
              aria-hidden="true"
              draggable={false}
              data-vscode-icon={icon}
              className="h-3.5 w-3.5 object-contain"
            />
          ),
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
      showTextWhileScrolling
      loop
    />
  );
}
