// A lambda value the evaluator produces remembers the `(fn …)` it was made from, so a consumer that must serialise it (a render prop crossing the server bridge) can send the source form instead of a stripped function.
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate, lambdaSourceOf } from '../index.js';
import { createMinimalContext } from '../context.js';

const when: SExpr = ['fn', 'row', ['=', ['object/get', '@row', 'ownerId'], '@user.id']];

describe('lambdaSourceOf', () => {
  it('returns the source of a lambda the evaluator built', () => {
    const closure = evaluate(when, createMinimalContext());
    expect(typeof closure).toBe('function');
    expect(lambdaSourceOf(closure)).toEqual(when);
  });

  it('returns the source of a lambda stored in a literal object', () => {
    const result = evaluate({ event: 'EDIT', when }, createMinimalContext());
    if (result === null || typeof result !== 'object') throw new Error('expected an object');
    const stored = Object.entries(result).find(([key]) => key === 'when')?.[1];
    expect(lambdaSourceOf(stored)).toEqual(when);
  });

  it('keeps a grouped-parameter lambda whole', () => {
    const reducer: SExpr = ['fn', ['acc', 'x'], ['+', '@acc', '@x']];
    expect(lambdaSourceOf(evaluate(reducer, createMinimalContext()))).toEqual(reducer);
  });

  it('holds on the tiered-up (compiled) evaluation of the same tree, not just the first interpretation', () => {
    const literal: SExpr = { event: 'EDIT', when };
    const sources = [0, 1, 2, 3].map(() => {
      const result = evaluate(literal, createMinimalContext());
      if (result === null || typeof result !== 'object') throw new Error('expected an object');
      return lambdaSourceOf(Object.entries(result).find(([key]) => key === 'when')?.[1]);
    });
    expect(sources).toEqual([when, when, when, when]);
  });

  it('control: a function the evaluator did not build has no source', () => {
    expect(lambdaSourceOf(() => 1)).toBeUndefined();
  });

  it('control: a non-function value has no source', () => {
    expect(lambdaSourceOf('fn')).toBeUndefined();
    expect(lambdaSourceOf(['fn', 'x', 1])).toBeUndefined();
    expect(lambdaSourceOf(null)).toBeUndefined();
  });
});
