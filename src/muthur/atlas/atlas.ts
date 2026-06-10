import { getMemory, MemoryRecord } from "../memory/core";

export type EntityKind = "project" | "doc" | "concept";
export type RelationType =
  | "described_by"
  | "references_doc"
  | "depends_on_project"
  | "uses_tool"
  | "feeds_into"
  | "bootstraps"
  | "implements"
  | "references_project"
  | "references_concept"
  | "related_project"
  | "mentions_project"
  | "described_with"
  | "adjacent_to";

export const HARD_RELATION_TYPES: RelationType[] = [
  "described_by",
  "references_doc",
  "depends_on_project",
  "uses_tool",
  "feeds_into",
  "bootstraps",
  "implements",
];

export const SOFT_RELATION_TYPES: RelationType[] = [
  "references_project",
  "references_concept",
  "related_project",
  "mentions_project",
  "described_with",
  "adjacent_to",
];

export interface AtlasEntity {
  id: string;
  kind: EntityKind;
  name: string;
  summary: string;
  confidence: number;
  status: "active" | "archived" | "proposed";
  attributes: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface AtlasRelation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: RelationType;
  weight: number;
  confidence: number;
  provenance: Record<string, unknown>;
  created_at: number;
}

export interface AtlasSource {
  id: string;
  entity_id: string;
  path: string;
  locator_type: "file" | "url" | "memory" | "receipt";
  locator_value: string;
  is_primary: boolean;
  authority: "canonical" | "inferred" | "external";
  validity_state: "valid" | "stale" | "disputed" | "unknown";
  last_verified_at: number;
  created_at: number;
  updated_at: number;
}

export interface AtlasResolutionResult {
  entity: AtlasEntity | null;
  hardRelations: AtlasRelation[];
  softRelations: AtlasRelation[];
  sources: AtlasSource[];
  memoryHits: MemoryRecord[];
}

export class SemanticAtlas {
  private memory: ReturnType<typeof getMemory>;
  private _entities: Map<string, AtlasEntity>;
  private _relations: Map<string, AtlasRelation>;
  private _sources: Map<string, AtlasSource>;

  constructor() {
    this.memory = getMemory();
    this._entities = new Map();
    this._relations = new Map();
    this._sources = new Map();
    this._seedCoreConcepts();
  }

  private _seedCoreConcepts(): void {
    const coreConcepts: Array<{ id: string; name: string; summary: string }> = [
      { id: "concept:voice", name: "Voice", summary: "Speech synthesis and voice interaction" },
      { id: "concept:memory", name: "Memory", summary: "Persistent memory and recall systems" },
      {
        id: "concept:audio",
        name: "Audio",
        summary: "Deck SFX — Web Audio synthesis, keyboard/nav sounds, sonar, chime fallbacks.",
      },
      { id: "concept:identity", name: "Identity", summary: "Identity persistence and bootstrapping" },
    ];

    for (const concept of coreConcepts) {
      this._entities.set(concept.id, {
        id: concept.id,
        kind: "concept",
        name: concept.name,
        summary: concept.summary,
        confidence: 1.0,
        status: "active",
        attributes: {},
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    }
  }

  private _generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async resolveEntity(
    idOrName: string,
    options?: { includeRelations?: boolean; includeSources?: boolean; includeMemory?: boolean }
  ): Promise<AtlasResolutionResult> {
    const normalizedKey = idOrName.toLowerCase().trim();

    let entity = this._entities.get(idOrName);

    if (!entity) {
      for (const [id, e] of this._entities) {
        if (id.toLowerCase() === normalizedKey || e.name.toLowerCase() === normalizedKey) {
          entity = e;
          break;
        }
        const aliases = e.attributes?.aliases;
        if (Array.isArray(aliases)) {
          const aliasHit = aliases.some(
            (alias) => typeof alias === "string" && alias.toLowerCase() === normalizedKey
          );
          if (aliasHit) {
            entity = e;
            break;
          }
        }
      }
    }

    if (!entity) {
      const memoryHits = this.memory.query_similar(idOrName, 5);
      return {
        entity: null,
        hardRelations: [],
        softRelations: [],
        sources: [],
        memoryHits,
      };
    }

    const hardRelations: AtlasRelation[] = [];
    const softRelations: AtlasRelation[] = [];
    const sources: AtlasSource[] = [];

    if (options?.includeRelations !== false) {
      for (const rel of this._relations.values()) {
        if (rel.source_entity_id === entity.id || rel.target_entity_id === entity.id) {
          if (HARD_RELATION_TYPES.includes(rel.relation_type)) {
            hardRelations.push(rel);
          } else {
            softRelations.push(rel);
          }
        }
      }
    }

    if (options?.includeSources !== false) {
      for (const src of this._sources.values()) {
        if (src.entity_id === entity.id) {
          sources.push(src);
        }
      }
    }

    const memoryHits = options?.includeMemory !== false
      ? this.memory.query_similar(entity.name, 3)
      : [];

    return {
      entity,
      hardRelations,
      softRelations,
      sources,
      memoryHits,
    };
  }

  async resolveProjectContext(
    entityIdOrName: string,
    mode: "structural" | "exploratory" = "structural"
  ): Promise<{
    primary: AtlasEntity | null;
    context: AtlasEntity[];
    verified: boolean;
    memoryHits: MemoryRecord[];
  }> {
    const { entity, hardRelations, softRelations, memoryHits } = await this.resolveEntity(entityIdOrName);

    if (!entity) {
      return { primary: null, context: [], verified: false, memoryHits: [] };
    }

    const contextIds = new Set<string>();

    for (const rel of hardRelations) {
      contextIds.add(rel.source_entity_id);
      contextIds.add(rel.target_entity_id);
    }

    if (mode === "exploratory") {
      for (const rel of softRelations) {
        contextIds.add(rel.source_entity_id);
        contextIds.add(rel.target_entity_id);
      }
    }

    const context: AtlasEntity[] = [];
    for (const id of contextIds) {
      if (id === entity.id) continue;
      const e = this._entities.get(id);
      if (e) context.push(e);
    }

    const verified = mode === "structural" || softRelations.length === 0 || context.length > 0;

    return {
      primary: entity,
      context,
      verified,
      memoryHits,
    };
  }

  ensureEntity(
    id: string,
    kind: EntityKind,
    name: string,
    summary: string,
    options?: {
      confidence?: number;
      aliases?: string[];
      attributes?: Record<string, unknown>;
    }
  ): AtlasEntity {
    const existing = this._entities.get(id);
    if (existing) {
      return existing;
    }

    const entity: AtlasEntity = {
      id,
      kind,
      name,
      summary,
      confidence: options?.confidence ?? 0.85,
      status: "active",
      attributes: {
        aliases: options?.aliases ?? [],
        ...options?.attributes,
      },
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    this._entities.set(id, entity);

    this.memory.add(
      "atlas_entity",
      `${kind}: ${name} - ${summary}`,
      { atlas_id: id, kind, seeded: true, ...options?.attributes }
    );

    return entity;
  }

  async ensureRelation(
    sourceEntityId: string,
    targetEntityId: string,
    relationType: RelationType,
    weight: number = 0.5,
    provenance?: Record<string, unknown>
  ): Promise<AtlasRelation | null> {
    for (const rel of this._relations.values()) {
      if (
        rel.source_entity_id === sourceEntityId &&
        rel.target_entity_id === targetEntityId &&
        rel.relation_type === relationType
      ) {
        return rel;
      }
    }
    return this.addRelation(sourceEntityId, targetEntityId, relationType, weight, provenance);
  }

  getSourcesForEntity(entityId: string): AtlasSource[] {
    const sources: AtlasSource[] = [];
    for (const src of this._sources.values()) {
      if (src.entity_id === entityId) {
        sources.push(src);
      }
    }
    return sources;
  }

  async addEntity(
    kind: EntityKind,
    name: string,
    summary: string,
    attributes?: Record<string, unknown>
  ): Promise<AtlasEntity> {
    const id = this._generateId(kind);
    const entity: AtlasEntity = {
      id,
      kind,
      name,
      summary,
      confidence: 0.5,
      status: "active",
      attributes: attributes || {},
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    this._entities.set(id, entity);

    this.memory.add(
      "atlas_entity",
      `${kind}: ${name} - ${summary}`,
      { atlas_id: id, kind, ...attributes }
    );

    return entity;
  }

  async addRelation(
    sourceEntityId: string,
    targetEntityId: string,
    relationType: RelationType,
    weight: number = 0.5,
    provenance?: Record<string, unknown>
  ): Promise<AtlasRelation | null> {
    if (!this._entities.has(sourceEntityId) || !this._entities.has(targetEntityId)) {
      return null;
    }

    const id = this._generateId("rel");
    const relation: AtlasRelation = {
      id,
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      relation_type: relationType,
      weight,
      confidence: 0.5,
      provenance: provenance || {},
      created_at: Date.now(),
    };

    this._relations.set(id, relation);

    this.memory.add(
      "atlas_relation",
      `${relationType}: ${sourceEntityId} → ${targetEntityId}`,
      { atlas_id: id, weight, ...provenance }
    );

    return relation;
  }

  async addSource(
    entityId: string,
    path: string,
    locatorType: AtlasSource["locator_type"],
    locatorValue: string,
    options?: { isPrimary?: boolean; authority?: AtlasSource["authority"] }
  ): Promise<AtlasSource | null> {
    if (!this._entities.has(entityId)) {
      return null;
    }

    const id = this._generateId("src");
    const source: AtlasSource = {
      id,
      entity_id: entityId,
      path,
      locator_type: locatorType,
      locator_value: locatorValue,
      is_primary: options?.isPrimary ?? false,
      authority: options?.authority ?? "inferred",
      validity_state: "unknown",
      last_verified_at: Date.now(),
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    this._sources.set(id, source);
    return source;
  }

  getEntities(kind?: EntityKind): AtlasEntity[] {
    const all = Array.from(this._entities.values());
    if (kind) {
      return all.filter(e => e.kind === kind);
    }
    return all;
  }

  getRelationsForEntity(entityId: string): { hard: AtlasRelation[]; soft: AtlasRelation[] } {
    const hard: AtlasRelation[] = [];
    const soft: AtlasRelation[] = [];

    for (const rel of this._relations.values()) {
      if (rel.source_entity_id === entityId || rel.target_entity_id === entityId) {
        if (HARD_RELATION_TYPES.includes(rel.relation_type)) {
          hard.push(rel);
        } else {
          soft.push(rel);
        }
      }
    }

    return { hard, soft };
  }
}

let _atlas: SemanticAtlas | null = null;

export function getAtlas(): SemanticAtlas {
  if (!_atlas) {
    _atlas = new SemanticAtlas();
  }
  return _atlas;
}