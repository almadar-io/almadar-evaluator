/**
 * Control Operator Implementations
 *
 * Implements: let, do, when, fn
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import { createChildContext } from '../context.js';

type Evaluator = (expr: SExpr, ctx: EvaluationContext) => unknown;

/**
 * Evaluate let binding.
 * Supports two formats:
 *   - Array of pairs: ["let", [["x", 10], ["y", 20]], body]
 *   - Object style:   ["let", {"x": 10, "y": 20}, body]
 *
 * Sequential (`let*`) semantics: each binding's value expression can
 * reference any EARLIER binding in the same `let` via `@<name>` — matches
 * `@almadar/runtime`'s `EffectExecutor` `let` case (its own, independent
 * implementation, which already threads bindings this way) and how `.lolo`
 * is authored in practice: multi-step chains where a later step's formula
 * builds on an earlier one (e.g. std-evade-chase's `chase` tick computing
 * `nc2x` from `nc1x`). Evaluating every binding against the original,
 * unmodified `ctx` (the prior behavior here) left every cross-binding
 * reference unresolved (`undefined`), silently corrupting any `let` with
 * dependent bindings.
 */
export function evalLet(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown {
  const rawBindings = args[0];
  const body = args[1];

  // Build binding pairs from either array-of-pairs or object format
  const bindingPairs: Array<[string, SExpr]> = Array.isArray(rawBindings)
    ? (rawBindings as SExpr[][]).map(b => [b[0] as string, b[1]])
    : Object.entries(rawBindings as Record<string, SExpr>);

  // Evaluate each binding against the locals accumulated so far, then fold
  // it in before evaluating the next one.
  const locals = new Map<string, unknown>();
  let childCtx = ctx;
  for (const [name, valueExpr] of bindingPairs) {
    const value = evaluate(valueExpr, childCtx);
    locals.set(name, value);
    childCtx = createChildContext(ctx, locals);
  }

  // Evaluate body with the fully-accumulated context (childCtx === ctx,
  // unchanged, when there are no bindings).
  return evaluate(body, childCtx);
}

/**
 * Evaluate do block: ["do", expr1, expr2, ...]
 * Executes expressions in sequence, returns last result.
 */
export function evalDo(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown {
  let result: unknown = undefined;
  for (const expr of args) {
    result = evaluate(expr, ctx);
  }
  return result;
}

/**
 * Evaluate when: ["when", condition, effect]
 * Executes effect only when condition is truthy.
 */
export function evalWhen(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const condition = evaluate(args[0], ctx);
  if (Boolean(condition)) {
    evaluate(args[1], ctx);
  }
}

/**
 * Evaluate lambda: ["fn", varName, body] or ["fn", [vars], body]
 * Creates a function that can be passed to collection operators.
 */
export function evalFn(
  args: SExpr[],
  _evaluate: Evaluator,
  _ctx: EvaluationContext
): (item: unknown, evaluate: Evaluator, ctx: EvaluationContext) => unknown {
  const params = args[0];
  const body = args[1];

  // Return a closure that can be called with an item
  return (item: unknown, evaluate: Evaluator, ctx: EvaluationContext) => {
    const locals = new Map<string, unknown>();

    // Handle single variable or array of variables
    if (typeof params === 'string') {
      locals.set(params, item);
    } else if (Array.isArray(params)) {
      const itemArray = Array.isArray(item) ? item : [item];
      for (let i = 0; i < params.length; i++) {
        locals.set(params[i] as string, itemArray[i]);
      }
    }

    const childCtx = createChildContext(ctx, locals);
    return evaluate(body, childCtx);
  };
}
