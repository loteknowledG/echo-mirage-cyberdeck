/** Shared entity atlas types (client + server safe). */

export type EntityAtlasEntityType =
  | "work_order"
  | "verification"
  | "adr"
  | "foundation"
  | "subsystem"
  | "provider"
  | "workspace"
  | "agent";

export type EntityAtlasRelationshipType =
  | "implements"
  | "verifies"
  | "governs"
  | "belongs_to"
  | "depends_on"
  | "references"
  | "informs";

export type EntityAtlasEntity = {
  id: string;
  type: EntityAtlasEntityType;
  label: string;
  keywords: string[];
};

export type EntityAtlasRelationship = {
  from: string;
  to: string;
  type: EntityAtlasRelationshipType;
};

export type EntityAtlasGraph = {
  entities: EntityAtlasEntity[];
  relationships: EntityAtlasRelationship[];
};
