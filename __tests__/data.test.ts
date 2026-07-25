/**
 * Data Operators Tests
 *
 * Tests for data/* operators: dataset/dataloader creation, splitting,
 * normalization, augmentation, tokenization and padding.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';
import type { SExpr } from '../types/expression.js';
import type { DatasetValue, DataLoaderValue } from '../std/data.js';

describe('data/* operators', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
    evaluator.clearCache();
  });

  describe('data/dataset', () => {
    it('wraps an entity array with its config', () => {
      const result = evaluate(['data/dataset', [{ input: [1] }, { input: [2] }], { note: 'x' }], ctx) as DatasetValue;
      expect(result.data).toHaveLength(2);
      expect(result.config).toEqual({ note: 'x' });
    });

    it('coerces a non-array first arg to an empty dataset', () => {
      const result = evaluate(['data/dataset', 'not-an-array', {}], ctx) as DatasetValue;
      expect(result.data).toEqual([]);
    });
  });

  describe('data/dataloader', () => {
    it('batches items in order when shuffle is false', () => {
      const dataset = evaluate(
        ['data/dataset', [[1, 1], [2, 2], [3, 3], [4, 4]], {}],
        ctx
      ) as SExpr;
      const result = evaluate(['data/dataloader', dataset, { batchSize: 2, shuffle: false }], ctx) as DataLoaderValue;
      expect(result.numBatches).toBe(2);
      expect(result.batches[0].x).toEqual([[1, 1], [2, 2]]);
      expect(result.batches[1].x).toEqual([[3, 3], [4, 4]]);
    });

    it('every source item appears exactly once across shuffled batches', () => {
      const items = Array.from({ length: 9 }, (_, i) => [i]);
      const dataset = evaluate(['data/dataset', items, {}], ctx) as SExpr;
      const result = evaluate(['data/dataloader', dataset, { batchSize: 4 }], ctx) as DataLoaderValue;
      expect(result.numBatches).toBe(3); // 4, 4, 1
      const seen = result.batches.flatMap((b) => b.x.map((row) => (row as number[])[0])).sort((a, b) => a - b);
      expect(seen).toEqual(Array.from({ length: 9 }, (_, i) => i));
    });

    it('reads a dict-shaped item via input/target field names', () => {
      const dataset = evaluate(['data/dataset', [{ input: [1, 2], target: [9] }], {}], ctx) as SExpr;
      const result = evaluate(['data/dataloader', dataset, { batchSize: 1, shuffle: false }], ctx) as DataLoaderValue;
      expect(result.batches[0].x).toEqual([[1, 2]]);
      expect(result.batches[0].y).toEqual([[9]]);
    });
  });

  describe('data/split', () => {
    it('splits by trainRatio and covers every original item exactly once', () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const dataset = evaluate(['data/dataset', items, {}], ctx) as SExpr;
      const [train, test] = evaluate(['data/split', dataset, { trainRatio: 0.8 }], ctx) as [DatasetValue, DatasetValue];
      expect(train.data).toHaveLength(8);
      expect(test.data).toHaveLength(2);
      const union = [...train.data, ...test.data].sort((a, b) => (a as number) - (b as number));
      expect(union).toEqual(items);
    });

    it('defaults trainRatio to 0.8', () => {
      const dataset = evaluate(['data/dataset', Array.from({ length: 5 }, (_, i) => i), {}], ctx) as SExpr;
      const [train] = evaluate(['data/split', dataset, {}], ctx) as [DatasetValue, DatasetValue];
      expect(train.data).toHaveLength(4); // trunc(5 * 0.8)
    });
  });

  describe('data/normalize', () => {
    it('zscore-normalizes a flat vector using sample (n-1) std', () => {
      const result = evaluate(['data/normalize', [1, 2, 3], { method: 'zscore' }], ctx);
      expect(result).toEqual([-1, 0, 1]);
    });

    it('zscore-normalizes a matrix per column', () => {
      const result = evaluate(
        [
          'data/normalize',
          [
            [1, 10],
            [2, 20],
            [3, 30],
          ],
          { method: 'zscore' },
        ],
        ctx
      );
      expect(result).toEqual([
        [-1, -1],
        [0, 0],
        [1, 1],
      ]);
    });

    it('minmax-normalizes into [0, 1]', () => {
      const result = evaluate(['data/normalize', [0, 5, 10], { method: 'minmax' }], ctx);
      expect(result).toEqual([0, 0.5, 1]);
    });

    it('defaults to zscore when method is omitted', () => {
      const result = evaluate(['data/normalize', [1, 2, 3], {}], ctx);
      expect(result).toEqual([-1, 0, 1]);
    });

    it('returns the tensor unchanged for an unrecognized method', () => {
      const result = evaluate(['data/normalize', [1, 2, 3], { method: 'bogus' }], ctx);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('data/augment', () => {
    it('is a no-op with noiseScale 0', () => {
      const result = evaluate(['data/augment', [1, 2, 3], { noiseScale: 0 }], ctx);
      expect(result).toEqual([1, 2, 3]);
    });

    it('perturbs every element when noiseScale is nonzero', () => {
      const result = evaluate(['data/augment', [1, 2, 3], { noiseScale: 1 }], ctx) as number[];
      expect(result).toHaveLength(3);
      expect(result.some((v, i) => v !== [1, 2, 3][i])).toBe(true);
    });
  });

  describe('data/tokenize', () => {
    it('char mode returns one Unicode code point per character', () => {
      const result = evaluate(['data/tokenize', 'AB', { mode: 'char' }], ctx);
      expect(result).toEqual([65, 66]);
    });

    it('defaults to char mode', () => {
      const result = evaluate(['data/tokenize', 'A', {}], ctx);
      expect(result).toEqual([65]);
    });

    it('word mode looks words up in the vocab, defaulting unseen words to 0', () => {
      const result = evaluate(
        ['data/tokenize', 'hello world unknown', { mode: 'word', vocab: { hello: 1, world: 2 } }],
        ctx
      );
      expect(result).toEqual([1, 2, 0]);
    });
  });

  describe('data/pad', () => {
    it('pads a short 1D tensor with padValue', () => {
      const result = evaluate(['data/pad', [1, 2], { length: 4 }], ctx);
      expect(result).toEqual([1, 2, 0, 0]);
    });

    it('truncates a long 1D tensor', () => {
      const result = evaluate(['data/pad', [1, 2, 3, 4, 5], { length: 3 }], ctx);
      expect(result).toEqual([1, 2, 3]);
    });

    it('honors a custom padValue', () => {
      const result = evaluate(['data/pad', [1], { length: 3, padValue: 9 }], ctx);
      expect(result).toEqual([1, 9, 9]);
    });

    it('pads along the last axis of a 2D tensor', () => {
      const result = evaluate(
        [
          'data/pad',
          [
            [1, 2],
            [3, 4],
          ],
          { length: 3, padValue: 9 },
        ],
        ctx
      );
      expect(result).toEqual([
        [1, 2, 9],
        [3, 4, 9],
      ]);
    });
  });
});
