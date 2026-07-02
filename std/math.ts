/**
 * Math Module Runtime Evaluators
 *
 * Runtime implementations for math/* operators.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

/**
 * math/abs - Absolute value
 */
export function evalMathAbs(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  return Math.abs(n);
}

/**
 * math/min - Minimum of values
 */
export function evalMathMin(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const values = args.map((a) => evaluate(a, ctx) as number);
  return Math.min(...values);
}

/**
 * math/max - Maximum of values
 */
export function evalMathMax(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const values = args.map((a) => evaluate(a, ctx) as number);
  return Math.max(...values);
}

/**
 * math/clamp - Constrain value to range [min, max]
 */
export function evalMathClamp(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  const min = evaluate(args[1], ctx) as number;
  const max = evaluate(args[2], ctx) as number;
  return Math.min(Math.max(n, min), max);
}

/**
 * math/floor - Round down to integer
 */
export function evalMathFloor(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  return Math.floor(n);
}

/**
 * math/ceil - Round up to integer
 */
export function evalMathCeil(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  return Math.ceil(n);
}

/**
 * math/round - Round to nearest integer or specified decimals
 */
export function evalMathRound(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  const decimals = args.length > 1 ? (evaluate(args[1], ctx) as number) : 0;
  if (decimals === 0) {
    return Math.round(n);
  }
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

/**
 * math/pow - Exponentiation (base^exp)
 */
export function evalMathPow(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const base = evaluate(args[0], ctx) as number;
  const exp = evaluate(args[1], ctx) as number;
  return Math.pow(base, exp);
}

/**
 * math/sqrt - Square root
 */
export function evalMathSqrt(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  return Math.sqrt(n);
}

/**
 * math/mod - Modulo (remainder)
 */
export function evalMathMod(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  return a % b;
}

/**
 * math/sign - Returns -1, 0, or 1 indicating sign
 */
export function evalMathSign(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  return Math.sign(n);
}

/**
 * math/lerp - Linear interpolation between a and b by factor t
 */
export function evalMathLerp(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  const t = evaluate(args[2], ctx) as number;
  return a + (b - a) * t;
}

/**
 * math/map - Map value from one range to another
 */
export function evalMathMap(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx) as number;
  const inMin = evaluate(args[1], ctx) as number;
  const inMax = evaluate(args[2], ctx) as number;
  const outMin = evaluate(args[3], ctx) as number;
  const outMax = evaluate(args[4], ctx) as number;
  return ((n - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * math/random - Random number between 0 (inclusive) and 1 (exclusive)
 */
export function evalMathRandom(): number {
  return Math.random();
}

/**
 * math/randomInt - Random integer in range [min, max] (inclusive)
 */
export function evalMathRandomInt(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const min = evaluate(args[0], ctx) as number;
  const max = evaluate(args[1], ctx) as number;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * math/default - Return default if value is null, undefined, or NaN
 */
export function evalMathDefault(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const n = evaluate(args[0], ctx);
  const defaultValue = evaluate(args[1], ctx) as number;
  if (n === null || n === undefined || (typeof n === 'number' && isNaN(n))) {
    return defaultValue;
  }
  return n as number;
}

/**
 * math/sin - sine of radians
 */
export function evalMathSin(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return Math.sin(evaluate(args[0], ctx) as number);
}

/**
 * math/cos - cosine of radians
 */
export function evalMathCos(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return Math.cos(evaluate(args[0], ctx) as number);
}

/**
 * math/tan - tangent of radians
 */
export function evalMathTan(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return Math.tan(evaluate(args[0], ctx) as number);
}

/**
 * math/asin - arcsine (inverse sine) in radians
 */
export function evalMathAsin(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return Math.asin(evaluate(args[0], ctx) as number);
}

/**
 * math/acos - arccosine (inverse cosine) in radians
 */
export function evalMathAcos(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return Math.acos(evaluate(args[0], ctx) as number);
}

/**
 * math/atan - arctangent (inverse tangent) in radians
 */
export function evalMathAtan(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return Math.atan(evaluate(args[0], ctx) as number);
}

/**
 * math/atan2 - atan2(y, x) in radians
 */
export function evalMathAtan2(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const y = evaluate(args[0], ctx) as number;
  const x = evaluate(args[1], ctx) as number;
  return Math.atan2(y, x);
}

/**
 * math/hypot - sqrt(a² + b²)
 */
export function evalMathHypot(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  return Math.hypot(a, b);
}

/**
 * math/deg-rad - degrees → radians (deg·π/180)
 */
export function evalMathDegRad(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return (evaluate(args[0], ctx) as number) * (Math.PI / 180);
}

/**
 * math/rad-deg - radians → degrees (rad·180/π)
 */
export function evalMathRadDeg(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  return (evaluate(args[0], ctx) as number) * (180 / Math.PI);
}

/**
 * math/wrap - wrap v into [min, max); r<=0 → min
 */
export function evalMathWrap(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const v = evaluate(args[0], ctx) as number;
  const min = evaluate(args[1], ctx) as number;
  const max = evaluate(args[2], ctx) as number;
  const r = max - min;
  if (r <= 0) {
    return min;
  }
  return min + ((((v - min) % r) + r) % r);
}

/**
 * math/approach - move cur toward target by at most maxD
 */
export function evalMathApproach(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const cur = evaluate(args[0], ctx) as number;
  const target = evaluate(args[1], ctx) as number;
  const maxD = evaluate(args[2], ctx) as number;
  if (Math.abs(target - cur) <= maxD) {
    return target;
  }
  return cur + Math.sign(target - cur) * maxD;
}
