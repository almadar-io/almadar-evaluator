/**
 * Vector Module Runtime Evaluators
 *
 * Runtime implementations for vec/* operators.
 * Vectors are plain objects {x,y} or {x,y,z}. Dimensionality of a vector
 * result follows the FIRST vector argument (z included only if first arg had z).
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

function asVec(v: unknown): Vec {
  const o = (v ?? {}) as Record<string, unknown>;
  const x = typeof o.x === 'number' ? o.x : 0;
  const y = typeof o.y === 'number' ? o.y : 0;
  const z = typeof o.z === 'number' ? o.z : undefined;
  return z === undefined ? { x, y } : { x, y, z };
}

function has3(v: Vec): boolean {
  return v.z !== undefined;
}

function z(v: Vec): number {
  return v.z ?? 0;
}

function make(x: number, y: number, zVal: number, is3d: boolean): Vec {
  return is3d ? { x, y, z: zVal } : { x, y };
}

/**
 * vec/add - componentwise a + b (dim follows a)
 */
export function evalVecAdd(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  return make(a.x + b.x, a.y + b.y, z(a) + z(b), has3(a));
}

/**
 * vec/sub - componentwise a - b (dim follows a)
 */
export function evalVecSub(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  return make(a.x - b.x, a.y - b.y, z(a) - z(b), has3(a));
}

/**
 * vec/scale - componentwise a * k (dim follows a)
 */
export function evalVecScale(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const k = evaluate(args[1], ctx) as number;
  return make(a.x * k, a.y * k, z(a) * k, has3(a));
}

/**
 * vec/dot - dot product → number
 */
export function evalVecDot(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  return a.x * b.x + a.y * b.y + z(a) * z(b);
}

/**
 * vec/cross - 3D → {x,y,z} cross; 2D → number (ax·by - ay·bx)
 */
export function evalVecCross(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Vec | number {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  if (has3(a)) {
    const ax = a.x,
      ay = a.y,
      az = z(a);
    const bx = b.x,
      by = b.y,
      bz = z(b);
    return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
  }
  return a.x * b.y - a.y * b.x;
}

/**
 * vec/length - magnitude
 */
export function evalVecLength(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  const a = asVec(evaluate(args[0], ctx));
  return Math.sqrt(a.x * a.x + a.y * a.y + z(a) * z(a));
}

/**
 * vec/length-sq - squared magnitude
 */
export function evalVecLengthSq(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  const a = asVec(evaluate(args[0], ctx));
  return a.x * a.x + a.y * a.y + z(a) * z(a);
}

/**
 * vec/normalize - unit vector; zero-length → zero vector (same dim)
 */
export function evalVecNormalize(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const len = Math.sqrt(a.x * a.x + a.y * a.y + z(a) * z(a));
  if (len === 0) {
    return make(0, 0, 0, has3(a));
  }
  return make(a.x / len, a.y / len, z(a) / len, has3(a));
}

/**
 * vec/distance - length(sub(a,b))
 */
export function evalVecDistance(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  const dx = a.x - b.x,
    dy = a.y - b.y,
    dz = z(a) - z(b);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * vec/distance-sq - length-sq(sub(a,b))
 */
export function evalVecDistanceSq(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  const dx = a.x - b.x,
    dy = a.y - b.y,
    dz = z(a) - z(b);
  return dx * dx + dy * dy + dz * dz;
}

/**
 * vec/lerp - componentwise a + (b - a) * t (dim follows a)
 */
export function evalVecLerp(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const b = asVec(evaluate(args[1], ctx));
  const t = evaluate(args[2], ctx) as number;
  return make(
    a.x + (b.x - a.x) * t,
    a.y + (b.y - a.y) * t,
    z(a) + (z(b) - z(a)) * t,
    has3(a)
  );
}

/**
 * vec/angle - 1 arg: atan2(a.y,a.x); 2 args: angle between vectors
 */
export function evalVecAngle(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  const a = asVec(evaluate(args[0], ctx));
  if (args.length < 2) {
    return Math.atan2(a.y, a.x);
  }
  const b = asVec(evaluate(args[1], ctx));
  const la = Math.sqrt(a.x * a.x + a.y * a.y + z(a) * z(a));
  const lb = Math.sqrt(b.x * b.x + b.y * b.y + z(b) * z(b));
  if (la === 0 || lb === 0) {
    return 0;
  }
  const d = (a.x * b.x + a.y * b.y + z(a) * z(b)) / (la * lb);
  const clamped = Math.min(Math.max(d, -1), 1);
  return Math.acos(clamped);
}

/**
 * vec/rotate - 2D rotate x,y by rad; z preserved
 */
export function evalVecRotate(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const rad = evaluate(args[1], ctx) as number;
  const c = Math.cos(rad),
    s = Math.sin(rad);
  return make(a.x * c - a.y * s, a.x * s + a.y * c, z(a), has3(a));
}

/**
 * vec/clamp-length - if length > max → scale(normalize(a),max) else a
 */
export function evalVecClampLength(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Vec {
  const a = asVec(evaluate(args[0], ctx));
  const max = evaluate(args[1], ctx) as number;
  const len = Math.sqrt(a.x * a.x + a.y * a.y + z(a) * z(a));
  if (len > max) {
    if (len === 0) {
      return make(0, 0, 0, has3(a));
    }
    const k = max / len;
    return make(a.x * k, a.y * k, z(a) * k, has3(a));
  }
  return make(a.x, a.y, z(a), has3(a));
}
