const SEMANTIC_DIM = 64;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "for",
  "from", "have", "he", "her", "his", "how", "i", "if", "in", "is", "it", "its",
  "me", "my", "no", "not", "of", "on", "or", "our", "that", "the", "their",
  "them", "then", "there", "this", "to", "we", "what", "when", "where", "which", "with", "you",
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

/** Deterministic bag-of-terms embedding for semantic-ish hybrid recall (no external model). */
export function computeSemanticEmbedding(text: string): number[] {
  const vec = new Array<number>(SEMANTIC_DIM).fill(0);
  for (const token of tokenize(text)) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % SEMANTIC_DIM;
    vec[idx] += 1;
  }

  let norm = 0;
  for (const value of vec) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }
  aNorm = Math.sqrt(aNorm);
  bNorm = Math.sqrt(bNorm);
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (aNorm * bNorm);
}
