import {
  buildMemoryAtlasIndex,
  findBestAdr,
  findBestVerification,
  findBestWorkOrder,
  findVerificationForWorkOrder,
  findAdrForWorkOrder,
  scoreTopicMatch,
  type MemoryAtlasIndex,
} from "@/lib/memory-atlas/memory-atlas-index";

import type {
  EntityAtlasEntity,
  EntityAtlasGraph,
  EntityAtlasRelationship,
} from "@/lib/entity-atlas/entity-atlas-types";

const SUBSYSTEM_BY_PREFIX: Record<string, string> = {
  FS: "Workspace",
  CONN: "Provider",
  MEM: "Memory",
  UI: "UI",
  ARCH: "Architecture",
};

const PROVIDER_BY_WORK_ORDER: Record<string, string> = {
  "L-CONN-001": "OpenRouter",
};

function subsystemForWorkOrderId(workOrderId: string): string {
  const match = workOrderId.toUpperCase().match(/^L-([A-Z]+)-/);
  const prefix = match?.[1] ?? "";
  return SUBSYSTEM_BY_PREFIX[prefix] ?? "Cadre";
}

function entityFromWorkOrder(entry: MemoryAtlasIndex["workOrders"][number]): EntityAtlasEntity {
  return {
    id: entry.id,
    type: "work_order",
    label: entry.summary,
    keywords: [...entry.keywords, entry.id.toLowerCase()],
  };
}

function entityFromVerification(entry: MemoryAtlasIndex["verifications"][number]): EntityAtlasEntity {
  return {
    id: entry.id,
    type: "verification",
    label: entry.summary,
    keywords: [...entry.keywords, entry.workOrderId.toLowerCase()],
  };
}

function entityFromAdr(entry: MemoryAtlasIndex["adrs"][number]): EntityAtlasEntity {
  return {
    id: entry.id,
    type: "adr",
    label: entry.summary || entry.decision,
    keywords: [...entry.keywords, ...(entry.workOrderId ? [entry.workOrderId.toLowerCase()] : [])],
  };
}

function staticSubsystemEntities(): EntityAtlasEntity[] {
  return [
    {
      id: "Workspace",
      type: "subsystem",
      label: "Workspace filesystem and picker",
      keywords: ["workspace", "folder", "filesystem", "picker", "mutation", "l-fs"],
    },
    {
      id: "Provider",
      type: "subsystem",
      label: "Provider authentication and uplink",
      keywords: ["provider", "connection", "credentials", "openrouter", "l-conn"],
    },
    {
      id: "Memory",
      type: "subsystem",
      label: "Memory atlas and continuity",
      keywords: ["memory", "atlas", "continuity", "foundation", "l-mem"],
    },
    {
      id: "UI",
      type: "subsystem",
      label: "Cyberdeck UI surfaces",
      keywords: ["ui", "operator", "pane", "l-ui"],
    },
    {
      id: "Cadre",
      type: "subsystem",
      label: "Cadre orchestration",
      keywords: ["cadre", "muthur", "orchestration"],
    },
  ];
}

function staticProviderEntities(): EntityAtlasEntity[] {
  return [
    {
      id: "OpenRouter",
      type: "provider",
      label: "OpenRouter model gateway",
      keywords: [
        "openrouter",
        "provider authentication",
        "credentials",
        "api key",
        "model availability",
        "connection",
      ],
    },
  ];
}

export function buildEntityAtlasGraph(workspaceRoot = process.cwd()): EntityAtlasGraph {
  const memoryIndex = buildMemoryAtlasIndex(workspaceRoot);
  const entities = new Map<string, EntityAtlasEntity>();
  const relationships: EntityAtlasRelationship[] = [];

  const addEntity = (entity: EntityAtlasEntity) => {
    if (!entities.has(entity.id)) entities.set(entity.id, entity);
  };

  for (const entry of staticSubsystemEntities()) addEntity(entry);
  for (const entry of staticProviderEntities()) addEntity(entry);

  for (const wo of memoryIndex.workOrders) {
    addEntity(entityFromWorkOrder(wo));
    const subsystem = subsystemForWorkOrderId(wo.id);
    relationships.push({ from: wo.id, to: subsystem, type: "belongs_to" });

    const provider = PROVIDER_BY_WORK_ORDER[wo.id];
    if (provider) {
      relationships.push({ from: wo.id, to: provider, type: "references" });
    }

    if (wo.adrId) {
      relationships.push({ from: wo.adrId, to: wo.id, type: "governs" });
    }
  }

  for (const verification of memoryIndex.verifications) {
    addEntity(entityFromVerification(verification));
    relationships.push({
      from: verification.id,
      to: verification.workOrderId,
      type: "verifies",
    });
  }

  for (const adr of memoryIndex.adrs) {
    addEntity(entityFromAdr(adr));
    if (adr.workOrderId) {
      relationships.push({ from: adr.id, to: adr.workOrderId, type: "governs" });
    }
  }

  for (const foundation of memoryIndex.foundations) {
    addEntity({
      id: foundation.id,
      type: "foundation",
      label: foundation.name,
      keywords: foundation.keywords,
    });
    relationships.push({ from: foundation.id, to: "Memory", type: "informs" });
  }

  const memAdr = memoryIndex.adrs.find((entry) => entry.id === "ADR-MEM-001");
  const mem005 = memoryIndex.workOrders.find((entry) => entry.id === "L-MEM-005");
  if (memAdr && mem005) {
    relationships.push({ from: "L-MEM-005", to: "ADR-MEM-001", type: "depends_on" });
  }

  return {
    entities: [...entities.values()].sort((a, b) => a.id.localeCompare(b.id)),
    relationships,
  };
}

export function findEntityById(graph: EntityAtlasGraph, id: string): EntityAtlasEntity | undefined {
  const normalized = id.trim();
  return graph.entities.find((entry) => entry.id.toUpperCase() === normalized.toUpperCase());
}

export function scoreEntityTopic(graph: EntityAtlasGraph, topic: string): EntityAtlasEntity | null {
  let best: EntityAtlasEntity | null = null;
  let bestScore = 0;
  for (const entity of graph.entities) {
    const score = scoreTopicMatch(topic, {
      id: entity.id,
      summary: entity.label,
      keywords: entity.keywords,
    });
    if (score > bestScore) {
      best = entity;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function resolveSubjectEntity(
  graph: EntityAtlasGraph,
  subject: string,
  memoryIndex: MemoryAtlasIndex,
): EntityAtlasEntity | null {
  const trimmed = subject.trim();
  if (!trimmed) return null;

  const byId = findEntityById(graph, trimmed);
  if (byId) return byId;

  const wo = findBestWorkOrder(memoryIndex, trimmed);
  if (wo) return findEntityById(graph, wo.id) ?? entityFromWorkOrder(wo);

  const verification = findBestVerification(memoryIndex, trimmed);
  if (verification) {
    return findEntityById(graph, verification.id) ?? entityFromVerification(verification);
  }

  const adr = findBestAdr(memoryIndex, trimmed);
  if (adr) return findEntityById(graph, adr.id) ?? entityFromAdr(adr);

  return scoreEntityTopic(graph, trimmed);
}

export function neighborsForEntity(
  graph: EntityAtlasGraph,
  entityId: string,
  types?: EntityAtlasRelationship["type"][],
): Array<{ entity: EntityAtlasEntity; relationship: EntityAtlasRelationship; direction: "out" | "in" }> {
  const normalized = entityId.toUpperCase();
  const matches = graph.relationships.filter((rel) => {
    if (types && !types.includes(rel.type)) return false;
    return rel.from.toUpperCase() === normalized || rel.to.toUpperCase() === normalized;
  });

  const results: Array<{
    entity: EntityAtlasEntity;
    relationship: EntityAtlasRelationship;
    direction: "out" | "in";
  }> = [];

  for (const rel of matches) {
    if (rel.from.toUpperCase() === normalized) {
      const entity = findEntityById(graph, rel.to);
      if (entity) results.push({ entity, relationship: rel, direction: "out" });
    } else {
      const entity = findEntityById(graph, rel.from);
      if (entity) results.push({ entity, relationship: rel, direction: "in" });
    }
  }

  return results;
}

export function relatedEntityBundle(
  graph: EntityAtlasGraph,
  memoryIndex: MemoryAtlasIndex,
  subject: string,
): { anchor: EntityAtlasEntity; related: EntityAtlasEntity[] } | null {
  const anchor = resolveSubjectEntity(graph, subject, memoryIndex);
  if (!anchor) return null;

  const relatedIds = new Set<string>();
  relatedIds.add(anchor.id);

  if (anchor.type === "work_order") {
    const verification = findVerificationForWorkOrder(memoryIndex, anchor.id);
    const adr = findAdrForWorkOrder(memoryIndex, anchor.id);
    if (verification) relatedIds.add(verification.id);
    if (adr) relatedIds.add(adr.id);
    const subsystem = subsystemForWorkOrderId(anchor.id);
    relatedIds.add(subsystem);
    const provider = PROVIDER_BY_WORK_ORDER[anchor.id];
    if (provider) relatedIds.add(provider);
  } else {
    for (const neighbor of neighborsForEntity(graph, anchor.id)) {
      relatedIds.add(neighbor.entity.id);
      if (neighbor.entity.type === "work_order") {
        const verification = findVerificationForWorkOrder(memoryIndex, neighbor.entity.id);
        const adr = findAdrForWorkOrder(memoryIndex, neighbor.entity.id);
        const subsystem = subsystemForWorkOrderId(neighbor.entity.id);
        relatedIds.add(subsystem);
        if (verification) relatedIds.add(verification.id);
        if (adr) relatedIds.add(adr.id);
        const provider = PROVIDER_BY_WORK_ORDER[neighbor.entity.id];
        if (provider) relatedIds.add(provider);
      }
    }
  }

  const related = [...relatedIds]
    .map((id) => findEntityById(graph, id))
    .filter((entry): entry is EntityAtlasEntity => Boolean(entry))
    .sort((a, b) => a.id.localeCompare(b.id));

  return { anchor, related };
}

export function formatRelationshipTree(
  anchor: EntityAtlasEntity,
  neighbors: ReturnType<typeof neighborsForEntity>,
): string {
  const lines = [anchor.id];
  const childLines: string[] = [];

  for (const neighbor of neighbors) {
    const { entity, relationship, direction } = neighbor;
    if (relationship.type === "verifies" && direction === "out") {
      childLines.push(`verified by ${entity.id}`);
    } else if (relationship.type === "governs" && direction === "in") {
      childLines.push(`governed by ${entity.id}`);
    } else if (relationship.type === "belongs_to" && direction === "out") {
      childLines.push(`belongs to ${entity.id} subsystem`);
    } else if (relationship.type === "references" && direction === "out") {
      childLines.push(`references ${entity.id}`);
    } else if (relationship.type === "depends_on" && direction === "out") {
      childLines.push(`depends on ${entity.id}`);
    } else {
      childLines.push(`${relationship.type} ${entity.id}`);
    }
  }

  childLines.forEach((line, index) => {
    const prefix = index === childLines.length - 1 ? " └─ " : " ├─ ";
    lines.push(`${prefix}${line}`);
  });

  return lines.join("\n");
}
