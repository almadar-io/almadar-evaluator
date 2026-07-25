/**
 * array/cosine and array/nearest Tests
 *
 * Pure-math operators: cosine similarity + nearest-candidate-with-margin.
 * Live in array/* (not llm/*) because the compiler classifies anything
 * under the llm/ prefix as a substrate/async effect, which cannot be used
 * as a value inside a guard expression — see resolve.rs `is_substrate_op`.
 * No ctx.llm dependency — must work with ctx.llm undefined.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';

// Mirrors @almadar/llm's embedding-client.ts `cosineSimilarity` formula
// (not imported — the evaluator must not depend on @almadar/llm). Used only
// to confirm the evaluator's result agrees numerically on a fixed pair.
function referenceCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

describe('array/cosine', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
  });

  it('agrees numerically with the @almadar/llm reference cosine formula', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    const expected = referenceCosineSimilarity(a, b);
    const result = evaluate(['array/cosine', a, b], ctx) as number;
    expect(result).toBeCloseTo(expected, 12);
    expect(result).toBeCloseTo(0.9746318461970762, 12);
  });

  it('returns 1 for identical vectors', () => {
    const v = [0.5, -0.2, 0.8];
    const result = evaluate(['array/cosine', v, [...v]], ctx) as number;
    expect(result).toBeCloseTo(1, 12);
  });

  it('returns -1 for exactly opposite vectors', () => {
    const v = [1, 0, 0];
    const result = evaluate(['array/cosine', v, [-1, 0, 0]], ctx) as number;
    expect(result).toBeCloseTo(-1, 12);
  });

  it('returns 0 for orthogonal vectors (legitimate, not an error)', () => {
    const result = evaluate(['array/cosine', [1, 0], [0, 1]], ctx) as number;
    expect(result).toBe(0);
  });

  it('throws on mismatched vector lengths', () => {
    expect(() => evaluate(['array/cosine', [1, 2], [1, 2, 3]], ctx)).toThrow(
      /length mismatch/
    );
  });

  it('throws on empty vectors', () => {
    expect(() => evaluate(['array/cosine', [], []], ctx)).toThrow(/empty vector/);
  });

  it('throws on a zero-magnitude vector (does not silently collapse to 0)', () => {
    expect(() => evaluate(['array/cosine', [0, 0, 0], [1, 2, 3]], ctx)).toThrow(
      /zero-magnitude/
    );
  });

  it('works without ctx.llm set (pure math, no LLM dependency)', () => {
    const bareCtx = createMinimalContext({}, {});
    expect(bareCtx.llm).toBeUndefined();
    const result = evaluate(['array/cosine', [1, 0], [1, 0]], bareCtx) as number;
    expect(result).toBeCloseTo(1, 12);
  });
});

describe('array/nearest', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
  });

  it('finds the best-matching candidate by cosine similarity', () => {
    const query = [1, 0];
    const candidates = [
      [0, 1], // orthogonal, score 0
      [1, 0], // identical, score 1
      [-1, 0], // opposite, score -1
    ];
    const result = evaluate(['array/nearest', query, candidates], ctx) as {
      index: number;
      score: number;
      margin: number;
    };
    expect(result.index).toBe(1);
    expect(result.score).toBeCloseTo(1, 12);
  });

  it('margin is the gap between best and second-best score', () => {
    const query = [1, 0];
    const candidates = [
      [1, 0], // score 1 (best)
      [0.9, Math.sqrt(1 - 0.81)], // cos exactly 0.9 (second-best)
      [0, 1], // score 0
    ];
    const result = evaluate(['array/nearest', query, candidates], ctx) as {
      index: number;
      score: number;
      margin: number;
    };
    expect(result.index).toBe(0);
    expect(result.score).toBeCloseTo(1, 12);
    expect(result.margin).toBeCloseTo(1 - 0.9, 6);
  });

  it('margin is 0 for a single candidate (no runner-up to compare against)', () => {
    const query = [1, 0];
    const candidates = [[0.3, 0.9]];
    const result = evaluate(['array/nearest', query, candidates], ctx) as {
      index: number;
      score: number;
      margin: number;
    };
    expect(result.index).toBe(0);
    expect(result.margin).toBe(0);
  });

  it('throws on an empty candidates array instead of a bogus index', () => {
    expect(() => evaluate(['array/nearest', [1, 0], []], ctx)).toThrow(/empty/);
  });

  it('picks the first candidate on an exact score tie', () => {
    const query = [1, 0];
    const candidates = [
      [1, 0],
      [1, 0],
    ];
    const result = evaluate(['array/nearest', query, candidates], ctx) as {
      index: number;
      score: number;
      margin: number;
    };
    expect(result.index).toBe(0);
    expect(result.margin).toBeCloseTo(0, 12);
  });

  it('works without ctx.llm set (pure math, no LLM dependency)', () => {
    const bareCtx = createMinimalContext({}, {});
    expect(bareCtx.llm).toBeUndefined();
    const result = evaluate(
      ['array/nearest', [1, 0], [[0, 1], [1, 0]]],
      bareCtx
    ) as { index: number; score: number; margin: number };
    expect(result.index).toBe(1);
  });
});
