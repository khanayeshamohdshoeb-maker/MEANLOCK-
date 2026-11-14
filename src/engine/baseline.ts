import { BaselineSimilarity, UnitComparison } from './types';
import { simpleStem, tokenize } from './preprocess';

/**
 * Computes a standard mathematical text similarity baseline:
 * - Stemmed Bag-of-Words Unigram Cosine Similarity (mirroring standard TF cosine checks)
 * - Jaccard Word Overlap
 *
 * This demonstrates why ordinary surface text similarity can look high even when
 * decision-critical units (deadlines, obligations, negations, documents) are lost.
 */
function buildWordVector(text: string): Map<string, number> {
  const vec = new Map<string, number>();
  const tokens = tokenize(text, true).map(simpleStem);

  for (const tok of tokens) {
    vec.set(tok, (vec.get(tok) ?? 0) + 1.0);
  }
  return vec;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, valA] of a.entries()) {
    normA += valA * valA;
    const valB = b.get(key);
    if (valB !== undefined) {
      dot += valA * valB;
    }
  }
  for (const valB of b.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function jaccardSimilarity(textA: string, textB: string): number {
  const setA = new Set(tokenize(textA, true).map(simpleStem));
  const setB = new Set(tokenize(textB, true).map(simpleStem));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function computeBaselineSimilarity(
  originalText: string,
  transformedText: string,
  comparisons: UnitComparison[]
): BaselineSimilarity {
  const vecA = buildWordVector(originalText);
  const vecB = buildWordVector(transformedText);

  const cos = cosineSimilarity(vecA, vecB);
  const jac = jaccardSimilarity(originalText, transformedText);

  const cosineSimilarityPct = Math.round(cos * 100);
  const jaccardOverlapPct = Math.round(jac * 100);

  const lostOrChanged = comparisons.filter((c) => c.status === 'LOST' || c.status === 'CHANGED');
  const weakened = comparisons.filter((c) => c.status === 'WEAKENED');
  const issueCount = lostOrChanged.length + weakened.length;

  let contrastSummary: string;
  if (issueCount > 0) {
    contrastSummary = `The messages share ${cosineSimilarityPct}% surface word similarity, while ${lostOrChanged.length} critical unit(s) disappeared or changed and ${weakened.length} weakened.`;
  } else {
    contrastSummary = `Surface text similarity is ${cosineSimilarityPct}%, and all detected decision-critical units were preserved.`;
  }

  return {
    cosineSimilarityPct,
    jaccardOverlapPct,
    methodLabel: 'Stemmed Bag-of-Words Cosine Baseline',
    contrastSummary,
  };
}
