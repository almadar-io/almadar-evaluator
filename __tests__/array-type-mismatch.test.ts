// An array operator given a non-array raises a typed TypeMismatch, never a raw
// TypeError and never a silent empty list — the semantics of orbital-core's
// `require_array!` (evaluator/operators/macros.rs), same message, same type names.
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate, EvalTypeMismatchError } from '../index.js';
import { createMinimalContext } from '../context.js';

const keep: SExpr = ['fn', 'x', true];
const twice: SExpr = ['fn', 'x', ['*', '@x', 2]];

/** Every operator orbital-core guards with `require_array!`, called on `input`. */
const GUARDED: Array<[string, (input: SExpr) => SExpr]> = [
  ['array/map', (a) => ['array/map', a, twice]],
  ['array/filter', (a) => ['array/filter', a, keep]],
  ['array/reject', (a) => ['array/reject', a, keep]],
  ['array/find', (a) => ['array/find', a, keep]],
  ['array/findIndex', (a) => ['array/findIndex', a, keep]],
  ['array/every', (a) => ['array/every', a, keep]],
  ['array/some', (a) => ['array/some', a, keep]],
  ['array/partition', (a) => ['array/partition', a, keep]],
  ['array/reduce', (a) => ['array/reduce', a, 0, ['fn', ['acc', 'x'], '@acc']]],
  ['array/slice', (a) => ['array/slice', a, 0, 1]],
  ['array/append', (a) => ['array/append', a, 1]],
  ['array/prepend', (a) => ['array/prepend', a, 1]],
  ['array/insert', (a) => ['array/insert', a, 0, 1]],
  ['array/remove', (a) => ['array/remove', a, 0]],
  ['array/sort', (a) => ['array/sort', a]],
  ['array/reverse', (a) => ['array/reverse', a]],
  ['array/unique', (a) => ['array/unique', a]],
  ['array/flatten', (a) => ['array/flatten', a]],
  ['array/shuffle', (a) => ['array/shuffle', a]],
  ['array/indexOf', (a) => ['array/indexOf', a, 1]],
  ['array/sum', (a) => ['array/sum', a]],
  ['array/avg', (a) => ['array/avg', a]],
  ['array/min', (a) => ['array/min', a]],
  ['array/max', (a) => ['array/max', a]],
  ['array/groupBy', (a) => ['array/groupBy', a, 'kind']],
  ['array/take', (a) => ['array/take', a, 1]],
  ['array/drop', (a) => ['array/drop', a, 1]],
  ['array/takeLast', (a) => ['array/takeLast', a, 1]],
  ['array/dropLast', (a) => ['array/dropLast', a, 1]],
];

const mismatch = (expr: SExpr): EvalTypeMismatchError | null => {
  try {
    evaluate(expr, createMinimalContext());
    return null;
  } catch (err) {
    return err instanceof EvalTypeMismatchError ? err : null;
  }
};

describe('array operators on a non-array raise TypeMismatch (orbital-core require_array!)', () => {
  it.each(GUARDED)('%s on a string', (_op, call) => {
    const err = mismatch(call('not-a-list'));
    expect(err?.message).toBe('Type mismatch: expected array, got string');
    expect(err?.expected).toBe('array');
    expect(err?.actual).toBe('string');
  });

  it.each(GUARDED)('%s on null', (_op, call) => {
    expect(mismatch(call(null))?.actual).toBe('null');
  });

  it.each(GUARDED)('control: %s on an array does not raise', (_op, call) => {
    expect(() => evaluate(call(['list', { kind: 'a' }, { kind: 'b' }]), createMinimalContext())).not.toThrow(EvalTypeMismatchError);
  });

  it('edge: an object and a number name their own type', () => {
    expect(mismatch(['array/filter', { a: 1 }, keep])?.actual).toBe('object');
    expect(mismatch(['array/filter', 3, keep])?.actual).toBe('number');
    expect(mismatch(['array/filter', true, keep])?.actual).toBe('boolean');
  });

  it('edge: an unbound binding is null, as in the compiled path', () => {
    expect(mismatch(['array/map', '@entity.missing', twice])?.actual).toBe('null');
  });

  it('control: operators orbital-core leaves lenient stay lenient', () => {
    expect(evaluate(['array/len', null], createMinimalContext())).toBe(0);
    expect(evaluate(['array/includes', null, 1], createMinimalContext())).toBe(false);
  });
});
