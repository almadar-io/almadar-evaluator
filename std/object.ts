/**
 * Object Module Runtime Evaluators
 *
 * Runtime implementations for object/* operators.
 * All operations are immutable (return new objects).
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import { createChildContext } from '../context.js';
import { isSExpr, getOperator, getArgs } from '../types/expression.js';
import type { RuntimeValue } from '@almadar/core';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => RuntimeValue;

/** Keys that must never be written via a path/merge — guards against prototype pollution. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Helper to evaluate a lambda expression with bound variable(s).
 */
function evalLambda(
  lambdaExpr: SExpr,
  evaluate: EvalFn,
  ctx: EvaluationContext,
  ...values: RuntimeValue[]
): RuntimeValue {
  if (!isSExpr(lambdaExpr) || getOperator(lambdaExpr) !== 'fn') {
    return evaluate(lambdaExpr, ctx);
  }

  const args = getArgs(lambdaExpr);
  const params = args[0];
  const body = args[1];

  // Create new locals map for the child context
  const newLocals = new Map<string, RuntimeValue>();

  if (Array.isArray(params)) {
    // Multiple params: ["fn", ["a", "b"], body]
    const paramNames = params as string[];
    values.forEach((v, i) => {
      if (paramNames[i]) {
        const paramName = paramNames[i];
        // Store without @ prefix - resolveBinding strips @ before lookup
        const key = paramName.startsWith('@') ? paramName.slice(1) : paramName;
        newLocals.set(key, v);
      }
    });
  } else if (typeof params === 'string') {
    // Single param: ["fn", "x", body]
    // Store without @ prefix - resolveBinding strips @ before lookup
    const paramName = params.startsWith('@') ? params.slice(1) : params;
    newLocals.set(paramName, values[0]);
  }

  const childCtx = createChildContext(ctx, newLocals);

  return evaluate(body, childCtx);
}

/**
 * object/keys - Get object keys as array
 */
export function evalObjectKeys(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string[] {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  return Object.keys(obj ?? {});
}

/**
 * object/values - Get object values as array
 */
export function evalObjectValues(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  return Object.values(obj ?? {});
}

/**
 * object/entries - Get [key, value] pairs as array
 */
export function evalObjectEntries(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): [string, unknown][] {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  return Object.entries(obj ?? {});
}

/**
 * object/fromEntries - Create object from [key, value] pairs
 */
export function evalObjectFromEntries(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const entries = evaluate(args[0], ctx) as [string, RuntimeValue][];
  return Object.fromEntries(entries ?? []);
}

/**
 * object/get - Get nested value by path
 */
export function evalObjectGet(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): RuntimeValue {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const path = evaluate(args[1], ctx) as string;
  const defaultValue = args.length > 2 ? evaluate(args[2], ctx) : undefined;

  if (!obj || !path) return defaultValue;

  const parts = path.split('.');
  let current: RuntimeValue = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, RuntimeValue>)[part];
  }

  return current !== undefined ? current : defaultValue;
}

/**
 * object/set - Set nested value by path (returns new object)
 */
export function evalObjectSet(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const path = evaluate(args[1], ctx) as string;
  const value = evaluate(args[2], ctx);

  if (!path) return obj ?? {};

  const result = structuredClone(obj ?? {});
  const parts = path.split('.');
  if (parts.some((p) => FORBIDDEN_KEYS.has(p))) {
    // Refuse __proto__/constructor/prototype segments — prevents prototype pollution.
    return result;
  }
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, RuntimeValue>;
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * object/has - Check if path exists
 */
export function evalObjectHas(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const path = evaluate(args[1], ctx) as string;

  if (!obj || !path) return false;

  const parts = path.split('.');
  let current: RuntimeValue = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(current, part)) {
      return false;
    }
    current = (current as Record<string, RuntimeValue>)[part];
  }

  return true;
}

/**
 * object/merge - Shallow merge objects (later wins)
 */
export function evalObjectMerge(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const objects = args.map((a) => evaluate(a, ctx) as Record<string, RuntimeValue>);
  return Object.assign({}, ...objects.map((o) => o ?? {}));
}

/**
 * object/deepMerge - Deep merge objects (later wins)
 */
export function evalObjectDeepMerge(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const objects = args.map((a) => evaluate(a, ctx) as Record<string, RuntimeValue>);

  function deepMerge(
    target: Record<string, RuntimeValue>,
    source: Record<string, RuntimeValue>
  ): Record<string, RuntimeValue> {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (FORBIDDEN_KEYS.has(key)) continue; // skip prototype-polluting keys
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] !== null &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, RuntimeValue>,
          source[key] as Record<string, RuntimeValue>
        );
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  return objects.reduce((acc, obj) => deepMerge(acc, obj ?? {}), {} as Record<string, RuntimeValue>);
}

/**
 * object/pick - Select only specified keys
 */
export function evalObjectPick(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const keys = evaluate(args[1], ctx) as string[];

  const result: Record<string, RuntimeValue> = {};
  for (const key of keys ?? []) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * object/omit - Exclude specified keys
 */
export function evalObjectOmit(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const keys = evaluate(args[1], ctx) as string[];

  const keysSet = new Set(keys ?? []);
  const result: Record<string, RuntimeValue> = {};
  for (const key of Object.keys(obj ?? {})) {
    if (!keysSet.has(key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * object/mapValues - Transform all values
 */
export function evalObjectMapValues(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const lambda = args[1];

  const result: Record<string, RuntimeValue> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    result[key] = evalLambda(lambda, evaluate, ctx, value);
  }
  return result;
}

/**
 * object/mapKeys - Transform all keys
 */
export function evalObjectMapKeys(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const lambda = args[1];

  const result: Record<string, RuntimeValue> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    const newKey = String(evalLambda(lambda, evaluate, ctx, key));
    result[newKey] = value;
  }
  return result;
}

/**
 * object/filter - Filter entries by predicate
 */
export function evalObjectFilter(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  const lambda = args[1];

  const result: Record<string, RuntimeValue> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (evalLambda(lambda, evaluate, ctx, key, value)) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * object/empty? - Check if object has no keys
 */
export function evalObjectEmpty(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  return !obj || Object.keys(obj).length === 0;
}

/**
 * object/equals - Deep equality check
 */
export function evalObjectEquals(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const a = evaluate(args[0], ctx);
  const b = evaluate(args[1], ctx);

  function deepEqual(x: unknown, y: unknown): boolean {
    if (x === y) return true;
    if (typeof x !== typeof y) return false;
    if (typeof x !== 'object' || x === null || y === null) return false;
    if (Array.isArray(x) !== Array.isArray(y)) return false;

    const xKeys = Object.keys(x);
    const yKeys = Object.keys(y as object);
    if (xKeys.length !== yKeys.length) return false;

    for (const key of xKeys) {
      if (!deepEqual((x as Record<string, RuntimeValue>)[key], (y as Record<string, RuntimeValue>)[key])) {
        return false;
      }
    }
    return true;
  }

  return deepEqual(a, b);
}

/**
 * object/clone - Shallow clone object
 */
export function evalObjectClone(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  return { ...(obj ?? {}) };
}

/**
 * object/deepClone - Deep clone object
 */
export function evalObjectDeepClone(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, RuntimeValue> {
  const obj = evaluate(args[0], ctx) as Record<string, RuntimeValue>;
  return structuredClone(obj ?? {});
}

/**
 * path - Build a dot-separated path string from segments
 *
 * Used for dynamic field access in set effects:
 *   ["set", ["path", "formValues", "@payload.fieldId"], "@payload.value"]
 *
 * @example
 *   ["path", "formValues", "A9"] => "formValues.A9"
 *   ["path", "@entity.prefix", "field"] => "myPrefix.field" (if @entity.prefix = "myPrefix")
 */
export function evalPath(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  if (args.length === 0) {
    throw new Error('path operator requires at least 1 argument');
  }

  const segments = args.map((arg) => {
    const evaluated = evaluate(arg, ctx);
    return String(evaluated ?? '');
  });

  return segments.join('.');
}
