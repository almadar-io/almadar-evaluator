/**
 * JSON Operators Tests
 *
 * Tests for json/parse and json/stringify: objects, arrays, scalars, nested
 * values, invalid JSON → null, non-string input → null, and round-trips.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';

describe('json/* operators', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
    evaluator.clearCache();
  });

  describe('json/parse', () => {
    it('parses a JSON object', () => {
      expect(evaluate(['json/parse', '{"a": 1, "b": "x"}'], ctx)).toEqual({ a: 1, b: 'x' });
    });

    it('parses a JSON array', () => {
      expect(evaluate(['json/parse', '[1, 2, 3]'], ctx)).toEqual([1, 2, 3]);
    });

    it('parses scalars', () => {
      expect(evaluate(['json/parse', '42'], ctx)).toBe(42);
      expect(evaluate(['json/parse', '"hello"'], ctx)).toBe('hello');
      expect(evaluate(['json/parse', 'true'], ctx)).toBe(true);
      expect(evaluate(['json/parse', 'null'], ctx)).toBe(null);
    });

    it('parses nested structures', () => {
      const s = '{"rows": [{"id": 1, "tags": ["a", "b"]}], "meta": {"count": 1}}';
      expect(evaluate(['json/parse', s], ctx)).toEqual({
        rows: [{ id: 1, tags: ['a', 'b'] }],
        meta: { count: 1 },
      });
    });

    it('returns null for invalid JSON (never throws)', () => {
      expect(evaluate(['json/parse', '{not json'], ctx)).toBe(null);
      expect(evaluate(['json/parse', ''], ctx)).toBe(null);
      expect(evaluate(['json/parse', 'undefined'], ctx)).toBe(null);
    });

    it('returns null for non-string input', () => {
      expect(evaluate(['json/parse', 42], ctx)).toBe(null);
      expect(evaluate(['json/parse', null], ctx)).toBe(null);
      expect(evaluate(['json/parse', { a: 1 }], ctx)).toBe(null);
      expect(evaluate(['json/parse', [1, 2]], ctx)).toBe(null);
    });
  });

  describe('json/stringify', () => {
    it('serializes objects, arrays, and scalars', () => {
      expect(evaluate(['json/stringify', { a: 1 }], ctx)).toBe('{"a":1}');
      expect(evaluate(['json/stringify', [1, 'x', true]], ctx)).toBe('[1,"x",true]');
      expect(evaluate(['json/stringify', 'hello'], ctx)).toBe('"hello"');
      expect(evaluate(['json/stringify', 42], ctx)).toBe('42');
    });
  });

  describe('round-trip', () => {
    it('parse(stringify(v)) === v for nested values', () => {
      const value = { id: 7, name: 'row', flags: [true, false], nested: { deep: null } };
      const s = evaluate(['json/stringify', value], ctx);
      if (typeof s !== 'string') throw new Error('json/stringify did not return a string');
      expect(evaluate(['json/parse', s], ctx)).toEqual(value);
    });
  });
});
