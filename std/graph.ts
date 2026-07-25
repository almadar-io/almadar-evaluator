/**
 * Graph Operators Runtime Evaluators
 *
 * Runtime implementations for graph/* operators — construction, transforms,
 * accessors and batching for GNN-shaped circuit data. Mirrors
 * `graph_helpers.py` (`orbital-rust/crates/orbital-shell-python/src/backend.rs`,
 * generator `generate_graph_helpers`) semantically. A plain
 * `{ x, edgeIndex, edgeAttr }` object stands in for Python's `GraphData`
 * class; `x` is node features (rows = nodes), `edgeIndex` is `[srcs, dsts]`
 * (mirrors torch's `[2, num_edges]` layout), `edgeAttr` is optional edge
 * features. Tensors are plain JSON (see contract.ts's `TensorValue`).
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { TensorValue } from './contract.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export interface GraphData {
  x: TensorValue[];
  edgeIndex: [number[], number[]];
  edgeAttr?: TensorValue;
}

function tensorShape(t: TensorValue): number[] {
  if (typeof t === 'number') return [];
  if (t.length === 0) return [0];
  const first = t[0];
  if (typeof first === 'number') return [t.length];
  return [t.length, ...tensorShape(first)];
}

function numNodes(g: GraphData): number {
  return g.x.length;
}

function subgraphData(g: GraphData, mask: boolean[]): GraphData {
  const nodeMap: number[] = new Array(numNodes(g)).fill(-1);
  const x: TensorValue[] = [];
  let next = 0;
  for (let i = 0; i < numNodes(g); i++) {
    if (mask[i]) {
      nodeMap[i] = next++;
      x.push(g.x[i]);
    }
  }
  const [srcAll, dstAll] = g.edgeIndex;
  const src: number[] = [];
  const dst: number[] = [];
  for (let k = 0; k < srcAll.length; k++) {
    const s = srcAll[k];
    const d = dstAll[k];
    if (mask[s] && mask[d]) {
      src.push(nodeMap[s]);
      dst.push(nodeMap[d]);
    }
  }
  // edge_attr is dropped, matching graph_subgraph's `GraphData(x=x, edge_index=edge_index)`.
  return { x, edgeIndex: [src, dst] };
}

// ============================================================================
// Construction
// ============================================================================

/**
 * graph/from-entities - Build a graph from an entity array; each entity
 * becomes a node whose feature row is its numeric field values (Python's
 * `isinstance(v, (int, float))` also matches bool, so booleans coerce to
 * 0/1 here too), padded to the longest row. No edges are produced — matches
 * `graph_from_entities` exactly. NOTE: the std/graph.ts metadata declares a
 * single `config` object param (`{nodes, edges, node-features, ...}`), but
 * the Python codegen forwards arg0 straight through to
 * `graph_from_entities(entities: List[Dict])` — a raw entity array, not a
 * config object. Implemented to match what actually runs.
 */
export function evalGraphFromEntities(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const entities = evaluate(args[0], ctx) as Record<string, unknown>[];
  if (entities.length === 0) {
    return { x: [], edgeIndex: [[], []] };
  }
  const features = entities.map((e) => {
    const row = Object.values(e)
      .filter((v): v is number | boolean => typeof v === 'number' || typeof v === 'boolean')
      .map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v));
    return row.length > 0 ? row : [0];
  });
  const maxLen = Math.max(...features.map((r) => r.length));
  const x = features.map((r) => [...r, ...new Array(maxLen - r.length).fill(0)]);
  return { x, edgeIndex: [[], []] };
}

/**
 * graph/from-adjacency - Build a graph from an adjacency matrix (edges via
 * nonzero, row-major torch order) and a node feature matrix, per the
 * std/graph.ts declared param order `(adjacency, features)`. NOTE: the
 * Python codegen forwards args positionally into
 * `graph_from_adjacency(features, adj_matrix)` — the OPPOSITE order — so a
 * `.lolo` call site following the documented `(adjacency, features)`
 * contract binds arg0 to Python's `features` and arg1 to `adj_matrix`,
 * silently swapping the two on the compiled path. Implemented here to match
 * the DECLARED contract (std/graph.ts is the operator's source of truth);
 * this is a real compiler-side divergence, flagged for orbital-rust
 * (ask-first, sacred).
 */
export function evalGraphFromAdjacency(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const adjacency = evaluate(args[0], ctx) as number[][];
  const features = evaluate(args[1], ctx) as TensorValue[];
  const src: number[] = [];
  const dst: number[] = [];
  for (let i = 0; i < adjacency.length; i++) {
    const row = adjacency[i];
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== 0) {
        src.push(i);
        dst.push(j);
      }
    }
  }
  return { x: features, edgeIndex: [src, dst] };
}

/**
 * graph/from-edge-list - Build a graph from an edge list and a node feature
 * matrix, per the std/graph.ts declared param order `(edges, features)`.
 * Accepts edges either as `[E, 2]` (row-per-edge `[src, dst]` pairs,
 * transposed to `[2, E]`) or already `[2, E]`, matching
 * `graph_from_edge_list`'s `edges.size(1) == 2` shape check. Same
 * declared-vs-codegen param-order divergence as graph/from-adjacency above.
 */
export function evalGraphFromEdgeList(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const edges = evaluate(args[0], ctx) as TensorValue;
  const features = evaluate(args[1], ctx) as TensorValue[];
  const shape = tensorShape(edges);
  let edgeIndex: [number[], number[]];
  if (shape.length === 2 && shape[1] === 2) {
    const rows = edges as number[][];
    edgeIndex = [rows.map((r) => r[0]), rows.map((r) => r[1])];
  } else {
    const pair = edges as number[][];
    edgeIndex = [pair[0] ?? [], pair[1] ?? []];
  }
  return { x: features, edgeIndex };
}

// ============================================================================
// Transforms
// ============================================================================

/** graph/add-self-loops - Append a self-loop edge for every node. */
export function evalGraphAddSelfLoops(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const g = evaluate(args[0], ctx) as GraphData;
  const n = numNodes(g);
  const loop = Array.from({ length: n }, (_, i) => i);
  const [src, dst] = g.edgeIndex;
  return { x: g.x, edgeIndex: [[...src, ...loop], [...dst, ...loop]], edgeAttr: g.edgeAttr };
}

/** graph/to-undirected - Add the reverse of every edge. */
export function evalGraphToUndirected(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const g = evaluate(args[0], ctx) as GraphData;
  const [src, dst] = g.edgeIndex;
  return { x: g.x, edgeIndex: [[...src, ...dst], [...dst, ...src]], edgeAttr: g.edgeAttr };
}

/** graph/subgraph - Extract the subgraph induced by a boolean node mask. */
export function evalGraphSubgraph(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const g = evaluate(args[0], ctx) as GraphData;
  const mask = evaluate(args[1], ctx) as boolean[];
  return subgraphData(g, mask);
}

/**
 * graph/k-hop - BFS out to k hops from a node (edges treated as undirected
 * for reachability, matching `graph_k_hop`'s `s==n or d==n` check), then
 * subgraph on the visited-node mask.
 */
export function evalGraphKHop(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const g = evaluate(args[0], ctx) as GraphData;
  const node = evaluate(args[1], ctx) as number;
  const k = evaluate(args[2], ctx) as number;
  const [src, dst] = g.edgeIndex;

  const visited = new Set<number>([node]);
  let frontier = new Set<number>([node]);
  for (let hop = 0; hop < k; hop++) {
    const next = new Set<number>();
    for (const n of frontier) {
      for (let e = 0; e < src.length; e++) {
        if (src[e] === n && !visited.has(dst[e])) next.add(dst[e]);
        if (dst[e] === n && !visited.has(src[e])) next.add(src[e]);
      }
    }
    for (const v of next) visited.add(v);
    frontier = next;
  }

  const mask = new Array(numNodes(g)).fill(false);
  for (const n of visited) mask[n] = true;
  return subgraphData(g, mask);
}

// ============================================================================
// Accessors
// ============================================================================

export function evalGraphNodeFeatures(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): TensorValue[] {
  return (evaluate(args[0], ctx) as GraphData).x;
}

export function evalGraphEdgeIndex(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): [number[], number[]] {
  return (evaluate(args[0], ctx) as GraphData).edgeIndex;
}

export function evalGraphEdgeFeatures(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): TensorValue | undefined {
  return (evaluate(args[0], ctx) as GraphData).edgeAttr;
}

export function evalGraphNumNodes(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  return numNodes(evaluate(args[0], ctx) as GraphData);
}

export function evalGraphNumEdges(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  return (evaluate(args[0], ctx) as GraphData).edgeIndex[0].length;
}

/** graph/degree - Out-degree per node, counted from the source row only, matching `graph_degree`. */
export function evalGraphDegree(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number[] {
  const g = evaluate(args[0], ctx) as GraphData;
  const deg = new Array(numNodes(g)).fill(0);
  for (const s of g.edgeIndex[0]) deg[s]++;
  return deg;
}

// ============================================================================
// Batching
// ============================================================================

/** graph/batch - Concatenate node features and edge indices (offset per graph); edge_attr is dropped, matching `graph_batch`. */
export function evalGraphBatch(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): GraphData {
  const graphs = evaluate(args[0], ctx) as GraphData[];
  if (graphs.length === 0) return { x: [], edgeIndex: [[], []] };
  const x: TensorValue[] = [];
  const src: number[] = [];
  const dst: number[] = [];
  let offset = 0;
  for (const g of graphs) {
    x.push(...g.x);
    src.push(...g.edgeIndex[0].map((s) => s + offset));
    dst.push(...g.edgeIndex[1].map((d) => d + offset));
    offset += numNodes(g);
  }
  return { x, edgeIndex: [src, dst] };
}
