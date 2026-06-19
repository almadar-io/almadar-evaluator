/**
 * Easing Module Runtime Evaluators
 *
 * Runtime implementations for ease/* operators.
 * All formulas are pinned (standard Penner) and must match the Rust impl
 * byte-for-byte. Unknown curve → linear.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

function clamp01(t: number): number {
  return Math.min(Math.max(t, 0), 1);
}

function applyCurve(curve: string, tRaw: number): number {
  const t = clamp01(tRaw);
  switch (curve) {
    case 'in-quad':
      return t * t;
    case 'out-quad':
      return t * (2 - t);
    case 'in-out-quad':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'in-cubic':
      return t * t * t;
    case 'out-cubic': {
      const u = t - 1;
      return u * u * u + 1;
    }
    case 'in-out-cubic':
      return t < 0.5
        ? 4 * t * t * t
        : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    case 'elastic-out': {
      if (t === 0) {
        return 0;
      }
      if (t === 1) {
        return 1;
      }
      const c4 = (2 * Math.PI) / 3;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'bounce-out': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let u = t;
      if (u < 1 / d1) {
        return n1 * u * u;
      } else if (u < 2 / d1) {
        u -= 1.5 / d1;
        return n1 * u * u + 0.75;
      } else if (u < 2.5 / d1) {
        u -= 2.25 / d1;
        return n1 * u * u + 0.9375;
      } else {
        u -= 2.625 / d1;
        return n1 * u * u + 0.984375;
      }
    }
    case 'linear':
    default:
      return t;
  }
}

/**
 * ease/apply - apply a named easing curve to t∈[0,1] (clamped)
 */
export function evalEaseApply(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number {
  const curve = evaluate(args[0], ctx) as string;
  const t = evaluate(args[1], ctx) as number;
  return applyCurve(curve, t);
}

/**
 * ease/smoothstep - t=clamp((x-edge0)/(edge1-edge0),0,1); t*t*(3-2*t)
 */
export function evalEaseSmoothstep(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const edge0 = evaluate(args[0], ctx) as number;
  const edge1 = evaluate(args[1], ctx) as number;
  const x = evaluate(args[2], ctx) as number;
  if (edge0 === edge1) {
    return 0;
  }
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
