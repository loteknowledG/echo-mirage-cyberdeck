"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CyberdeckPaneHeader,
  CyberdeckPaneHeaderSubtitle,
  CyberdeckPaneHeaderTitle,
} from "@/components/cyberdeck/pane-header";
import { emitSignal } from "@/lib/cyberdeck/signal-router";
import { useDeckMode } from "@/lib/deck-mode";
import { cn } from "@/lib/utils";
import type { AtlasPaneEntity } from "@/muthur/atlas/atlas-api.server";

type MemoryAtlasEntityTileProps = {
  entity: AtlasPaneEntity;
  isSelected: boolean;
  onSelect: () => void;
};

function MemoryAtlasEntityTile({ entity, isSelected, onSelect }: MemoryAtlasEntityTileProps) {
  const deckMode = useDeckMode();

  const content = (
    <>
      <div>{entity.label.toUpperCase()}</div>
      <div className="memory-atlas-entity-id mt-1 text-[8px] text-[#818181]">
        ID :: {entity.id}
      </div>
    </>
  );

  return (
    <button
      type="button"
      className={cn(
        "memory-atlas-lift-stack",
        "memory-atlas-entity-tile",
        deckMode === "realmorphism" && "realmorphism-control",
        isSelected && "is-atlas-selected",
      )}
      aria-pressed={isSelected}
      onClick={onSelect}
    >
      <span className="memory-atlas-tile-ground" aria-hidden>
        <span className="memory-atlas-tile-ground-plate" />
      </span>
      <span
        className={cn(
          "memory-atlas-tile-face",
          deckMode === "ascii" && "depth-panel__face depth-panel__face--ascii",
        )}
      >
        {content}
      </span>
    </button>
  );
}

let lastSelectedEntityId = "";

type AtlasApiResponse = {
  ok: boolean;
  entities?: AtlasPaneEntity[];
  memoryCount?: number;
  error?: string;
};

export function CyberdeckMemoryAtlasPaneBody() {
  const [entities, setEntities] = useState<AtlasPaneEntity[]>([]);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function loadAtlas() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/muthur/atlas", { cache: "no-store" });
        const data = (await res.json()) as AtlasApiResponse;
        if (cancelled) {
          return;
        }
        if (!res.ok || !data.ok || !data.entities) {
          throw new Error(data.error ?? "Atlas fetch failed");
        }
        setEntities(data.entities);
        setMemoryCount(typeof data.memoryCount === "number" ? data.memoryCount : null);
        const fallbackId = data.entities[0]?.id ?? "";
        const nextId =
          data.entities.some((entity) => entity.id === lastSelectedEntityId)
            ? lastSelectedEntityId
            : fallbackId;
        setSelectedEntityId(nextId);
        lastSelectedEntityId = nextId;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Atlas unavailable");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAtlas();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEntity = useMemo(
    () => entities.find((entity) => entity.id === selectedEntityId) ?? entities[0],
    [entities, selectedEntityId],
  );
  const labelById = useMemo(
    () => Object.fromEntries(entities.map((entity) => [entity.id, entity.label])),
    [entities],
  );

  const subtitle =
    memoryCount != null
      ? `MUTHUR RECALL // ${memoryCount} MEMORIES // LIVE ATLAS`
      : "MUTHUR RECALL // LIVE ATLAS";

  return (
    <div className="custom-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-black p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-[#141414] bg-black transition-colors">
        <CyberdeckPaneHeader
          left={
            <div className="flex flex-col">
              <CyberdeckPaneHeaderTitle style={{ textShadow: "0 0 6px rgba(138,138,138,0.2)" }}>
                MEMORY ATLAS
              </CyberdeckPaneHeaderTitle>
              <CyberdeckPaneHeaderSubtitle>{subtitle}</CyberdeckPaneHeaderSubtitle>
            </div>
          }
        />
        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 font-mono text-[10px]">
          {loading ? (
            <div className="text-[9px] text-[#8f8f8f]">LOADING ATLAS…</div>
          ) : error ? (
            <div className="text-[9px] text-amber-200/90">ATLAS OFFLINE // {error}</div>
          ) : entities.length === 0 ? (
            <div className="text-[9px] text-[#8f8f8f]">NO ENTITIES SEEDED.</div>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[0.95fr_1.05fr]">
              <div
                data-memory-atlas-entities
                className="custom-scrollbar min-h-0 overflow-y-auto rounded-sm border border-[#1c1c1c] bg-black/80 p-2"
              >
                {entities.map((entity) => {
                  const isSelected = selectedEntity?.id === entity.id;
                  return (
                    <MemoryAtlasEntityTile
                      key={entity.id}
                      entity={entity}
                      isSelected={isSelected}
                      onSelect={() => {
                        setSelectedEntityId(entity.id);
                        lastSelectedEntityId = entity.id;
                        emitSignal({
                          source: "atlas",
                          type: "entity_selected",
                          payload: { id: entity.id, label: entity.label },
                          severity: "info",
                        });
                      }}
                    />
                  );
                })}
              </div>
              {selectedEntity ? (
                <div className="rounded-sm border border-[#1c1c1c] bg-black/80 p-3 text-[#d5d5d5]">
                  <div className="text-[11px] text-emerald-200">{selectedEntity.label.toUpperCase()}</div>
                  <div className="mt-2 text-[9px] text-[#8f8f8f]">SUMMARY</div>
                  <div className="text-[9px] text-[#cfcfcf]">{selectedEntity.summary}</div>
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
                  <div className="mt-3 text-[9px] text-[#8f8f8f]">LOCATIONS</div>
                  <div className="space-y-1 text-[9px] text-[#cfcfcf]">
                    {selectedEntity.locations.length === 0 ? (
                      <div className="text-[#8f8f8f]">NO CANONICAL PATH — {selectedEntity.source}</div>
                    ) : (
                      selectedEntity.locations.map((location) => (
                        <div
                          key={`${selectedEntity.id}-${location.path}-${location.locator}`}
                          className="break-all font-mono"
                        >
                          <span className="text-[#9aa7ff]">{location.locatorType.toUpperCase()}</span>
                          {" :: "}
                          {location.path}
                          {location.isPrimary ? (
                            <span className="text-emerald-300/90"> // PRIMARY</span>
                          ) : null}
                          {location.authority !== "inferred" ? (
                            <span className="text-[#8f8f8f]"> [{location.authority}]</span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
