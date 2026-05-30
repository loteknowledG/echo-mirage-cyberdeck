'use client';

import * as React from 'react';

import { OperatorDocTypePicker } from '@/components/cyberdeck/operator-doc-type-picker';
import {
  OPERATOR_DOC_TYPE_ENTRIES,
  type OperatorDocumentPickerKind,
} from '@/lib/operator-document-types';

export function RegistryRollingPicker() {
  const [docType, setDocType] = React.useState<OperatorDocumentPickerKind>('markdown');
  const activeLabel =
    OPERATOR_DOC_TYPE_ENTRIES.find((entry) => entry.value === docType)?.label ?? docType;

  return (
    <section className="rounded-[var(--realmorphism-radius)] border border-[#2a3530] bg-[#0e1011] p-5 shadow-[var(--realmorphism-shadow-rest)]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Rolling Picker</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#9eada7]">
            Compact toolbar variant of the same control: one visible row in the bar, neighbors on
            while you spin, icon when settled. Document types below are demo data only.
          </p>
        </div>
        <span className="font-mono text-xs text-[#7dffb4]">control · compact</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:items-center">
        <div className="flex flex-wrap items-center gap-1.5 rounded border border-[#2a3530] bg-[#060708] px-3 py-2">
          <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6f7a75]">
            Operator toolbar
          </span>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-[#2a3530]" aria-hidden />
          <OperatorDocTypePicker value={docType} onChange={setDocType} />
        </div>

        <div className="realmorphism-panel space-y-1 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6f7a75]">
            Selected
          </div>
          <div className="font-mono text-sm text-[#e8efeb]">{activeLabel}</div>
          <div className="font-mono text-xs text-[#7dffb4]">{docType}</div>
        </div>
      </div>
    </section>
  );
}
