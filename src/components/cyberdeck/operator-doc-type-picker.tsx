'use client';

import { useMemo, useState } from "react";
import { CyberdeckRollingPicker } from "@/components/cyberdeck/cyberdeck-rolling-picker";
import {
  OPERATOR_DOC_TYPE_ENTRIES,
  operatorDocTypeIndex,
  type OperatorDocumentPickerKind,
} from "@/lib/operator-document-types";
import { operatorDocumentKindIcon, operatorIconSrc } from "@/lib/operator-file-icon";

const LOOP_COPIES = 5;
const LOOP_MIDDLE_COPY = Math.floor(LOOP_COPIES / 2);

function toPickerValue(kind: OperatorDocumentPickerKind, copy = LOOP_MIDDLE_COPY): string {
  return `${kind}:${copy}`;
}

function fromPickerValue(value: string): OperatorDocumentPickerKind | null {
  const [kind] = value.split(":");
  return OPERATOR_DOC_TYPE_ENTRIES.some((entry) => entry.value === kind)
    ? (kind as OperatorDocumentPickerKind)
    : null;
}

type OperatorDocTypePickerProps = {
  value: OperatorDocumentPickerKind;
  onChange: (kind: OperatorDocumentPickerKind) => void;
};

/** Compact Y-axis rolling picker for operator document types. */
export function OperatorDocTypePicker({ value, onChange }: OperatorDocTypePickerProps) {
  const [pickerValue, setPickerValue] = useState<string>(() => toPickerValue(value));

  const items = useMemo(
    () =>
      Array.from({ length: LOOP_COPIES }, (_, copyIndex) =>
        OPERATOR_DOC_TYPE_ENTRIES.map((entry) => {
          const icon = operatorDocumentKindIcon(entry.value);
          return {
            value: toPickerValue(entry.value, copyIndex),
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
      ).flat(),
    [],
  );

  const resolvedValue =
    OPERATOR_DOC_TYPE_ENTRIES[operatorDocTypeIndex(value)]?.value ?? value;

  return (
    <CyberdeckRollingPicker
      items={items}
      value={pickerValue}
      onChange={(next) => {
        const nextKind = fromPickerValue(next);
        if (!nextKind) return;
        setPickerValue(toPickerValue(nextKind));
        onChange(nextKind);
      }}
      ariaLabel="Document type"
      viewportClassName="h-7 w-7"
      showTextWhileScrolling
      loop
    />
  );
}
