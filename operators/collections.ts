/**
 * Collection Operator Implementations
 *
 * Implements: map, filter, find, count, sum, first, last, nth, concat, includes, empty
 *
 * These short-form operators (map, filter, find) use @item/@index bindings,
 * matching the Rust evaluator's approach.
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import { createChildContext } from '../context.js';

type Evaluator = (expr: SExpr, ctx: EvaluationContext) => unknown;

function withItem(
  expr: SExpr,
  evaluate: Evaluator,
  ctx: EvaluationContext,
  item: unknown,
  index: number
): unknown {
  const locals = new Map<string, unknown>();
  locals.set('item', item);
  locals.set('index', index);
  return evaluate(expr, createChildContext(ctx, locals));
}

/**
 * Evaluate map: ["map", collection, expr_using_@item]
 */
export function evalMap(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown[] {
  const collection = toArray(evaluate(args[0], ctx));
  const mapExpr = args[1];
  return collection.map((item, i) => withItem(mapExpr, evaluate, ctx, item, i));
}

/**
 * Evaluate filter: ["filter", collection, expr_using_@item]
 */
export function evalFilter(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown[] {
  const collection = toArray(evaluate(args[0], ctx));
  const predExpr = args[1];
  return collection.filter((item, i) => Boolean(withItem(predExpr, evaluate, ctx, item, i)));
}

/**
 * Evaluate find: ["find", collection, expr_using_@item]
 */
export function evalFind(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown {
  const collection = toArray(evaluate(args[0], ctx));
  const predExpr = args[1];
  return collection.find((item, i) => Boolean(withItem(predExpr, evaluate, ctx, item, i)));
}

/**
 * Evaluate count: ["count", collection]
 */
export function evalCount(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): number {
  const collection = toArray(evaluate(args[0], ctx));
  return collection.length;
}

/**
 * Evaluate sum: ["sum", collection] or ["sum", collection, mapExpr_using_@item]
 */
export function evalSum(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): number {
  const collection = toArray(evaluate(args[0], ctx));

  if (args.length === 1) {
    return collection.reduce((sum: number, item) => sum + toNumber(item), 0);
  }

  const mapExpr = args[1];
  return collection.reduce((sum: number, item, i) => {
    const locals = new Map<string, unknown>();
    locals.set('item', item);
    locals.set('index', i);
    const childCtx = createChildContext(ctx, locals);
    return sum + toNumber(evaluate(mapExpr, childCtx));
  }, 0);
}

/**
 * Evaluate first: ["first", collection]
 */
export function evalFirst(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown {
  const collection = toArray(evaluate(args[0], ctx));
  return collection.length > 0 ? collection[0] : undefined;
}

/**
 * Evaluate last: ["last", collection]
 */
export function evalLast(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown {
  const collection = toArray(evaluate(args[0], ctx));
  return collection.length > 0 ? collection[collection.length - 1] : undefined;
}

/**
 * Evaluate nth: ["nth", collection, index]
 */
export function evalNth(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown {
  const collection = toArray(evaluate(args[0], ctx));
  const index = toNumber(evaluate(args[1], ctx));
  return collection[index];
}

/**
 * Evaluate concat: ["concat", collection1, collection2, ...]
 */
export function evalConcat(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): unknown[] {
  const result: unknown[] = [];
  for (const arg of args) {
    const collection = toArray(evaluate(arg, ctx));
    result.push(...collection);
  }
  return result;
}

/**
 * Evaluate includes: ["includes", collection, element]
 */
export function evalIncludes(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): boolean {
  const collection = toArray(evaluate(args[0], ctx));
  const element = evaluate(args[1], ctx);
  return collection.includes(element);
}

/**
 * Evaluate empty: ["empty", collection]
 */
export function evalEmpty(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): boolean {
  const collection = toArray(evaluate(args[0], ctx));
  return collection.length === 0;
}

/**
 * Convert a value to an array.
 */
function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

/**
 * Convert a value to a number.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}
