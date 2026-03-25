/**
 * Array Module Runtime Evaluators
 *
 * Runtime implementations for array/* operators.
 * Supports lambda expressions for predicates and transformations.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import { createChildContext } from '../context.js';
import { isSExpr, getOperator, getArgs } from '../types/expression.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

/**
 * Evaluate an expression with @item and @index bound in context.
 * This matches the Rust evaluator's approach for map/filter/find/some/every.
 *
 * Supports two lambda styles:
 *   - Implicit: ["array/map", arr, ["*", "@item", 2]]  (uses @item/@index)
 *   - Explicit: ["array/map", arr, ["fn", "x", ["*", "@x", 2]]]  (named param)
 *
 * When the expression is ["fn", param, body], the param name is bound to the
 * item value and the body is evaluated directly (avoiding dispatch which would
 * return a closure instead of applying it).
 */
function evalWithItem(
  expr: SExpr,
  evaluate: EvalFn,
  ctx: EvaluationContext,
  item: unknown,
  index: number
): unknown {
  const locals = new Map<string, unknown>();
  locals.set('item', item);
  locals.set('index', index);

  // Handle fn/lambda structurally: bind named param(s) to item/index
  if (isSExpr(expr)) {
    const op = getOperator(expr);
    if (op === 'fn' || op === 'lambda') {
      const fnArgs = getArgs(expr);
      const params = fnArgs[0];
      const body = fnArgs[1];

      if (typeof params === 'string') {
        const key = params.startsWith('@') ? params.slice(1) : params;
        locals.set(key, item);
      } else if (Array.isArray(params)) {
        const paramNames = params as string[];
        const values = [item, index];
        for (let i = 0; i < paramNames.length; i++) {
          const p = paramNames[i] as string;
          const key = p.startsWith('@') ? p.slice(1) : p;
          locals.set(key, values[i]);
        }
      }

      const childCtx = createChildContext(ctx, locals);
      return evaluate(body as SExpr, childCtx);
    }
  }

  const childCtx = createChildContext(ctx, locals);
  return evaluate(expr, childCtx);
}

/**
 * Evaluate a reducer lambda with named params bound in context.
 * Used by array/reduce: ["fn", ["acc", "x"], body]
 * Binds each named param to the corresponding value.
 */
function evalReduceLambda(
  lambdaExpr: SExpr,
  evaluate: EvalFn,
  ctx: EvaluationContext,
  acc: unknown,
  item: unknown
): unknown {
  const locals = new Map<string, unknown>();

  if (isSExpr(lambdaExpr) && getOperator(lambdaExpr) === 'fn') {
    const fnArgs = getArgs(lambdaExpr);
    const params = fnArgs[0];
    const body = fnArgs[1];

    if (Array.isArray(params)) {
      const paramNames = params as string[];
      const values = [acc, item];
      paramNames.forEach((p, i) => {
        const key = (p as string).startsWith('@') ? (p as string).slice(1) : (p as string);
        locals.set(key, values[i]);
      });
    } else if (typeof params === 'string') {
      const key = params.startsWith('@') ? params.slice(1) : params;
      locals.set(key, acc);
    }

    const childCtx = createChildContext(ctx, locals);
    return evaluate(body as SExpr, childCtx);
  }

  // Fallback: evaluate expression with acc/item bound as @item/@index
  locals.set('acc', acc);
  locals.set('item', item);
  const childCtx = createChildContext(ctx, locals);
  return evaluate(lambdaExpr, childCtx);
}

/**
 * array/len - Array length
 */
export function evalArrayLen(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  return arr?.length ?? 0;
}

/**
 * array/empty? - Check if array is empty
 */
export function evalArrayEmpty(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const arr = evaluate(args[0], ctx) as unknown[];
  return !arr || arr.length === 0;
}

/**
 * array/first - Get first element
 */
export function evalArrayFirst(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  const arr = evaluate(args[0], ctx) as unknown[];
  return arr?.[0];
}

/**
 * array/last - Get last element
 */
export function evalArrayLast(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  const arr = evaluate(args[0], ctx) as unknown[];
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[arr.length - 1];
}

/**
 * array/nth - Get element at index
 */
export function evalArrayNth(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  const arr = evaluate(args[0], ctx) as unknown[];
  const index = evaluate(args[1], ctx) as number;
  return arr?.[index];
}

/**
 * array/slice - Extract subarray
 */
export function evalArraySlice(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const start = evaluate(args[1], ctx) as number;
  const end = args.length > 2 ? (evaluate(args[2], ctx) as number) : undefined;
  return arr?.slice(start, end) ?? [];
}

/**
 * array/concat - Concatenate arrays
 */
export function evalArrayConcat(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arrays = args.map((a) => evaluate(a, ctx) as unknown[]);
  return arrays.reduce((acc, arr) => acc.concat(arr ?? []), [] as unknown[]);
}

/**
 * array/append - Add item to end (returns new array)
 */
export function evalArrayAppend(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const item = evaluate(args[1], ctx);
  return [...(arr ?? []), item];
}

/**
 * array/prepend - Add item to start (returns new array)
 */
export function evalArrayPrepend(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const item = evaluate(args[1], ctx);
  return [item, ...(arr ?? [])];
}

/**
 * array/insert - Insert item at index (returns new array)
 */
export function evalArrayInsert(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const index = evaluate(args[1], ctx) as number;
  const item = evaluate(args[2], ctx);
  const result = [...(arr ?? [])];
  result.splice(index, 0, item);
  return result;
}

/**
 * array/remove - Remove item at index (returns new array)
 */
export function evalArrayRemove(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const index = evaluate(args[1], ctx) as number;
  const result = [...(arr ?? [])];
  result.splice(index, 1);
  return result;
}

/**
 * array/removeItem - Remove first matching item (returns new array)
 */
export function evalArrayRemoveItem(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const item = evaluate(args[1], ctx);
  const index = arr?.indexOf(item) ?? -1;
  if (index === -1) return arr ?? [];
  const result = [...arr];
  result.splice(index, 1);
  return result;
}

/**
 * array/reverse - Reverse array order (returns new array)
 */
export function evalArrayReverse(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  return [...(arr ?? [])].reverse();
}

/**
 * array/sort - Sort array (returns new array)
 */
export function evalArraySort(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const key = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;
  const dir = args.length > 2 ? (evaluate(args[2], ctx) as string) : 'asc';

  const result = [...(arr ?? [])];

  if (key) {
    result.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[key] as string | number;
      const bVal = (b as Record<string, unknown>)[key] as string | number;
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  } else {
    result.sort((a, b) => {
      const aVal = a as string | number;
      const bVal = b as string | number;
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return result;
}

/**
 * array/shuffle - Randomly shuffle array (returns new array)
 */
export function evalArrayShuffle(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const result = [...(arr ?? [])];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * array/unique - Remove duplicates (returns new array)
 */
export function evalArrayUnique(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  return [...new Set(arr ?? [])];
}

/**
 * array/flatten - Flatten nested arrays one level
 */
export function evalArrayFlatten(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  return (arr ?? []).flat();
}

/**
 * array/zip - Pair elements from two arrays
 */
export function evalArrayZip(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[][] {
  const arr1 = evaluate(args[0], ctx) as unknown[];
  const arr2 = evaluate(args[1], ctx) as unknown[];
  const len = Math.min(arr1?.length ?? 0, arr2?.length ?? 0);
  const result: unknown[][] = [];
  for (let i = 0; i < len; i++) {
    result.push([arr1[i], arr2[i]]);
  }
  return result;
}

/**
 * array/includes - Check if array contains item
 */
export function evalArrayIncludes(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const arr = evaluate(args[0], ctx) as unknown[];
  const item = evaluate(args[1], ctx);
  return arr?.includes(item) ?? false;
}

/**
 * array/indexOf - Find index of item (-1 if not found)
 */
export function evalArrayIndexOf(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  const item = evaluate(args[1], ctx);
  return arr?.indexOf(item) ?? -1;
}

/**
 * array/find - Find first element matching predicate.
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayFind(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];
  return (arr ?? []).find((item, i) => evalWithItem(predExpr, evaluate, ctx, item, i));
}

/**
 * array/findIndex - Find index of first element matching predicate (-1 if none).
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayFindIndex(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];
  return (arr ?? []).findIndex((item, i) => evalWithItem(predExpr, evaluate, ctx, item, i));
}

/**
 * array/filter - Keep elements matching predicate.
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayFilter(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];
  return (arr ?? []).filter((item, i) => evalWithItem(predExpr, evaluate, ctx, item, i));
}

/**
 * array/reject - Remove elements matching predicate.
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayReject(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];
  return (arr ?? []).filter((item, i) => !evalWithItem(predExpr, evaluate, ctx, item, i));
}

/**
 * array/map - Transform each element.
 * Mapper is an expression using @item (and optionally @index).
 */
export function evalArrayMap(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const mapExpr = args[1];
  return (arr ?? []).map((item, i) => evalWithItem(mapExpr, evaluate, ctx, item, i));
}

/**
 * array/reduce - Reduce array to single value.
 * Arg order matches Rust evaluator: [array, initialValue, ["fn", ["acc", "x"], body]]
 */
export function evalArrayReduce(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  const arr = evaluate(args[0], ctx) as unknown[];
  const init = evaluate(args[1], ctx);
  const reducerExpr = args[2];
  return (arr ?? []).reduce(
    (acc, item) => evalReduceLambda(reducerExpr, evaluate, ctx, acc, item),
    init
  );
}

/**
 * array/every - Check if all elements match predicate.
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayEvery(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];
  return (arr ?? []).every((item, i) => Boolean(evalWithItem(predExpr, evaluate, ctx, item, i)));
}

/**
 * array/some - Check if any element matches predicate.
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArraySome(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];
  return (arr ?? []).some((item, i) => Boolean(evalWithItem(predExpr, evaluate, ctx, item, i)));
}

/**
 * array/count - Count elements (optionally matching predicate).
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayCount(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  if (args.length > 1) {
    const predExpr = args[1];
    return (arr ?? []).filter((item, i) => evalWithItem(predExpr, evaluate, ctx, item, i)).length;
  }
  return arr?.length ?? 0;
}

/**
 * array/sum - Sum values (optionally by field)
 */
export function evalArraySum(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  const key = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;

  return (arr ?? []).reduce((sum: number, item) => {
    const value = key ? (item as Record<string, unknown>)[key] : item;
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

/**
 * array/avg - Average of values (optionally by field)
 */
export function evalArrayAvg(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  if (!arr || arr.length === 0) return 0;

  const key = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;

  const sum = arr.reduce((s: number, item) => {
    const value = key ? (item as Record<string, unknown>)[key] : item;
    return s + (typeof value === 'number' ? value : 0);
  }, 0);

  return sum / arr.length;
}

/**
 * array/min - Minimum value (optionally by field)
 */
export function evalArrayMin(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  if (!arr || arr.length === 0) return 0;

  const key = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;

  const values = arr.map((item) => {
    const value = key ? (item as Record<string, unknown>)[key] : item;
    return typeof value === 'number' ? value : Infinity;
  });

  return Math.min(...values);
}

/**
 * array/max - Maximum value (optionally by field)
 */
export function evalArrayMax(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const arr = evaluate(args[0], ctx) as unknown[];
  if (!arr || arr.length === 0) return 0;

  const key = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;

  const values = arr.map((item) => {
    const value = key ? (item as Record<string, unknown>)[key] : item;
    return typeof value === 'number' ? value : -Infinity;
  });

  return Math.max(...values);
}

/**
 * array/groupBy - Group elements by field value
 */
export function evalArrayGroupBy(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, unknown[]> {
  const arr = evaluate(args[0], ctx) as unknown[];
  const key = evaluate(args[1], ctx) as string;

  const result: Record<string, unknown[]> = {};
  for (const item of arr ?? []) {
    const groupKey = String((item as Record<string, unknown>)[key] ?? 'undefined');
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
  }
  return result;
}

/**
 * array/partition - Split array by predicate into [matches, nonMatches].
 * Predicate is an expression using @item (and optionally @index).
 */
export function evalArrayPartition(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): [unknown[], unknown[]] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const predExpr = args[1];

  const matches: unknown[] = [];
  const nonMatches: unknown[] = [];

  (arr ?? []).forEach((item, i) => {
    if (evalWithItem(predExpr, evaluate, ctx, item, i)) {
      matches.push(item);
    } else {
      nonMatches.push(item);
    }
  });

  return [matches, nonMatches];
}

/**
 * array/take - Take first n elements
 */
export function evalArrayTake(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const n = evaluate(args[1], ctx) as number;
  return (arr ?? []).slice(0, n);
}

/**
 * array/drop - Skip first n elements
 */
export function evalArrayDrop(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const n = evaluate(args[1], ctx) as number;
  return (arr ?? []).slice(n);
}

/**
 * array/takeLast - Take last n elements
 */
export function evalArrayTakeLast(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const n = evaluate(args[1], ctx) as number;
  return (arr ?? []).slice(-n);
}

/**
 * array/dropLast - Skip last n elements
 */
export function evalArrayDropLast(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const arr = evaluate(args[0], ctx) as unknown[];
  const n = evaluate(args[1], ctx) as number;
  return (arr ?? []).slice(0, -n);
}
