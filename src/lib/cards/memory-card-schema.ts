export interface MemoryCardFrontmatter {
  card_id: string;
  card_type: string;
  title: string;
  project?: string;
  deck?: string;
  risk?: string;
  clicks?: number;
  tags?: string[];
  aliases?: string[];
  related_cards?: string[];
  version?: string;
}

export interface MemoryCard extends MemoryCardFrontmatter {
  filePath: string;
  content: string;
}

export type MemoryCardRegistry = {
  cards: MemoryCard[];
  byId: Record<string, MemoryCard>;
  byTag: Record<string, MemoryCard[]>;
  byType: Record<string, MemoryCard[]>;
};