/**
 * Probabilistic Operators Tests
 *
 * Tests for prob/* operators: distribution sampling, inference, and statistics.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';

describe('prob/* operators', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
    evaluator.clearCache();
  });

  // ========================================
  // Distribution Sampling
  // ========================================
  describe('prob/seed', () => {
    it('sets seeded PRNG on context', () => {
      evaluate(['prob/seed', 42], ctx);
      expect(ctx._probSeed).toBeDefined();
      expect(ctx._probSeed?.state).toBeTypeOf('number');
    });
  });

  describe('prob/flip', () => {
    it('returns boolean', () => {
      const result = evaluate(['prob/flip', 0.5], ctx);
      expect(typeof result).toBe('boolean');
    });

    it('always true when p=1', () => {
      for (let i = 0; i < 100; i++) {
        expect(evaluate(['prob/flip', 1], ctx)).toBe(true);
      }
    });

    it('always false when p=0', () => {
      for (let i = 0; i < 100; i++) {
        expect(evaluate(['prob/flip', 0], ctx)).toBe(false);
      }
    });

    it('approximates probability over many samples', () => {
      evaluate(['prob/seed', 123], ctx);
      let trueCount = 0;
      const n = 10000;
      for (let i = 0; i < n; i++) {
        if (evaluate(['prob/flip', 0.3], ctx)) trueCount++;
      }
      const ratio = trueCount / n;
      expect(ratio).toBeGreaterThan(0.25);
      expect(ratio).toBeLessThan(0.35);
    });
  });

  describe('prob/gaussian', () => {
    it('returns a number', () => {
      const result = evaluate(['prob/gaussian', 0, 1], ctx);
      expect(typeof result).toBe('number');
    });

    it('has correct mean and stddev over many samples', () => {
      evaluate(['prob/seed', 99], ctx);
      const n = 10000;
      const samples: number[] = [];
      for (let i = 0; i < n; i++) {
        samples.push(evaluate(['prob/gaussian', 5, 2], ctx) as number);
      }
      const mean = samples.reduce((s, v) => s + v, 0) / n;
      const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
      const stddev = Math.sqrt(variance);

      expect(mean).toBeGreaterThan(4.5);
      expect(mean).toBeLessThan(5.5);
      expect(stddev).toBeGreaterThan(1.5);
      expect(stddev).toBeLessThan(2.5);
    });
  });

  describe('prob/uniform', () => {
    it('returns values within range', () => {
      evaluate(['prob/seed', 77], ctx);
      for (let i = 0; i < 1000; i++) {
        const val = evaluate(['prob/uniform', 3, 7], ctx) as number;
        expect(val).toBeGreaterThanOrEqual(3);
        expect(val).toBeLessThan(7);
      }
    });
  });

  describe('prob/beta', () => {
    it('returns values in [0, 1]', () => {
      evaluate(['prob/seed', 55], ctx);
      for (let i = 0; i < 500; i++) {
        const val = evaluate(['prob/beta', 2, 5], ctx) as number;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('has correct mean for Beta(2, 5)', () => {
      evaluate(['prob/seed', 55], ctx);
      const n = 10000;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += evaluate(['prob/beta', 2, 5], ctx) as number;
      }
      const mean = sum / n;
      // Theoretical mean: 2/(2+5) = 0.2857
      expect(mean).toBeGreaterThan(0.23);
      expect(mean).toBeLessThan(0.34);
    });

    it('Beta(1, 1) approximates uniform mean ~0.5', () => {
      evaluate(['prob/seed', 66], ctx);
      const n = 5000;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += evaluate(['prob/beta', 1, 1], ctx) as number;
      }
      const mean = sum / n;
      expect(mean).toBeGreaterThan(0.45);
      expect(mean).toBeLessThan(0.55);
    });
  });

  describe('prob/categorical', () => {
    it('always picks the only non-zero weighted item', () => {
      ctx = createMinimalContext(
        { items: ['a', 'b', 'c'], weights: [1, 0, 0] },
        {},
      );
      for (let i = 0; i < 50; i++) {
        const result = evaluate(
          ['prob/categorical', '@entity.items', '@entity.weights'],
          ctx,
        );
        expect(result).toBe('a');
      }
    });

    it('picks items according to weights', () => {
      ctx = createMinimalContext(
        { items: ['a', 'b', 'c'], weights: [1, 2, 1] },
        {},
      );
      evaluate(['prob/seed', 42], ctx);
      const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
      const n = 3000;
      for (let i = 0; i < n; i++) {
        const result = evaluate(
          ['prob/categorical', '@entity.items', '@entity.weights'],
          ctx,
        ) as string;
        counts[result]++;
      }
      // 'b' should be picked roughly half the time
      expect(counts['b'] / n).toBeGreaterThan(0.4);
      expect(counts['b'] / n).toBeLessThan(0.6);
    });
  });

  describe('prob/poisson', () => {
    it('returns non-negative integers', () => {
      evaluate(['prob/seed', 31], ctx);
      for (let i = 0; i < 500; i++) {
        const val = evaluate(['prob/poisson', 4], ctx) as number;
        expect(val).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('has mean approximately equal to lambda', () => {
      evaluate(['prob/seed', 31], ctx);
      const n = 10000;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += evaluate(['prob/poisson', 4], ctx) as number;
      }
      const mean = sum / n;
      expect(mean).toBeGreaterThan(3.5);
      expect(mean).toBeLessThan(4.5);
    });
  });

  // ========================================
  // Seed Reproducibility
  // ========================================
  describe('seed reproducibility', () => {
    it('produces identical sequences with same seed', () => {
      evaluate(['prob/seed', 42], ctx);
      const a1 = evaluate(['prob/flip', 0.5], ctx);
      const a2 = evaluate(['prob/gaussian', 0, 1], ctx);
      const a3 = evaluate(['prob/uniform', 0, 10], ctx);

      // Reset seed
      evaluate(['prob/seed', 42], ctx);
      const b1 = evaluate(['prob/flip', 0.5], ctx);
      const b2 = evaluate(['prob/gaussian', 0, 1], ctx);
      const b3 = evaluate(['prob/uniform', 0, 10], ctx);

      expect(a1).toBe(b1);
      expect(a2).toBe(b2);
      expect(a3).toBe(b3);
    });
  });

  // ========================================
  // Inference
  // ========================================
  describe('prob/condition', () => {
    it('sets _probRejected when predicate is false', () => {
      evaluate(['prob/condition', false], ctx);
      expect(ctx._probRejected).toBe(true);
    });

    it('does not reject when predicate is true', () => {
      evaluate(['prob/condition', true], ctx);
      expect(ctx._probRejected).toBeUndefined();
    });
  });

  describe('prob/sample', () => {
    it('returns array of n results', () => {
      evaluate(['prob/seed', 10], ctx);
      const result = evaluate(['prob/sample', 5, ['prob/flip', 0.5]], ctx) as unknown[];
      expect(result).toHaveLength(5);
      for (const v of result) {
        expect(typeof v).toBe('boolean');
      }
    });

    it('returns empty array for n=0', () => {
      const result = evaluate(['prob/sample', 0, ['prob/flip', 0.5]], ctx) as unknown[];
      expect(result).toEqual([]);
    });
  });

  describe('prob/posterior', () => {
    it('returns only accepted samples', () => {
      evaluate(['prob/seed', 42], ctx);
      // Model: set alice and bob strengths from gaussian
      // Evidence: alice > bob
      // Query: alice's strength
      const result = evaluate([
        'prob/posterior',
        ['do',
          ['set', '@entity.alice', ['prob/gaussian', 10, 3]],
          ['set', '@entity.bob', ['prob/gaussian', 10, 3]],
        ],
        ['>', '@entity.alice', '@entity.bob'],
        '@entity.alice',
        2000,
      ], ctx) as number[];

      expect(result.length).toBeGreaterThan(0);
      // Conditioned on alice > bob, mean should be above prior mean of 10
      const mean = result.reduce((s, v) => s + v, 0) / result.length;
      expect(mean).toBeGreaterThan(10);
    });

    it('returns empty array with impossible evidence', () => {
      evaluate(['prob/seed', 42], ctx);
      const result = evaluate([
        'prob/posterior',
        ['set', '@entity.x', 5],
        ['>', '@entity.x', 100], // always false since x is always 5
        '@entity.x',
        100,
      ], ctx) as unknown[];

      expect(result).toEqual([]);
    });
  });

  describe('prob/infer', () => {
    it('returns summary statistics for tug-of-war', () => {
      evaluate(['prob/seed', 42], ctx);
      const result = evaluate([
        'prob/infer',
        ['do',
          ['set', '@entity.alice', ['prob/gaussian', 10, 3]],
          ['set', '@entity.bob', ['prob/gaussian', 10, 3]],
        ],
        ['>', '@entity.alice', '@entity.bob'],
        '@entity.alice',
        5000,
      ], ctx) as { mean: number; variance: number; samples: number[]; acceptRate: number };

      expect(result.mean).toBeGreaterThan(10);
      expect(result.acceptRate).toBeGreaterThan(0.3);
      expect(result.acceptRate).toBeLessThan(0.7);
      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.variance).toBeGreaterThan(0);
    });

    it('returns zeros with impossible evidence', () => {
      evaluate(['prob/seed', 42], ctx);
      const result = evaluate([
        'prob/infer',
        ['set', '@entity.x', 5],
        ['>', '@entity.x', 100],
        '@entity.x',
        100,
      ], ctx) as { mean: number; variance: number; samples: number[]; acceptRate: number };

      expect(result.mean).toBe(0);
      expect(result.variance).toBe(0);
      expect(result.samples).toEqual([]);
      expect(result.acceptRate).toBe(0);
    });
  });

  // ========================================
  // Statistics
  // ========================================
  describe('prob/expected-value', () => {
    it('computes mean', () => {
      expect(evaluate(['prob/expected-value', [2, 4, 6, 8]], ctx)).toBe(5);
    });

    it('returns 0 for empty array', () => {
      expect(evaluate(['prob/expected-value', []], ctx)).toBe(0);
    });
  });

  describe('prob/variance', () => {
    it('computes population variance', () => {
      const result = evaluate(['prob/variance', [2, 4, 4, 4, 5, 5, 7, 9]], ctx) as number;
      expect(result).toBe(4);
    });

    it('returns 0 for empty array', () => {
      expect(evaluate(['prob/variance', []], ctx)).toBe(0);
    });
  });

  describe('prob/histogram', () => {
    it('bins samples correctly', () => {
      const result = evaluate(
        ['prob/histogram', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 2],
        ctx,
      ) as { binEdges: number[]; counts: number[] };

      expect(result.counts).toHaveLength(2);
      expect(result.binEdges).toHaveLength(3);
      const totalCount = result.counts.reduce((s, c) => s + c, 0);
      expect(totalCount).toBe(10);
    });

    it('returns empty for empty samples', () => {
      const result = evaluate(
        ['prob/histogram', [], 5],
        ctx,
      ) as { binEdges: number[]; counts: number[] };

      expect(result.binEdges).toEqual([]);
      expect(result.counts).toEqual([]);
    });
  });

  describe('prob/percentile', () => {
    it('computes median (50th percentile)', () => {
      expect(evaluate(['prob/percentile', [1, 2, 3, 4, 5], 50], ctx)).toBe(3);
    });

    it('computes 0th percentile (min)', () => {
      expect(evaluate(['prob/percentile', [1, 2, 3, 4, 5], 0], ctx)).toBe(1);
    });

    it('computes 100th percentile (max)', () => {
      expect(evaluate(['prob/percentile', [1, 2, 3, 4, 5], 100], ctx)).toBe(5);
    });

    it('returns 0 for empty array', () => {
      expect(evaluate(['prob/percentile', [], 50], ctx)).toBe(0);
    });
  });

  describe('prob/credible-interval', () => {
    it('computes interval for alpha=0.1', () => {
      const samples = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = evaluate(
        ['prob/credible-interval', samples, 0.1],
        ctx,
      ) as [number, number];

      expect(result).toHaveLength(2);
      const [lo, hi] = result;
      expect(lo).toBeLessThanOrEqual(6);
      expect(hi).toBeGreaterThanOrEqual(95);
    });

    it('returns [0, 0] for empty array', () => {
      expect(evaluate(['prob/credible-interval', [], 0.05], ctx)).toEqual([0, 0]);
    });
  });

  // ========================================
  // Integration: prob/condition inside prob/infer
  // ========================================
  describe('prob/condition inside prob/infer', () => {
    it('rejects samples via condition in model expression', () => {
      evaluate(['prob/seed', 42], ctx);
      const result = evaluate([
        'prob/infer',
        ['do',
          ['set', '@entity.x', ['prob/gaussian', 0, 5]],
          ['prob/condition', ['>', '@entity.x', 0]],
        ],
        true, // no additional evidence filter
        '@entity.x',
        5000,
      ], ctx) as { mean: number; samples: number[] };

      // All accepted samples should be > 0 (half-normal)
      for (const s of result.samples) {
        expect(s).toBeGreaterThan(0);
      }
      // Mean of half-normal(0, 5) ~ 5 * sqrt(2/pi) ~ 3.99
      expect(result.mean).toBeGreaterThan(2);
      expect(result.mean).toBeLessThan(6);
    });
  });
});
