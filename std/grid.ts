/**
 * Grid Module Runtime Evaluators
 *
 * Runtime implementations for grid/* operators.
 * Cell = {x,y} integers. Point = {x,y}. Cell arrays are emitted in the
 * exact deterministic order specified (parity depends on it).
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

function num(o: Record<string, unknown>, k: string): number {
  return typeof o[k] === 'number' ? (o[k] as number) : 0;
}

function asCell(v: unknown): Cell {
  const o = (v ?? {}) as Record<string, unknown>;
  return { x: num(o, 'x'), y: num(o, 'y') };
}

/**
 * grid/to-world - cell center: {x:(cell.x+0.5)*cellSize, y:(cell.y+0.5)*cellSize}
 */
export function evalGridToWorld(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Cell {
  const cell = asCell(evaluate(args[0], ctx));
  const cellSize = evaluate(args[1], ctx) as number;
  return { x: (cell.x + 0.5) * cellSize, y: (cell.y + 0.5) * cellSize };
}

/**
 * grid/from-world - {x:floor(point.x/cellSize), y:floor(point.y/cellSize)}
 */
export function evalGridFromWorld(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell {
  const point = asCell(evaluate(args[0], ctx));
  const cellSize = evaluate(args[1], ctx) as number;
  return { x: Math.floor(point.x / cellSize), y: Math.floor(point.y / cellSize) };
}

/**
 * grid/iso-to-screen - {x:(cell.x-cell.y)*tileW/2, y:(cell.x+cell.y)*tileH/2}
 */
export function evalGridIsoToScreen(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell {
  const cell = asCell(evaluate(args[0], ctx));
  const tileW = evaluate(args[1], ctx) as number;
  const tileH = evaluate(args[2], ctx) as number;
  return { x: ((cell.x - cell.y) * tileW) / 2, y: ((cell.x + cell.y) * tileH) / 2 };
}

/**
 * grid/screen-to-iso - inverse iso projection
 */
export function evalGridScreenToIso(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell {
  const point = asCell(evaluate(args[0], ctx));
  const tileW = evaluate(args[1], ctx) as number;
  const tileH = evaluate(args[2], ctx) as number;
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  return {
    x: (point.x / halfW + point.y / halfH) / 2,
    y: (point.y / halfH - point.x / halfW) / 2,
  };
}

/**
 * grid/distance - Chebyshev: max(|dx|,|dy|)
 */
export function evalGridDistance(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = asCell(evaluate(args[0], ctx));
  const b = asCell(evaluate(args[1], ctx));
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * grid/manhattan-distance - |dx| + |dy|
 */
export function evalGridManhattanDistance(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = asCell(evaluate(args[0], ctx));
  const b = asCell(evaluate(args[1], ctx));
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * grid/neighbors - 4-neighborhood N,E,S,W; if diagonal append NE,SE,SW,NW
 */
export function evalGridNeighbors(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell[] {
  const cell = asCell(evaluate(args[0], ctx));
  const diagonal = args.length > 1 ? Boolean(evaluate(args[1], ctx)) : false;
  const result: Cell[] = [
    { x: cell.x, y: cell.y - 1 }, // N
    { x: cell.x + 1, y: cell.y }, // E
    { x: cell.x, y: cell.y + 1 }, // S
    { x: cell.x - 1, y: cell.y }, // W
  ];
  if (diagonal) {
    result.push(
      { x: cell.x + 1, y: cell.y - 1 }, // NE
      { x: cell.x + 1, y: cell.y + 1 }, // SE
      { x: cell.x - 1, y: cell.y + 1 }, // SW
      { x: cell.x - 1, y: cell.y - 1 } // NW
    );
  }
  return result;
}

/**
 * grid/cells-in-radius - all cells with dx²+dy² <= r², row-major (y outer, x inner)
 */
export function evalGridCellsInRadius(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Cell[] {
  const cell = asCell(evaluate(args[0], ctx));
  const r = evaluate(args[1], ctx) as number;
  const rf = Math.floor(r);
  const r2 = r * r;
  const result: Cell[] = [];
  for (let dy = -rf; dy <= rf; dy++) {
    for (let dx = -rf; dx <= rf; dx++) {
      if (dx * dx + dy * dy <= r2) {
        result.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
  }
  return result;
}

/**
 * grid/line - Bresenham, inclusive a..b, in step order → array of {x,y}
 */
export function evalGridLine(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Cell[] {
  const a = asCell(evaluate(args[0], ctx));
  const b = asCell(evaluate(args[1], ctx));
  let x0 = a.x,
    y0 = a.y;
  const x1 = b.x,
    y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const result: Cell[] = [];
  for (;;) {
    result.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) {
      break;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return result;
}

/**
 * grid/in-bounds - cell.x>=0 && cell.x<w && cell.y>=0 && cell.y<h → bool
 */
export function evalGridInBounds(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const cell = asCell(evaluate(args[0], ctx));
  const w = evaluate(args[1], ctx) as number;
  const h = evaluate(args[2], ctx) as number;
  return cell.x >= 0 && cell.x < w && cell.y >= 0 && cell.y < h;
}
