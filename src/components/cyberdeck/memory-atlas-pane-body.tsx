"use client";

import { useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { CyberdeckControl } from "@/components/cyberdeck/cyberdeck-control-button";
import { ATLAS_ENTITIES } from "@/lib/mock/atlas";
import { emitSignal } from "@/lib/cyberdeck/signal-router";

let lastSelectedEntityId = ATLAS_ENTITIES[0]?.id ?? "";

export function CyberdeckMemoryAtlasPaneBody() {
  const [selectedEntityId, setSelectedEntityId] = useState<string>(lastSelectedEntityId);
  const selectedEntity = useMemo(
    () => ATLAS_ENTITIES.find((entity) => entity.id === selectedEntityId) ?? ATLAS_ENTITIES[0],
    [selectedEntityId],
  );
  const labelById = useMemo(
    () => Object.fromEntries(ATLAS_ENTITIES.map((entity) => [entity.id, entity.label])),
    [],
  );

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MEMORY ATLAS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>MUTHUR RECALL // READ ONLY</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[0.95fr_1.05fr]">
            <div className="custom-scrollbar min-h-0 overflow-y-auto rounded-sm border border-[#1c1c1c] bg-black/80 p-2">
              {ATLAS_ENTITIES.map((entity) => (
                <CyberdeckControl
                  key={entity.id}
                  control={{
                    size: "tile",
                    signal: selectedEntity?.id === entity.id,
                  }}
                  onClick={() => {
                    setSelectedEntityId(entity.id);
                    lastSelectedEntityId = entity.id;
                    emitSignal({
                      source: "atlas",
                      type: "entity_selected",
                      payload: { id: entity.id, label: entity.label },
                      severity: "info",
                    });
                  }}
                  aria-pressed={selectedEntity?.id === entity.id}
                >
                  <div>{entity.label.toUpperCase()}</div>
                  <div className="mt-1 text-[8px] text-[#818181]">ID :: {entity.id}</div>
                </CyberdeckControl>
              ))}
            </div>
            {selectedEntity ? (
              <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#d5d5d5]">
                <div className="text-[11px] text-emerald-200">{selectedEntity.label.toUpperCase()}</div>
                <div className="mt-2 text-[9px] text-[#8f8f8f]">ALIASES</div>
                <div className="text-[9px] text-[#cfcfcf]">
                  {selectedEntity.aliases.length > 0 ? selectedEntity.aliases.join(" // ") : "NONE"}
                </div>
                <div className="mt-3 text-[9px] text-[#8f8f8f]">RELATIONS</div>
                <div className="space-y-1 text-[9px] text-[#cfcfcf]">
                  {selectedEntity.relations.length === 0
                    ? "NO RELATIONS."
                    : selectedEntity.relations.map((relation) => (
                        <div key={`${selectedEntity.id}-${relation.targetId}-${relation.type}`}>
                          {relation.type.toUpperCase()} :: {labelById[relation.targetId] ?? relation.targetId}
                        </div>
                      ))}
                </div>
                <div className="mt-3 text-[9px] text-[#8f8f8f]">CONFIDENCE</div>
                <div className="mt-1 h-2 border border-[#2a2a2a] bg-black">
                  <div
                    className="h-full bg-emerald-400/70"
                    style={{ width: `${Math.round(selectedEntity.confidence * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-[9px] text-[#b8b8b8]">{Math.round(selectedEntity.confidence * 100)}%</div>
                <div className="mt-3 text-[9px] text-[#8f8f8f]">SOURCE</div>
                <div className="text-[9px] text-[#cfcfcf]">{selectedEntity.source}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
