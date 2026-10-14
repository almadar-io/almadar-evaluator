/**
 * Operator argument types (D-12): a present argument that contradicts the signature the operator table
 * declares for its call raises `EvalTypeMismatchError`, the twin of orbital-core's `operators::arg_types` over
 * `signature`. One contract on every path: `null` is an absent value and passes; a nominal std type
 * (`tensor`, `cell`, ...) is not checked; nothing is coerced.
 *
 * The check is the signature's own: each evaluated argument is bound against its declared type, so two
 * arguments bound to one type variable must agree (`= : T, T`, `array/append : [T], T`). A value's type is its
 * kind — a list's is its first non-null element's, a record's carries no fields — so a `key-of` argument is a
 * static check only (`orb validate`).
 *
 * @packageDocumentation
 */

import { STD_OPERATORS } from '@almadar/std/registry';
import type { OperatorTypeRef } from '@almadar/std';
import type { RuntimeValue, SExpr } from '@almadar/core';
import type { Evaluator } from './context.js';
import { EvalTypeMismatchError } from './errors.js';

/** What the evaluator knows of an evaluated value: its kind, and for a list its first non-null element's. */
type ValueType =
  | { readonly kind: 'number' | 'string' | 'boolean' | 'object' }
  | { readonly kind: 'list'; readonly element: ValueType | null };

type Bindings = Map<string, ValueType[]>;

/** An operator's declared parameters. */
export interface Signature {
  readonly params: readonly { readonly name: string; readonly type: OperatorTypeRef }[];
  /** Whether the last parameter covers every further argument. */
  readonly unbounded: boolean;
}

const CHECKABLE: readonly string[] = ['number', 'string', 'boolean', 'date', 'datetime'];

function checks(type: OperatorTypeRef): boolean {
  if (typeof type === 'string') return CHECKABLE.includes(type);
  switch (type.kind) {
    case 'union':
      return type.of.some(checks);
    case 'array':
    case 'tuple':
    case 'map':
    case 'object':
    case 'record':
    case 'var':
    case 'keyOf':
    case 'shape':
      return true;
    case 'binding':
      return type.shape !== undefined && checks(type.shape);
    case 'sexpr':
      return type.of !== undefined && checks(type.of);
    default:
      return false;
  }
}

const SIGNATURES = new Map<string, Signature | null>();

/** The signature the operator table declares for `op`; `undefined` when a call to it checks nothing. */
export function operatorSignature(op: string): Signature | undefined {
  const cached = SIGNATURES.get(op);
  if (cached !== undefined) return cached ?? undefined;
  const meta = STD_OPERATORS[op];
  let signature: Signature | null = null;
  if (meta !== undefined && !meta.hasSideEffects && meta.params !== undefined && meta.params.length > 0) {
    const candidate: Signature = { params: meta.params, unbounded: meta.maxArity === null };
    if (candidate.params.some((p) => checks(p.type))) signature = candidate;
  }
  SIGNATURES.set(op, signature);
  return signature ?? undefined;
}

function formalAt(signature: Signature, index: number): OperatorTypeRef | undefined {
  const own = signature.params[index];
  if (own !== undefined) return own.type;
  const last = signature.params[signature.params.length - 1];
  return last.name.startsWith('...') || signature.unbounded ? last.type : undefined;
}

function typeOf(value: RuntimeValue): ValueType | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const element = typeOf(item);
      if (element !== null) return { kind: 'list', element };
    }
    return { kind: 'list', element: null };
  }
  switch (typeof value) {
    case 'number':
      return { kind: 'number' };
    case 'string':
      return { kind: 'string' };
    case 'boolean':
      return { kind: 'boolean' };
    case 'object':
      return { kind: 'object' };
    default:
      return null;
  }
}

function kindName(type: ValueType | null): string {
  if (type === null) return 'null';
  return type.kind === 'list' ? 'array' : type.kind;
}

/** The coarse kind a signature type declares, as orbital-core's `OperatorTypeRef::kind_name` names it. */
function formalKind(type: OperatorTypeRef): string {
  if (typeof type === 'string') return type;
  switch (type.kind) {
    case 'array':
    case 'tuple':
      return 'array';
    case 'map':
    case 'object':
    case 'record':
    case 'pickOf':
    case 'omitOf':
    case 'mergeOf':
      return 'object';
    case 'fn':
      return 'function';
    default:
      return type.kind;
  }
}

function expectedName(type: OperatorTypeRef): string {
  if (typeof type === 'string') return type;
  if (type.kind === 'union') {
    const names: string[] = [];
    for (const member of type.of) {
      if (typeof member !== 'string' && member.kind === 'literal' && member.value === null) continue;
      const name = expectedName(member);
      if (!names.includes(name)) names.push(name);
    }
    return names.join(' | ');
  }
  if (type.kind === 'var') return type.bound !== undefined ? expectedName(type.bound) : type.name;
  return formalKind(type);
}

function mismatch(type: OperatorTypeRef, actual: ValueType): EvalTypeMismatchError {
  return new EvalTypeMismatchError(expectedName(type), kindName(actual));
}

function agrees(a: ValueType, b: ValueType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'list' && b.kind === 'list' && a.element !== null && b.element !== null) {
    return agrees(a.element, b.element);
  }
  return true;
}

function cloneBindings(b: Bindings): Bindings {
  return new Map([...b].map(([name, all]) => [name, [...all]]));
}

function bindBound(bound: OperatorTypeRef, actual: ValueType): void {
  if (typeof bound !== 'string' && bound.kind === 'record') {
    if (actual.kind !== 'object') throw new EvalTypeMismatchError('object', kindName(actual));
    return;
  }
  try {
    bindType(bound, actual, new Map());
  } catch (err) {
    if (err instanceof EvalTypeMismatchError) throw new EvalTypeMismatchError(expectedName(bound), err.actual);
    throw err;
  }
}

function bindType(formal: OperatorTypeRef, actual: ValueType, bindings: Bindings): void {
  if (typeof formal === 'string') {
    if (!CHECKABLE.includes(formal)) return;
    const fits =
      formal === 'date' || formal === 'datetime'
        ? actual.kind === 'string' || actual.kind === 'number'
        : actual.kind === formal;
    if (!fits) throw mismatch(formal, actual);
    return;
  }
  switch (formal.kind) {
    case 'union': {
      for (const member of formal.of) {
        const trial = cloneBindings(bindings);
        try {
          bindType(member, actual, trial);
        } catch (err) {
          if (err instanceof EvalTypeMismatchError) continue;
          throw err;
        }
        bindings.clear();
        for (const [name, all] of trial) bindings.set(name, all);
        return;
      }
      throw mismatch(formal, actual);
    }
    case 'literal':
      if (formal.value === null) throw mismatch(formal, actual);
      return;
    case 'array':
    case 'tuple': {
      if (actual.kind !== 'list') throw mismatch(formal, actual);
      if (actual.element === null) return;
      if (formal.kind === 'array') bindType(formal.of, actual.element, bindings);
      else for (const item of formal.items) bindType(item, actual.element, bindings);
      return;
    }
    case 'map': {
      if (actual.kind !== 'object') throw mismatch(formal, actual);
      bindType(formal.key, { kind: 'string' }, bindings);
      return;
    }
    case 'object':
    case 'record':
      if (actual.kind !== 'object') throw mismatch(formal, actual);
      return;
    case 'var': {
      if (formal.bound !== undefined) bindBound(formal.bound, actual);
      const prior = bindings.get(formal.name);
      if (formal.each === true) {
        bindings.set(formal.name, [...(prior ?? []), actual]);
        return;
      }
      if (prior !== undefined) {
        if (!agrees(prior[0], actual)) throw new EvalTypeMismatchError(kindName(prior[0]), kindName(actual));
        return;
      }
      bindings.set(formal.name, [actual]);
      return;
    }
    case 'binding':
      if (formal.shape !== undefined) bindType(formal.shape, actual, bindings);
      return;
    case 'sexpr':
      if (formal.of !== undefined) bindType(formal.of, actual, bindings);
      return;
    case 'keyOf':
      if (actual.kind !== 'string') throw new EvalTypeMismatchError('string', kindName(actual));
      return;
    case 'shape':
      if (actual.kind !== 'string') throw new EvalTypeMismatchError('string', kindName(actual));
      return;
    default:
      return;
  }
}

/** Binds `value`, the evaluated argument at `index`, against its declared type; throws when it contradicts it. */
function bindArgument(signature: Signature, bindings: Bindings, index: number, value: RuntimeValue): void {
  const actual = typeOf(value);
  if (actual === null) return;
  const formal = formalAt(signature, index);
  if (formal === undefined) return;
  const trial = cloneBindings(bindings);
  bindType(formal, actual, trial);
  bindings.clear();
  for (const [name, all] of trial) bindings.set(name, all);
}

/**
 * The child evaluator an operator receives: every argument it evaluates is bound against its declared type. A
 * child is an argument by identity; equal primitives are told apart by evaluation order.
 */
export function withArgChecks(signature: Signature, args: readonly SExpr[], evaluate: Evaluator): Evaluator {
  let consumed: Set<number> | null = null;
  const bindings: Bindings = new Map();
  return (child, ctx) => {
    const value = evaluate(child, ctx);
    const first = args.indexOf(child);
    if (first < 0) return value;
    let index = first;
    if (args.indexOf(child, first + 1) >= 0) {
      consumed ??= new Set();
      for (let i = first; i >= 0; i = args.indexOf(child, i + 1)) {
        if (!consumed.has(i)) {
          consumed.add(i);
          index = i;
          break;
        }
      }
    }
    bindArgument(signature, bindings, index, value);
    return value;
  };
}
