/**
 * Graph Operators Tests
 *
 * Tests for graph/* operators: construction, transforms, accessors and
 * batching over `{ x, edgeIndex, edgeAttr }` graph data.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, evaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { EvaluationContext } from '../context.js';
import type { GraphData } from '../std/graph.js';

describe('graph/* operators', () => {
  let ctx: EvaluationContext;

  beforeEach(() => {
    ctx = createMinimalContext({}, {});
    evaluator.clearCache();
  });

  describe('graph/from-entities', () => {
    it('builds one node per entity from its numeric fields, padded to the widest row', () => {
      const result = evaluate(
        ['graph/from-entities', [{ a: 1, b: 2 }, { a: 3, b: 'skip-me', c: true }]],
        ctx
      ) as GraphData;
      expect(result.x).toEqual([
        [1, 2],
        [3, 1],
      ]);
      expect(result.edgeIndex).toEqual([[], []]);
    });

    it('falls back to a [0] row when an entity has no numeric fields', () => {
      const result = evaluate(['graph/from-entities', [{ name: 'only-strings' }]], ctx) as GraphData;
      expect(result.x).toEqual([[0]]);
    });

    it('returns an empty graph for an empty entity array', () => {
      const result = evaluate(['graph/from-entities', []], ctx) as GraphData;
      expect(result.x).toEqual([]);
      expect(result.edgeIndex).toEqual([[], []]);
    });
  });

  describe('graph/from-adjacency', () => {
    it('derives edges from nonzero cells in row-major order', () => {
      const result = evaluate(
        [
          'graph/from-adjacency',
          [
            [0, 1],
            [1, 0],
          ],
          [[10], [20]],
        ],
        ctx
      ) as GraphData;
      expect(result.edgeIndex).toEqual([[0, 1], [1, 0]]);
      expect(result.x).toEqual([[10], [20]]);
    });
  });

  describe('graph/from-edge-list', () => {
    it('transposes an [E,2] row-per-edge list into [2,E]', () => {
      const result = evaluate(
        ['graph/from-edge-list', [[0, 1], [1, 2], [2, 0]], [[1], [2], [3]]],
        ctx
      ) as GraphData;
      expect(result.edgeIndex).toEqual([[0, 1, 2], [1, 2, 0]]);
    });

    it('passes an already-[2,E] edge index through unchanged', () => {
      const result = evaluate(
        ['graph/from-edge-list', [[0, 1, 2], [1, 2, 0]], [[1], [2], [3]]],
        ctx
      ) as GraphData;
      expect(result.edgeIndex).toEqual([[0, 1, 2], [1, 2, 0]]);
    });
  });

  describe('graph/add-self-loops', () => {
    it('appends one self-loop edge per node', () => {
      const g = { x: [[1], [2], [3]], edgeIndex: [[0], [1]] };
      const result = evaluate(['graph/add-self-loops', g], ctx) as GraphData;
      expect(result.edgeIndex).toEqual([[0, 0, 1, 2], [1, 0, 1, 2]]);
    });
  });

  describe('graph/to-undirected', () => {
    it('adds the reverse of every edge', () => {
      const g = { x: [[1], [2]], edgeIndex: [[0], [1]] };
      const result = evaluate(['graph/to-undirected', g], ctx) as GraphData;
      expect(result.edgeIndex).toEqual([[0, 1], [1, 0]]);
    });
  });

  describe('graph/subgraph', () => {
    it('keeps only masked nodes and edges, remapping indices', () => {
      const g = {
        x: [[1], [2], [3]],
        edgeIndex: [[0, 1], [1, 2]],
      };
      const result = evaluate(['graph/subgraph', g, [true, true, false]], ctx) as GraphData;
      expect(result.x).toEqual([[1], [2]]);
      expect(result.edgeIndex).toEqual([[0], [1]]);
    });
  });

  describe('graph/k-hop', () => {
    it('reaches nodes within k hops treating edges as undirected', () => {
      // Path 0 -> 1 -> 2 -> 3
      const g = {
        x: [[0], [1], [2], [3]],
        edgeIndex: [[0, 1, 2], [1, 2, 3]],
      };
      const oneHop = evaluate(['graph/k-hop', g, 0, 1], ctx) as GraphData;
      expect(oneHop.x).toEqual([[0], [1]]);

      const twoHop = evaluate(['graph/k-hop', g, 0, 2], ctx) as GraphData;
      expect(twoHop.x).toEqual([[0], [1], [2]]);
    });
  });

  describe('accessors', () => {
    const g = { x: [[1], [2]], edgeIndex: [[0], [1]], edgeAttr: [[9]] };

    it('graph/node-features', () => {
      expect(evaluate(['graph/node-features', g], ctx)).toEqual([[1], [2]]);
    });
    it('graph/edge-index', () => {
      expect(evaluate(['graph/edge-index', g], ctx)).toEqual([[0], [1]]);
    });
    it('graph/edge-features', () => {
      expect(evaluate(['graph/edge-features', g], ctx)).toEqual([[9]]);
    });
    it('graph/num-nodes', () => {
      expect(evaluate(['graph/num-nodes', g], ctx)).toBe(2);
    });
    it('graph/num-edges', () => {
      expect(evaluate(['graph/num-edges', g], ctx)).toBe(1);
    });
  });

  describe('graph/degree', () => {
    it('counts out-degree from the source row only', () => {
      const g = { x: [[0], [0], [0]], edgeIndex: [[0, 0, 1], [1, 2, 2]] };
      expect(evaluate(['graph/degree', g], ctx)).toEqual([2, 1, 0]);
    });
  });

  describe('graph/batch', () => {
    it('concatenates node features and offsets edge indices per graph', () => {
      const g1 = { x: [[1]], edgeIndex: [[0], [0]] };
      const g2 = { x: [[2], [3]], edgeIndex: [[0], [1]] };
      const result = evaluate(['graph/batch', [g1, g2]], ctx) as GraphData;
      expect(result.x).toEqual([[1], [2], [3]]);
      expect(result.edgeIndex).toEqual([[0, 1], [0, 2]]);
    });

    it('returns an empty graph for an empty graph list', () => {
      const result = evaluate(['graph/batch', []], ctx) as GraphData;
      expect(result.x).toEqual([]);
      expect(result.edgeIndex).toEqual([[], []]);
    });
  });
});
