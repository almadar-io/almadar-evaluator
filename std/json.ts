/**
 * JSON Module Runtime Evaluators
 *
 * `(json/parse s)` — pure, deterministic: string → parsed value. Invalid JSON
 * or non-string input → null, never throws — guards can branch on null. No
 * reviver, no prototype access, no side effects. `(json/stringify v)` is the
 * inverse: any value → JSON string.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { RuntimeValue } from '@almadar/core';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

/**
 * json/parse - Parse a JSON string; invalid JSON or non-string input returns null
 */
export function evalJsonParse(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): RuntimeValue {
  const val = evaluate(args[0], ctx);
  if (typeof val !== 'string') return null;
  try {
    return JSON.parse(val) as RuntimeValue;
  } catch {
    return null;
  }
}

/**
 * json/stringify - Serialize a value to a JSON string
 */
export function evalJsonStringify(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string | null {
  const val = evaluate(args[0], ctx);
  try {
    const out = JSON.stringify(val);
    return out === undefined ? null : out;
  } catch {
    return null;
  }
}
