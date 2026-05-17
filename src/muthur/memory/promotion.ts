import { getMemory, MemoryRecord } from "./core";

export type PromotionStage =
  | "observation"
  | "candidate"
  | "reinforced"
  | "durable"
  | "archived"
  | "skill_extracted";

export interface PromotionCriteria {
  reinforcementThreshold: number;
  stabilityThreshold: number;
  ageThresholdDays: number;
  observationCountMin: number;
}

const DEFAULT_CRITERIA: PromotionCriteria = {
  reinforcementThreshold: 3,
  stabilityThreshold: 0.7,
  ageThresholdDays: 7,
  observationCountMin: 2,
};

export class MemoryPromotionPipeline {
  private memory: ReturnType<typeof getMemory>;
  private criteria: PromotionCriteria;

  constructor(criteria?: Partial<PromotionCriteria>) {
    this.memory = getMemory();
    this.criteria = { ...DEFAULT_CRITERIA, ...criteria };
  }

  async promoteObservation(
    text: string,
    observation: string,
    metadata?: Record<string, unknown>
  ): Promise<number | null> {
    const memoryId = this.memory.add(
      "observation",
      observation,
      {
        original_text: text,
        stage: "observation",
        observation_count: 1,
        promoted_at: null,
        ...metadata,
      }
    );
    if (memoryId) this.memory.flush();
    return memoryId;
  }

  async promoteToCandidate(memoryId: number): Promise<MemoryRecord | null> {
    const row = this.memory.reinforceMemory(memoryId, "promoted to candidate", 0.05);
    if (!row) return null;

    const currentCount = (row.metadata.observation_count as number) || 1;
    const newCount = currentCount + 1;

    const updated = this.memory.updateMetadata(memoryId, {
      stage: "candidate",
      observation_count: newCount,
      promoted_at: Date.now(),
    });

    if (updated) this.memory.flush();
    return updated;
  }

  async checkAndPromote(memoryId: number): Promise<{
    promoted: boolean;
    newStage: PromotionStage;
    record: MemoryRecord | null;
  }> {
    const all = this.memory.all(500);
    const row = all.find(m => m.id === memoryId);
    if (!row) return { promoted: false, newStage: "observation", record: null };

    const reinforcementCount = (row.metadata.reinforcement_count as number) || 0;
    const stability = (row.metadata.stability as number) || 0;
    const observationCount = (row.metadata.observation_count as number) || 1;
    const ageMs = Date.now() - row.created_at;
    const ageDays = ageMs / (24 * 3600 * 1000);

    if (
      reinforcementCount >= this.criteria.reinforcementThreshold &&
      stability >= this.criteria.stabilityThreshold &&
      observationCount >= this.criteria.observationCountMin &&
      ageDays >= this.criteria.ageThresholdDays
    ) {
      const promoted = this.memory.updateMetadata(memoryId, {
        stage: "durable",
        promoted_at: Date.now(),
      });
      if (promoted) this.memory.flush();
      return {
        promoted: true,
        newStage: "durable",
        record: promoted,
      };
    }

    return {
      promoted: false,
      newStage: row.metadata.stage as PromotionStage || "observation",
      record: row,
    };
  }

  async getMemoriesByStage(stage: PromotionStage, limit: number = 50): Promise<MemoryRecord[]> {
    const all = this.memory.all(limit * 3);
    return all.filter(m => m.metadata?.stage === stage);
  }

  async decayLowValueMemories(maxAgeDays: number = 30): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
    const all = this.memory.all(500);
    let decayed = 0;

    for (const row of all) {
      if (row.created_at >= cutoff) continue;
      if (row.metadata?.long_term) continue;
      if (row.metadata?.pinned) continue;

      const reinforcementCount = (row.metadata?.reinforcement_count as number) || 0;
      const stability = (row.metadata?.stability as number) || 0;

      if (reinforcementCount <= 1 && stability < 0.3) {
        const updated = this.memory.updateMetadata(row.id, { stage: "archived" });
        if (updated) {
          decayed++;
          this.memory.flush();
        }
      }
    }

    return decayed;
  }

  async extractToSkill(
    memoryId: number,
    skillName: string,
    skillDescription: string
  ): Promise<{
    techniqueId: number | null;
    skillMemoryId: number | null;
  }> {
    const all = this.memory.all(500);
    const row = all.find(m => m.id === memoryId);
    if (!row) return { techniqueId: null, skillMemoryId: null };

    const techniqueId = this.memory.recordTechnique(
      skillName,
      row.text,
      row.metadata?.task as string | undefined,
      row.metadata?.outcome as string | undefined,
      {
        source: "skill_extraction",
        extracted_from_id: memoryId,
        skill_description: skillDescription,
        stage: "skill_extracted",
      }
    );

    if (techniqueId) this.memory.flush();
    return {
      techniqueId,
      skillMemoryId: memoryId,
    };
  }
}

let _pipeline: MemoryPromotionPipeline | null = null;

export function getPromotionPipeline(criteria?: Partial<PromotionCriteria>): MemoryPromotionPipeline {
  if (!_pipeline) {
    _pipeline = new MemoryPromotionPipeline(criteria);
  }
  return _pipeline;
}