import { describe, it, expect } from 'vitest';
import type { EvalStep, SExpr } from '@almadar/core';
import { evaluate, evaluateTraced } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';

const key = (p: EvalStep['path']): string => p.join('.');
const exits = (trace: EvalStep[]) => new Map(trace.filter((s) => s.kind === 'exit').map((s) => [key(s.path), s.value]));
const kinds = (trace: EvalStep[], kind: EvalStep['kind']) => trace.filter((s) => s.kind === kind).map((s) => key(s.path));

describe('evaluateTraced', () => {
  it('returns the same value as evaluate (parity across operator families)', () => {
    const ctx = createMinimalContext({ qty: 3, role: 'viewer', items: [{ qty: 2 }, { qty: 0 }, { qty: 5 }] });
    const exprs: SExpr[] = [
      ['+', 1, ['*', 2, 3]],
      ['and', ['>', '@entity.qty', 0], ['=', '@entity.role', 'admin']],
      ['if', ['>', '@entity.qty', 5], 'big', 'small'],
      ['array/map', ['list', 1, 2], ['fn', 'x', ['*', '@x', 2]]],
      ['str/upper', 'abc'],
    ];
    for (const expr of exprs) expect(evaluateTraced(expr, ctx).value).toEqual(evaluate(expr, ctx));
  });

  it('records each node entering and exiting with its value, by structural path', () => {
    const { trace } = evaluateTraced(['+', 1, ['*', 2, 3]], createMinimalContext());
    const values = exits(trace);
    expect(values.get('')).toBe(7);
    expect(values.get('2')).toBe(6);
    expect(values.get('2.1')).toBe(2);
    expect(trace[0]).toEqual({ kind: 'enter', path: [] });
    expect(trace[trace.length - 1]).toEqual({ kind: 'exit', path: [], value: 7 });
  });

  it('resolves bindings as traced values', () => {
    const { trace } = evaluateTraced(['>', '@entity.qty', 0], createMinimalContext({ qty: 3 }));
    expect(exits(trace).get('1')).toBe(3);
  });

  it('marks short-circuited arguments skipped (and / or / if)', () => {
    const ctx = createMinimalContext({ qty: 0 });
    expect(kinds(evaluateTraced(['and', ['>', '@entity.qty', 0], ['=', 1, 1]], ctx).trace, 'skip')).toEqual(['2']);
    expect(kinds(evaluateTraced(['or', ['=', 1, 1], ['=', 2, 2]], ctx).trace, 'skip')).toEqual(['2']);
    expect(kinds(evaluateTraced(['if', ['>', '@entity.qty', 5], 'big', 'small'], ctx).trace, 'skip')).toEqual(['2']);
  });

  it('control: nothing is skipped when every argument runs', () => {
    const { trace } = evaluateTraced(['and', ['=', 1, 1], ['=', 2, 2]], createMinimalContext());
    expect(kinds(trace, 'skip')).toEqual([]);
  });

  it('marks a lambda body iterated once per item after the first', () => {
    const { trace } = evaluateTraced(['array/map', ['list', 1, 2, 3], ['fn', 'x', ['*', '@x', 2]]], createMinimalContext());
    const bodyExits = trace.filter((s) => s.kind === 'exit' && key(s.path) === '2.2').map((s) => s.value);
    expect(bodyExits).toEqual([2, 4, 6]);
    expect(kinds(trace, 'iter').filter((p) => p === '2.2')).toHaveLength(2);
  });

  it('keeps duplicate literal arguments apart', () => {
    const { trace } = evaluateTraced(['+', 1, 1], createMinimalContext());
    expect(kinds(trace, 'enter')).toEqual(['', '1', '2']);
  });

  it('returns the trace up to a failure plus the error instead of throwing', () => {
    const r = evaluateTraced(['+', 1, ['array/nth', ['list']]], createMinimalContext());
    expect(r.error).toBeDefined();
    const failed = r.trace.filter((s) => s.kind === 'exit' && s.error !== undefined).map((s) => key(s.path));
    expect(failed).toEqual(['2', '']);
    expect(kinds(r.trace, 'exit')).toContain('1');
  });

  it('control: a successful run has no error', () => {
    expect(evaluateTraced(['+', 1, 2], createMinimalContext()).error).toBeUndefined();
  });
});
