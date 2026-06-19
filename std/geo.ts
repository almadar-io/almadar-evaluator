/**
 * Geometry Module Runtime Evaluators
 *
 * Runtime implementations for geo/* operators.
 * Rect = {x,y,w,h} (top-left origin). Circle = {x,y,r}. Point = {x,y}.
 * Segment = {x1,y1,x2,y2}. Vectors are {x,y[,z]}.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

interface Vec {
  x: number;
  y: number;
  z?: number;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Circle {
  x: number;
  y: number;
  r: number;
}
interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function num(o: Record<string, unknown>, k: string): number {
  return typeof o[k] === 'number' ? (o[k] as number) : 0;
}

function asVec(v: unknown): Vec {
  const o = (v ?? {}) as Record<string, unknown>;
  const z = typeof o.z === 'number' ? (o.z as number) : undefined;
  return z === undefined
    ? { x: num(o, 'x'), y: num(o, 'y') }
    : { x: num(o, 'x'), y: num(o, 'y'), z };
}

function asRect(v: unknown): Rect {
  const o = (v ?? {}) as Record<string, unknown>;
  return { x: num(o, 'x'), y: num(o, 'y'), w: num(o, 'w'), h: num(o, 'h') };
}

function asCircle(v: unknown): Circle {
  const o = (v ?? {}) as Record<string, unknown>;
  return { x: num(o, 'x'), y: num(o, 'y'), r: num(o, 'r') };
}

function asSegment(v: unknown): Segment {
  const o = (v ?? {}) as Record<string, unknown>;
  return { x1: num(o, 'x1'), y1: num(o, 'y1'), x2: num(o, 'x2'), y2: num(o, 'y2') };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * geo/aabb-overlap - axis-aligned bounding box overlap → bool
 */
export function evalGeoAabbOverlap(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const a = asRect(evaluate(args[0], ctx));
  const b = asRect(evaluate(args[1], ctx));
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * geo/circle-overlap - distance(centers) <= a.r + b.r → bool
 */
export function evalGeoCircleOverlap(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const a = asCircle(evaluate(args[0], ctx));
  const b = asCircle(evaluate(args[1], ctx));
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) <= a.r + b.r;
}

/**
 * geo/rect-circle-overlap - closest point on rect to circle center → bool
 */
export function evalGeoRectCircleOverlap(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const r = asRect(evaluate(args[0], ctx));
  const c = asCircle(evaluate(args[1], ctx));
  const cx = clamp(c.x, r.x, r.x + r.w);
  const cy = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - cx,
    dy = c.y - cy;
  return dx * dx + dy * dy <= c.r * c.r;
}

/**
 * geo/point-in-rect - point inside rect (inclusive edges) → bool
 */
export function evalGeoPointInRect(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const p = asVec(evaluate(args[0], ctx));
  const r = asRect(evaluate(args[1], ctx));
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/**
 * geo/point-in-circle - point inside circle (inclusive) → bool
 */
export function evalGeoPointInCircle(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const p = asVec(evaluate(args[0], ctx));
  const c = asCircle(evaluate(args[1], ctx));
  const dx = p.x - c.x,
    dy = p.y - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
}

/**
 * geo/reflect - reflect v about normal n (n assumed normalized) → vector
 */
export function evalGeoReflect(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const v = asVec(evaluate(args[0], ctx));
  const n = asVec(evaluate(args[1], ctx));
  const is3d = v.z !== undefined;
  const vz = v.z ?? 0,
    nz = n.z ?? 0;
  const d = v.x * n.x + v.y * n.y + vz * nz;
  const rx = v.x - n.x * 2 * d;
  const ry = v.y - n.y * 2 * d;
  const rz = vz - nz * 2 * d;
  return is3d ? { x: rx, y: ry, z: rz } : { x: rx, y: ry };
}

/**
 * geo/segment-intersect - 2-segment intersection → {x,y} point or null
 */
export function evalGeoSegmentIntersect(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Vec | null {
  const s1 = asSegment(evaluate(args[0], ctx));
  const s2 = asSegment(evaluate(args[1], ctx));
  const r_x = s1.x2 - s1.x1,
    r_y = s1.y2 - s1.y1;
  const s_x = s2.x2 - s2.x1,
    s_y = s2.y2 - s2.y1;
  const denom = r_x * s_y - r_y * s_x;
  if (denom === 0) {
    return null; // parallel / collinear
  }
  const qpx = s2.x1 - s1.x1,
    qpy = s2.y1 - s1.y1;
  const t = (qpx * s_y - qpy * s_x) / denom;
  const u = (qpx * r_y - qpy * r_x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }
  return { x: s1.x1 + t * r_x, y: s1.y1 + t * r_y };
}
