/**
 * Path Module Runtime Evaluators
 *
 * Runtime implementations for path/* operators (astar, reachable).
 * Grid cells are plain {x,y} integer objects. Deterministic tie-break for parity.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

interface Cell {
  x: number;
  y: number;
}

function asCell(v: unknown): Cell {
  const o = (v ?? {}) as Record<string, unknown>;
  const x = typeof o.x === 'number' ? o.x : 0;
  const y = typeof o.y === 'number' ? o.y : 0;
  return { x, y };
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

// 4-dir N,E,S,W; diagonal appends NE,SE,SW,NW.
const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const DIRS_DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

function neighbors(diagonal: boolean): ReadonlyArray<readonly [number, number]> {
  return diagonal ? [...DIRS4, ...DIRS_DIAG] : DIRS4;
}

function blockedSet(blocked: unknown[]): Set<string> {
  const set = new Set<string>();
  for (const b of blocked) {
    const c = asCell(b);
    set.add(key(c.x, c.y));
  }
  return set;
}

/**
 * path/astar - A* shortest path (start, goal, blocked, w, h, diagonal?) → [{x,y}] | []
 */
export function evalPathAstar(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell[] {
  const start = asCell(evaluate(args[0], ctx));
  const goal = asCell(evaluate(args[1], ctx));
  const blockedArr = (evaluate(args[2], ctx) as unknown[]) ?? [];
  const w = evaluate(args[3], ctx) as number;
  const h = evaluate(args[4], ctx) as number;
  const diagonal = args.length > 5 ? Boolean(evaluate(args[5], ctx)) : false;

  const blocked = blockedSet(blockedArr);
  const dirs = neighbors(diagonal);

  const heuristic = (x: number, y: number): number => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return diagonal ? Math.max(dx, dy) : dx + dy;
  };

  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);

  if (
    start.x < 0 ||
    start.x >= w ||
    start.y < 0 ||
    start.y >= h ||
    goal.x < 0 ||
    goal.x >= w ||
    goal.y < 0 ||
    goal.y >= h ||
    blocked.has(startKey) ||
    blocked.has(goalKey)
  ) {
    return [];
  }

  interface OpenNode {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    order: number;
  }

  const open: OpenNode[] = [];
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  let counter = 0;

  gScore.set(startKey, 0);
  open.push({
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start.x, start.y),
    f: heuristic(start.x, start.y),
    order: counter++,
  });

  while (open.length > 0) {
    // Linear scan for min: lower f, then lower h, then earliest insertion order.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i];
      const b = open[bestIdx];
      if (
        a.f < b.f ||
        (a.f === b.f && a.h < b.h) ||
        (a.f === b.f && a.h === b.h && a.order < b.order)
      ) {
        bestIdx = i;
      }
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);

    const curKey = key(current.x, current.y);

    if (curKey === goalKey) {
      const path: Cell[] = [];
      let k: string | undefined = curKey;
      while (k !== undefined) {
        const parts = k.split(',');
        path.push({ x: Number(parts[0]), y: Number(parts[1]) });
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }

    // Stale entry: a better g was already finalized.
    const recordedG = gScore.get(curKey);
    if (recordedG !== undefined && current.g > recordedG) {
      continue;
    }

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
        continue;
      }
      const nKey = key(nx, ny);
      if (blocked.has(nKey)) {
        continue;
      }
      const tentativeG = current.g + 1;
      const existingG = gScore.get(nKey);
      if (existingG === undefined || tentativeG < existingG) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, curKey);
        const nh = heuristic(nx, ny);
        open.push({
          x: nx,
          y: ny,
          g: tentativeG,
          h: nh,
          f: tentativeG + nh,
          order: counter++,
        });
      }
    }
  }

  return [];
}

/**
 * path/reachable - cells reachable within steps moves (BFS), row-major sorted
 * (start, steps, blocked, w, h, diagonal?) → [{x,y}]
 */
export function evalPathReachable(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell[] {
  const start = asCell(evaluate(args[0], ctx));
  const steps = Math.floor(evaluate(args[1], ctx) as number);
  const blockedArr = (evaluate(args[2], ctx) as unknown[]) ?? [];
  const w = evaluate(args[3], ctx) as number;
  const h = evaluate(args[4], ctx) as number;
  const diagonal = args.length > 5 ? Boolean(evaluate(args[5], ctx)) : false;

  const blocked = blockedSet(blockedArr);
  const dirs = neighbors(diagonal);

  const startKey = key(start.x, start.y);
  const visited = new Set<string>();

  if (
    start.x < 0 ||
    start.x >= w ||
    start.y < 0 ||
    start.y >= h ||
    blocked.has(startKey)
  ) {
    return [];
  }

  visited.add(startKey);
  let frontier: Cell[] = [{ x: start.x, y: start.y }];
  for (let depth = 0; depth < steps; depth++) {
    const next: Cell[] = [];
    for (const cell of frontier) {
      for (const [dx, dy] of dirs) {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
          continue;
        }
        const nKey = key(nx, ny);
        if (blocked.has(nKey) || visited.has(nKey)) {
          continue;
        }
        visited.add(nKey);
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }

  const result: Cell[] = [];
  for (const k of visited) {
    const parts = k.split(',');
    result.push({ x: Number(parts[0]), y: Number(parts[1]) });
  }
  result.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  return result;
}
