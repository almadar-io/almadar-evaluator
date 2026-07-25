/**
 * Contract Operators Tests
 *
 * Tests for contract/* operators: entity<->tensor conversion and
 * input/output contract validation for the R4 (learned rung) inference seam.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';
import type { SExpr } from '../types/expression.js';

describe('contract/* operators', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
    evaluator.clearCache();
  });

  describe('non-tensor input (the R4 rung guards untrusted model output)', () => {
    it('reports a not_a_tensor violation instead of throwing, so the circuit can abstain', () => {
      const result = evaluate(
        ['contract/validate-output', { score: 0.91 }, { ranges: {} }],
        ctx
      );
      expect(result).toEqual({
        valid: false,
        violations: [{ type: 'not_a_tensor', actualType: 'object' }],
      });
    });

    it('names null and non-numeric arrays distinctly', () => {
      expect(evaluate(['contract/validate-output', null, {}], ctx)).toEqual({
        valid: false,
        violations: [{ type: 'not_a_tensor', actualType: 'null' }],
      });
      expect(evaluate(['contract/validate-output', [1, 'two'], {}], ctx)).toEqual({
        valid: false,
        violations: [{ type: 'not_a_tensor', actualType: 'array containing non-numeric values' }],
      });
    });

    it('contract/violations surfaces the same violation', () => {
      expect(evaluate(['contract/violations', 'not a tensor', {}], ctx)).toEqual([
        { type: 'not_a_tensor', actualType: 'string' },
      ]);
    });

    it('clamp-output throws a named error naming the operator and the received type', () => {
      expect(() => evaluate(['contract/clamp-output', { a: 1 }, { ranges: {} }], ctx)).toThrow(
        /contract\/clamp-output: expected a tensor .* received object/
      );
    });

    it('tensor-to-payload throws a named error', () => {
      expect(() => evaluate(['contract/tensor-to-payload', { a: 1 }, { fields: ['a'] }], ctx)).toThrow(
        /contract\/tensor-to-payload: expected a tensor/
      );
    });

    it('an empty declared shape asserts a SCALAR output, it is not "unconstrained"', () => {
      expect(evaluate(['contract/validate-output', [0.9, 0.1], { shape: [] }], ctx)).toEqual({
        valid: false,
        violations: [{ type: 'shape_mismatch', expected: [], actual: [2] }],
      });
      expect(evaluate(['contract/validate-output', [0.9, 0.1], { ranges: {} }], ctx)).toEqual({
        valid: true,
        violations: [],
      });
    });
  });

  describe('contract/entity-to-tensor', () => {
    it('maps declared fields to a flat tensor in order', () => {
      const result = evaluate(
        ['contract/entity-to-tensor', { age: 5, score: 12 }, { fields: ['age', 'score'] }],
        ctx
      );
      expect(result).toEqual([5, 12]);
    });

    it('coerces non-numeric and missing field values to 0', () => {
      const result = evaluate(
        ['contract/entity-to-tensor', { name: 'bob', age: 5 }, { fields: ['name', 'age', 'missing'] }],
        ctx
      );
      expect(result).toEqual([0, 5, 0]);
    });

    it('supports {name} field spec objects, not just bare strings', () => {
      const result = evaluate(
        ['contract/entity-to-tensor', { age: 7 }, { fields: [{ name: 'age' }] }],
        ctx
      );
      expect(result).toEqual([7]);
    });
  });

  describe('contract/tensor-to-payload', () => {
    it('zips tensor values back onto field names by index', () => {
      const result = evaluate(
        ['contract/tensor-to-payload', [0.9, 0.1], { fields: ['positive', 'negative'] }],
        ctx
      );
      expect(result).toEqual({ positive: 0.9, negative: 0.1 });
    });

    it('drops fields beyond the tensor length', () => {
      const result = evaluate(
        ['contract/tensor-to-payload', [1], { fields: ['a', 'b'] }],
        ctx
      );
      expect(result).toEqual({ a: 1 });
    });
  });

  describe('contract/validate-input', () => {
    it('is valid with no violations when shape and ranges are satisfied', () => {
      const result = evaluate(
        [
          'contract/validate-input',
          [
            [0.5, 0.2],
            [0.3, 0.7],
          ],
          { shape: [2, 2], ranges: { '0': { min: 0, max: 1 } } },
        ],
        ctx
      ) as { valid: boolean; violations: unknown[] };
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('reports a shape_mismatch violation', () => {
      const result = evaluate(
        ['contract/validate-input', [1, 2, 3], { shape: [4] }],
        ctx
      ) as { valid: boolean; violations: { type: string; expected: number[]; actual: number[] }[] };
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual([{ type: 'shape_mismatch', expected: [4], actual: [3] }]);
    });

    it('reports a range_violation with actual min/max', () => {
      const result = evaluate(
        ['contract/validate-input', [1.5, 0.2], { ranges: { '0': { min: 0, max: 1 } } }],
        ctx
      ) as { valid: boolean; violations: { type: string; dim: number; actualMin: number; actualMax: number }[] };
      expect(result.valid).toBe(false);
      expect(result.violations).toEqual([
        { type: 'range_violation', dim: 0, min: 0, max: 1, actualMin: 1.5, actualMax: 1.5 },
      ]);
    });

    it('checks ranges per-column across rows for a 2D tensor', () => {
      const result = evaluate(
        [
          'contract/validate-input',
          [
            [0.2, 5],
            [0.9, -1],
          ],
          { ranges: { '1': { min: 0, max: 10 } } },
        ],
        ctx
      ) as { valid: boolean; violations: { dim: number; actualMin: number; actualMax: number }[] };
      expect(result.valid).toBe(false);
      expect(result.violations[0]).toEqual({ type: 'range_violation', dim: 1, min: 0, max: 10, actualMin: -1, actualMax: 5 });
    });

    it('silently skips a range dim index at or beyond the last-axis size', () => {
      const result = evaluate(
        ['contract/validate-input', [0.5], { ranges: { '5': { min: 0, max: 1 } } }],
        ctx
      ) as { valid: boolean; violations: unknown[] };
      expect(result.valid).toBe(true);
    });
  });

  describe('contract/validate-output', () => {
    it('behaves identically to validate-input (pure alias)', () => {
      const tensor: SExpr = [2];
      const contract: SExpr = { shape: [1] };
      const input = evaluate(['contract/validate-input', tensor, contract], ctx);
      const output = evaluate(['contract/validate-output', tensor, contract], ctx);
      expect(output).toEqual(input);
    });
  });

  describe('contract/clamp-output', () => {
    it('clamps each ranged dimension into [min, max]', () => {
      const result = evaluate(
        ['contract/clamp-output', [1.5, -0.2], { ranges: { '0': { min: 0, max: 1 }, '1': { min: 0, max: 1 } } }],
        ctx
      );
      expect(result).toEqual([1, 0]);
    });

    it('leaves unranged dimensions untouched', () => {
      const result = evaluate(
        ['contract/clamp-output', [1.5, 99], { ranges: { '0': { min: 0, max: 1 } } }],
        ctx
      );
      expect(result).toEqual([1, 99]);
    });

    it('clamps per row for a 2D tensor', () => {
      const result = evaluate(
        [
          'contract/clamp-output',
          [
            [1.5, 0.2],
            [-0.5, 0.9],
          ],
          { ranges: { '0': { min: 0, max: 1 } } },
        ],
        ctx
      );
      expect(result).toEqual([
        [1, 0.2],
        [0, 0.9],
      ]);
    });
  });

  describe('contract/violations', () => {
    it('returns just the violations array', () => {
      const result = evaluate(
        ['contract/violations', [1, 2, 3], { shape: [4] }],
        ctx
      );
      expect(result).toEqual([{ type: 'shape_mismatch', expected: [4], actual: [3] }]);
    });

    it('returns an empty array for a satisfying tensor', () => {
      const result = evaluate(['contract/violations', [0.5], {}], ctx);
      expect(result).toEqual([]);
    });
  });
});
