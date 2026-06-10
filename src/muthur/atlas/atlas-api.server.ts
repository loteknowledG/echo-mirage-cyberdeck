import path from "path";
import type { AtlasEntity, AtlasRelation, AtlasSource, SemanticAtlas } from "./atlas";

export type AtlasPaneLocation = {
  path: string;
  locatorType: AtlasSource["locator_type"];
  locator: string;
  authority: AtlasSource["authority"];
  isPrimary: boolean;
};

export type AtlasPaneEntity = {
  id: string;
  label: string;
  aliases: string[];
  relations: Array<{ targetId: string; type: string }>;
  confidence: number;
  source: string;
  locations: AtlasPaneLocation[];
  summary: string;
  kind: string;
};

function formatAtlasLocationPath(filePath: string): string {
  const root = path.resolve(process.cwd()).replace(/\\/g, "/");
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  return normalized.split(/[/\\]/).pop() ?? normalized;
}

function mapEntityLocations(atlas: SemanticAtlas, entityId: string): AtlasPaneLocation[] {
  return atlas.getSourcesForEntity(entityId).map((src) => ({
    path: formatAtlasLocationPath(src.path),
    locatorType: src.locator_type,
    locator: src.locator_value,
    authority: src.authority,
    isPrimary: src.is_primary,
  }));
}

function entityAliases(entity: AtlasEntity): string[] {
  const raw = entity.attributes?.aliases;
  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }
  return [];
}

function primarySourceLabel(atlas: SemanticAtlas, entityId: string): string {
  const sources = atlas.getSourcesForEntity(entityId);
  const primary = sources.find((src) => src.is_primary) ?? sources[0];
  if (!primary) {
    return "atlas-seed";
  }
  return primary.locator_value || primary.path.split(/[/\\]/).pop() || "canonical";
}

function outgoingRelations(entityId: string, relations: AtlasRelation[]): Array<{ targetId: string; type: string }> {
  const seen = new Set<string>();
  const result: Array<{ targetId: string; type: string }> = [];

  for (const rel of relations) {
    if (rel.source_entity_id !== entityId) {
      continue;
    }
    const key = `${rel.target_entity_id}:${rel.relation_type}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ targetId: rel.target_entity_id, type: rel.relation_type });
  }

  return result;
}

export function mapAtlasToPaneEntities(atlas: SemanticAtlas): AtlasPaneEntity[] {
  const entities = atlas.getEntities();
  const allRelations = entities.flatMap((entity) => {
    const { hard, soft } = atlas.getRelationsForEntity(entity.id);
    return [...hard, ...soft];
  });

  return entities
    .filter((entity) => entity.id.startsWith("project:") || entity.id.startsWith("concept:") || entity.id.startsWith("doc:"))
    .map((entity) => {
      const locations = mapEntityLocations(atlas, entity.id);
      return {
        id: entity.id,
        label: entity.name,
        aliases: entityAliases(entity),
        relations: outgoingRelations(entity.id, allRelations),
        confidence: entity.confidence,
        source: primarySourceLabel(atlas, entity.id),
        locations,
        summary: entity.summary,
        kind: entity.kind,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
