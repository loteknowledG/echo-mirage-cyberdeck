import type { Database, SqlValue } from "sql.js";

import type { Memory } from "../memory/core";
import type { SemanticAtlas } from "../atlas/atlas";
import type { AtlasEntity, AtlasRelation, AtlasSource, EntityKind, RelationType } from "../atlas/atlas";

type SqlRow = SqlValue[];

function ensureAtlasSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS atlas_entities (
      id TEXT PRIMARY KEY,
      kind TEXT,
      name TEXT,
      summary TEXT,
      confidence REAL,
      status TEXT,
      attributes_json TEXT,
      created_at REAL,
      updated_at REAL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS atlas_entity_aliases (
      entity_id TEXT,
      alias TEXT,
      created_at REAL,
      PRIMARY KEY (entity_id, alias)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS atlas_relations (
      id TEXT PRIMARY KEY,
      source_entity_id TEXT,
      target_entity_id TEXT,
      relation_type TEXT,
      weight REAL,
      confidence REAL,
      provenance_json TEXT,
      created_at REAL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS atlas_sources (
      id TEXT PRIMARY KEY,
      entity_id TEXT,
      path TEXT,
      locator_type TEXT,
      locator_value TEXT,
      is_primary INTEGER,
      authority TEXT,
      validity_state TEXT,
      last_verified_at REAL,
      created_at REAL,
      updated_at REAL
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_atlas_relations_source ON atlas_relations(source_entity_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_atlas_relations_target ON atlas_relations(target_entity_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_atlas_sources_entity ON atlas_sources(entity_id)`);
}

export async function loadAtlasFromStore(atlas: SemanticAtlas, memory: Memory): Promise<number> {
  await memory.ready();
  const db = memory.getDatabase();
  if (!db) return 0;

  ensureAtlasSchema(db);

  const entityRows = db.exec(`SELECT id, kind, name, summary, confidence, status, attributes_json, created_at, updated_at FROM atlas_entities`);
  if (entityRows.length) {
    for (const row of entityRows[0].values as SqlRow[]) {
      const attributes = JSON.parse((row[6] as string) || "{}") as Record<string, unknown>;
      atlas.hydrateEntity({
        id: row[0] as string,
        kind: row[1] as EntityKind,
        name: row[2] as string,
        summary: row[3] as string,
        confidence: row[4] as number,
        status: row[5] as AtlasEntity["status"],
        attributes,
        created_at: row[7] as number,
        updated_at: row[8] as number,
      });
    }
  }

  const aliasRows = db.exec(`SELECT entity_id, alias FROM atlas_entity_aliases`);
  if (aliasRows.length) {
    for (const row of aliasRows[0].values as SqlRow[]) {
      atlas.hydrateAlias(row[0] as string, row[1] as string);
    }
  }

  const relationRows = db.exec(
    `SELECT id, source_entity_id, target_entity_id, relation_type, weight, confidence, provenance_json, created_at FROM atlas_relations`
  );
  if (relationRows.length) {
    for (const row of relationRows[0].values as SqlRow[]) {
      atlas.hydrateRelation({
        id: row[0] as string,
        source_entity_id: row[1] as string,
        target_entity_id: row[2] as string,
        relation_type: row[3] as RelationType,
        weight: row[4] as number,
        confidence: row[5] as number,
        provenance: JSON.parse((row[6] as string) || "{}"),
        created_at: row[7] as number,
      });
    }
  }

  const sourceRows = db.exec(
    `SELECT id, entity_id, path, locator_type, locator_value, is_primary, authority, validity_state, last_verified_at, created_at, updated_at FROM atlas_sources`
  );
  if (sourceRows.length) {
    for (const row of sourceRows[0].values as SqlRow[]) {
      atlas.hydrateSource({
        id: row[0] as string,
        entity_id: row[1] as string,
        path: row[2] as string,
        locator_type: row[3] as AtlasSource["locator_type"],
        locator_value: row[4] as string,
        is_primary: Boolean(row[5]),
        authority: row[6] as AtlasSource["authority"],
        validity_state: row[7] as AtlasSource["validity_state"],
        last_verified_at: row[8] as number,
        created_at: row[9] as number,
        updated_at: row[10] as number,
      });
    }
  }

  return atlas.getEntities().length;
}

export function persistAtlasEntity(memory: Memory, entity: AtlasEntity): void {
  const db = memory.getDatabase();
  if (!db) return;
  ensureAtlasSchema(db);
  db.run(
    `INSERT OR REPLACE INTO atlas_entities (id, kind, name, summary, confidence, status, attributes_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entity.id,
      entity.kind,
      entity.name,
      entity.summary,
      entity.confidence,
      entity.status,
      JSON.stringify(entity.attributes ?? {}),
      entity.created_at,
      entity.updated_at,
    ]
  );
  memory.markDirty();
}

export function persistAtlasAlias(memory: Memory, entityId: string, alias: string, createdAt: number): void {
  const db = memory.getDatabase();
  if (!db) return;
  ensureAtlasSchema(db);
  db.run(
    `INSERT OR IGNORE INTO atlas_entity_aliases (entity_id, alias, created_at) VALUES (?, ?, ?)`,
    [entityId, alias, createdAt]
  );
  memory.markDirty();
}

export function persistAtlasRelation(memory: Memory, relation: AtlasRelation): void {
  const db = memory.getDatabase();
  if (!db) return;
  ensureAtlasSchema(db);
  db.run(
    `INSERT OR REPLACE INTO atlas_relations (id, source_entity_id, target_entity_id, relation_type, weight, confidence, provenance_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      relation.id,
      relation.source_entity_id,
      relation.target_entity_id,
      relation.relation_type,
      relation.weight,
      relation.confidence,
      JSON.stringify(relation.provenance ?? {}),
      relation.created_at,
    ]
  );
  memory.markDirty();
}

export function persistAtlasSource(memory: Memory, source: AtlasSource): void {
  const db = memory.getDatabase();
  if (!db) return;
  ensureAtlasSchema(db);
  db.run(
    `INSERT OR REPLACE INTO atlas_sources (id, entity_id, path, locator_type, locator_value, is_primary, authority, validity_state, last_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      source.id,
      source.entity_id,
      source.path,
      source.locator_type,
      source.locator_value,
      source.is_primary ? 1 : 0,
      source.authority,
      source.validity_state,
      source.last_verified_at,
      source.created_at,
      source.updated_at,
    ]
  );
  memory.markDirty();
}
