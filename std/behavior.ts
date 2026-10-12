/**
 * Behavior values and quasiquote on the interpreted path (language trio,
 * `docs/Almadar_Studio_Behavior.md`). Twins of orbital-core `behavior/apply`
 * and `QuasiquoteOp`; the value shapes and merge rules live in `@almadar/core`.
 *
 * @packageDocumentation
 */

import {
  BehaviorRefSchema,
  BehaviorValueSchema,
  applyBehaviorRefOverrides,
  JsonValueSchema,
  applyBehaviorOverrides,
  behaviorRef,
  instantiateQuasiquote,
  toProgramData,
  type RuntimeValue,
  type SExpr,
} from '@almadar/core';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => RuntimeValue;

/** behavior/apply — record overrides on a behavior value: §8 call-site overrides on a trait value, the §8b import body on an orbital value, the bridge on a whole behavior value. */
export function evalBehaviorApply(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): RuntimeValue {
  const target = evaluate(args[0], ctx);
  const whole = BehaviorRefSchema.safeParse(target);
  const value = BehaviorValueSchema.safeParse(target);
  if (!whole.success && !value.success) {
    throw new Error('behavior/apply: the first argument must be a behavior value ({ behavior, trait }, { behavior, orbital } or { behavior })');
  }
  const overrides = JsonValueSchema.safeParse(evaluate(args[1], ctx));
  if (!overrides.success) {
    throw new Error(`behavior/apply: the overrides must be plain data: ${overrides.error.message}`);
  }
  try {
    if (whole.success) return applyBehaviorRefOverrides(whole.data, overrides.data);
    if (!value.success) throw new Error('not a behavior value');
    return applyBehaviorOverrides(value.data, overrides.data);
  } catch (error) {
    throw new Error(`behavior/apply: overrides do not fit this kind of value: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** behavior/ref — a whole behavior as a value, from its specifier. */
export function evalBehaviorRef(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): RuntimeValue {
  const specifier = evaluate(args[0], ctx);
  if (typeof specifier !== 'string') throw new Error('behavior/ref: the specifier must be a string');
  return behaviorRef(specifier);
}

/** (quasiquote x) — the template with each hole's value spliced in. */
export function evalQuasiquote(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): RuntimeValue {
  const [body, ...holes] = args;
  if (typeof body !== 'string') throw new Error('quasiquote: expected an encoded template body (string)');
  return instantiateQuasiquote(body, holes.map((h) => toProgramData(evaluate(h, ctx))));
}

/** (unquote e) outside a quasiquote template — the parser and validator reject it; reaching here means a malformed program. */
export function evalUnquote(): RuntimeValue {
  throw new Error('unquote: legal only inside (quasiquote …)');
}
