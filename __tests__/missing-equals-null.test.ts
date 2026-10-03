// A missing field is null, as in orbital-core (no undefined there): `(== @payload.x null)`
// guards a field the payload doesn't carry. riya's square-wave guard let a curve without
// samples through when JS compared `undefined` strictly against null.
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate } from '../index.js';
import { createMinimalContext } from '../context.js';

const run = (expr: SExpr): unknown => {
  const ctx = createMinimalContext();
  ctx.payload = { present: [1], zero: 0, empty: '' };
  return evaluate(expr, ctx);
};

describe('a missing field equals null', () => {
  it('(== @payload.missing null) is true; != is false', () => {
    expect(run(['==', '@payload.missing', null])).toBe(true);
    expect(run(['!=', '@payload.missing', null])).toBe(false);
  });

  it('control: a present field is not null', () => {
    expect(run(['==', '@payload.present', null])).toBe(false);
    expect(run(['!=', '@payload.present', null])).toBe(true);
  });

  it('edge: falsy values are not null', () => {
    expect(run(['==', '@payload.zero', null])).toBe(false);
    expect(run(['==', '@payload.empty', null])).toBe(false);
  });

  it('edge: two missing fields are equal; missing is not 0', () => {
    expect(run(['==', '@payload.a', '@payload.b'])).toBe(true);
    expect(run(['==', '@payload.missing', 0])).toBe(false);
  });

  it("the riya guard: a missing list skips the curve", () => {
    expect(run(['if', ['==', '@payload.targetSquareWave', null], ['list'], ['list', { label: 'target' }]])).toEqual([]);
  });
});
