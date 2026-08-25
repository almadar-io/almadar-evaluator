/**
 * Logic Operator Implementations
 *
 * Implements: and, or, not, if
 * All logic operators support short-circuit evaluation.
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext, Evaluator } from '../context.js';
import type { RuntimeValue } from '@almadar/core';

/**
 * Evaluate logical AND: ["and", a, b, ...]
 * Operand semantics (matches JS `&&` and the compiled TS path — Phase 5,
 * R-OR-AND-RETURN-BOOLEAN): returns the first falsy argument's VALUE, or the
 * last argument's value if all are truthy. Short-circuits — does not evaluate
 * past the first falsy. (When every operand is boolean — the case for all
 * shipping behaviors — this is observationally identical to returning a
 * boolean.)
 */
export function evalAnd(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): RuntimeValue {
  let last: RuntimeValue = true;
  for (const arg of args) {
    last = evaluate(arg, ctx);
    if (!toBoolean(last)) {
      return last;
    }
  }
  return last;
}

/**
 * Evaluate logical OR: ["or", a, b, ...]
 * Operand semantics (matches JS `||` and the compiled TS path — Phase 5,
 * R-OR-AND-RETURN-BOOLEAN): returns the first truthy argument's VALUE, or the
 * last argument's value if all are falsy. Short-circuits — does not evaluate
 * past the first truthy.
 */
export function evalOr(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): RuntimeValue {
  let last: RuntimeValue = false;
  for (const arg of args) {
    last = evaluate(arg, ctx);
    if (toBoolean(last)) {
      return last;
    }
  }
  return last;
}

/**
 * Evaluate logical NOT: ["not", a]
 */
export function evalNot(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): boolean {
  return !toBoolean(evaluate(args[0], ctx));
}

/**
 * Evaluate conditional: ["if", condition, then, else]
 * Only evaluates the branch that matches the condition.
 */
export function evalIf(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): RuntimeValue {
  const condition = toBoolean(evaluate(args[0], ctx));
  if (condition) {
    return evaluate(args[1], ctx);
  }
  return evaluate(args[2], ctx);
}

/**
 * Convert a value to boolean.
 * Follows JavaScript truthy/falsy semantics:
 * - false, 0, '', null, undefined, NaN are falsy
 * - Everything else is truthy
 */
function toBoolean(value: RuntimeValue): boolean {
  return Boolean(value);
}
