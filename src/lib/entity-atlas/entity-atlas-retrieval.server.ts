// SERVER ONLY: entity graph retrieval from continuity docs. Do not import from client components.

import type { EntityAtlasQueryIntent } from "@/lib/entity-atlas/entity-atlas-query";
import {
  buildEntityAtlasGraph,
  findEntityById,
  formatRelationshipTree,
  neighborsForEntity,
  relatedEntityBundle,
  resolveSubjectEntity,
} from "@/lib/entity-atlas/entity-atlas-index";
import type { EntityAtlasEntity } from "@/lib/entity-atlas/entity-atlas-types";
import {
  buildMemoryAtlasIndex,
  findBestAdr,
  findBestVerification,
  findVerificationForWorkOrder,
} from "@/lib/memory-atlas/memory-atlas-index";

export type EntityAtlasRetrievalResult = {
  entity_type: EntityAtlasQueryIntent["kind"];
  response: string;
  result: Record<string, unknown>;
};

let cachedGraph: ReturnType<typeof buildEntityAtlasGraph> | null = null;
let cachedMemoryIndex: ReturnType<typeof buildMemoryAtlasIndex> | null = null;
let cachedRoot: string | null = null;

function getGraph(workspaceRoot: string) {
  if (cachedGraph && cachedMemoryIndex && cachedRoot === workspaceRoot) {
    return { graph: cachedGraph, memoryIndex: cachedMemoryIndex };
  }
  cachedMemoryIndex = buildMemoryAtlasIndex(workspaceRoot);
  cachedGraph = buildEntityAtlasGraph(workspaceRoot);
  cachedRoot = workspaceRoot;
  return { graph: cachedGraph, memoryIndex: cachedMemoryIndex };
}

function header(): string {
  return "[MUTHUR // ENTITY ATLAS // CONTINUITY GRAPH]";
}

function entityListLines(entities: EntityAtlasEntity[]): string {
  return entities.map((entry) => entry.id).join("\n");
}

function buildRelationshipResponse(
  subject: string,
  workspaceRoot: string,
): EntityAtlasRetrievalResult {
  const { graph, memoryIndex } = getGraph(workspaceRoot);
  const bundle = relatedEntityBundle(graph, memoryIndex, subject);

  if (!bundle) {
    return {
      entity_type: "relationship",
      response: `${header()}\n\nNo continuity graph matched "${subject}".`,
      result: { subject, matched: false },
    };
  }

  const neighbors = neighborsForEntity(graph, bundle.anchor.id);
  const tree = formatRelationshipTree(bundle.anchor, neighbors);

  return {
    entity_type: "relationship",
    response: `${header()}\n\n${tree}\n\n${entityListLines(bundle.related)}`,
    result: {
      anchor_id: bundle.anchor.id,
      anchor_type: bundle.anchor.type,
      related: bundle.related.map((entry) => ({
        id: entry.id,
        type: entry.type,
        label: entry.label,
      })),
    },
  };
}

function buildGovernsResponse(subject: string, workspaceRoot: string): EntityAtlasRetrievalResult {
  const { graph, memoryIndex } = getGraph(workspaceRoot);
  const adr = findBestAdr(memoryIndex, subject);

  if (!adr) {
    return {
      entity_type: "governs",
      response: `${header()}\n\nNo governing ADR matched "${subject}".`,
      result: { subject, matched: false },
    };
  }

  return {
    entity_type: "governs",
    response: `${header()}\n\n${adr.id}`,
    result: {
      id: adr.id,
      decision: adr.decision,
      work_order_id: adr.workOrderId ?? null,
      path: adr.relativePath,
    },
  };
}

function buildVerifiesResponse(subject: string, workspaceRoot: string): EntityAtlasRetrievalResult {
  const { graph, memoryIndex } = getGraph(workspaceRoot);
  const verification = findBestVerification(memoryIndex, subject);

  if (!verification) {
    const entity = resolveSubjectEntity(graph, subject, memoryIndex);
    if (entity?.type === "work_order") {
      const linked = findVerificationForWorkOrder(memoryIndex, entity.id);
      if (linked) {
        return {
          entity_type: "verifies",
          response: `${header()}\n\n${linked.id}`,
          result: {
            id: linked.id,
            work_order_id: linked.workOrderId,
            verdict: linked.verdict,
            path: linked.relativePath,
          },
        };
      }
    }

    return {
      entity_type: "verifies",
      response: `${header()}\n\nNo verification matched "${subject}".`,
      result: { subject, matched: false },
    };
  }

  return {
    entity_type: "verifies",
    response: `${header()}\n\n${verification.id}`,
    result: {
      id: verification.id,
      work_order_id: verification.workOrderId,
      verdict: verification.verdict,
      path: verification.relativePath,
    },
  };
}

function buildDependsOnResponse(subject: string, workspaceRoot: string): EntityAtlasRetrievalResult {
  const { graph, memoryIndex } = getGraph(workspaceRoot);
  const anchor = resolveSubjectEntity(graph, subject, memoryIndex);

  if (!anchor) {
    return {
      entity_type: "depends_on",
      response: `${header()}\n\nNo entity matched "${subject}" for dependency lookup.`,
      result: { subject, matched: false },
    };
  }

  const deps = neighborsForEntity(graph, anchor.id, ["depends_on"])
    .filter((entry) => entry.direction === "out")
    .map((entry) => entry.entity);

  if (deps.length === 0) {
    return {
      entity_type: "depends_on",
      response: `${header()}\n\nNo dependencies found for ${anchor.id}.`,
      result: { anchor_id: anchor.id, dependencies: [] },
    };
  }

  return {
    entity_type: "depends_on",
    response: `${header()}\n\n${entityListLines(deps)}`,
    result: {
      anchor_id: anchor.id,
      dependencies: deps.map((entry) => ({ id: entry.id, type: entry.type })),
    },
  };
}

function buildBelongsToResponse(subject: string, workspaceRoot: string): EntityAtlasRetrievalResult {
  const { graph, memoryIndex } = getGraph(workspaceRoot);
  const anchor = resolveSubjectEntity(graph, subject, memoryIndex);

  if (!anchor) {
    return {
      entity_type: "belongs_to",
      response: `${header()}\n\nNo entity matched "${subject}" for subsystem lookup.`,
      result: { subject, matched: false },
    };
  }

  const owners = neighborsForEntity(graph, anchor.id, ["belongs_to"])
    .filter((entry) => entry.direction === "out")
    .map((entry) => entry.entity);

  if (owners.length === 0) {
    return {
      entity_type: "belongs_to",
      response: `${header()}\n\n${anchor.id} has no mapped subsystem.`,
      result: { anchor_id: anchor.id, subsystem: null },
    };
  }

  const subsystem = owners[0];
  return {
    entity_type: "belongs_to",
    response: `${header()}\n\n${subsystem.id}`,
    result: {
      anchor_id: anchor.id,
      subsystem: subsystem.id,
    },
  };
}

export function buildEntityAtlasResponse(
  intent: EntityAtlasQueryIntent,
  workspaceRoot = process.cwd(),
): EntityAtlasRetrievalResult {
  switch (intent.kind) {
    case "relationship":
      return buildRelationshipResponse(intent.subject, workspaceRoot);
    case "governs":
      return buildGovernsResponse(intent.subject, workspaceRoot);
    case "verifies":
      return buildVerifiesResponse(intent.subject, workspaceRoot);
    case "depends_on":
      return buildDependsOnResponse(intent.subject, workspaceRoot);
    case "belongs_to":
      return buildBelongsToResponse(intent.subject, workspaceRoot);
    default:
      return {
        entity_type: "relationship",
        response: `${header()}\n\nUnhandled entity intent.`,
        result: {},
      };
  }
}

/** Test helper — clears in-process graph cache */
export function resetEntityAtlasCache(): void {
  cachedGraph = null;
  cachedMemoryIndex = null;
  cachedRoot = null;
}

export { parseEntityAtlasQuery } from "@/lib/entity-atlas/entity-atlas-query";
