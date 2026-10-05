import { describe, it, expect } from 'vitest';
import { SExpressionEvaluator } from '../SExpressionEvaluator';
import { createMinimalContext } from '../context';
import { quoteExpr } from '@almadar/core';
import type { SExpr } from '@almadar/core';

// G-CROSS-041: `(quote x)` holds an S-expression as data — nothing inside it
// is evaluated or resolved, on the interpreted and the compiled (tier-up) path.
const ctx = () => createMinimalContext({ total: 40 }, { amount: 7 });
const GUARD: SExpr = ['>', '@payload.amount', 0];

describe('quote', () => {
  it('returns the quoted expression verbatim, bindings unresolved', () => {
    const ev = new SExpressionEvaluator();
    expect(ev.evaluate(quoteExpr(GUARD), ctx())).toEqual(['>', '@payload.amount', 0]);
    expect(ev.evaluate(quoteExpr('@entity.total'), ctx())).toBe('@entity.total');
  });

  it('stays verbatim once the tree tiers up to compiled closures', () => {
    const ev = new SExpressionEvaluator();
    const expr = quoteExpr(GUARD);
    for (let i = 0; i < 4; i++) {
      expect(ev.evaluate(expr, ctx())).toEqual(['>', '@payload.amount', 0]);
    }
  });

  it('control: the same expression unquoted is evaluated', () => {
    const ev = new SExpressionEvaluator();
    expect(ev.evaluate(GUARD, ctx())).toBe(true);
  });

  it('edge: a quote nested in an object literal keeps its siblings evaluated', () => {
    const ev = new SExpressionEvaluator();
    const out = ev.evaluate({ guard: quoteExpr(GUARD), total: '@entity.total' }, ctx());
    expect(out).toEqual({ guard: ['>', '@payload.amount', 0], total: 40 });
  });

  it('edge: quoted effect args with nested calls stay data', () => {
    const ev = new SExpressionEvaluator();
    const effect: SExpr = ['set', '@entity.total', ['+', '@entity.total', 1]];
    expect(ev.evaluate(quoteExpr(effect), ctx())).toEqual(effect);
  });

  it('edge: a non-string quote argument is rejected', () => {
    const ev = new SExpressionEvaluator();
    expect(() => ev.evaluate(['quote', GUARD], ctx())).toThrow(/quote/);
  });
});
