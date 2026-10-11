import { describe, it, expect } from 'vitest';
import { SExpressionEvaluator } from '../SExpressionEvaluator';
import { createMinimalContext, resolveBinding, type EvaluationContext } from '../context';
import { quoteExpr } from '@almadar/core';
import type { SExpr } from '@almadar/core';

// G-CROSS-076: a quoted config value (`machine : T = (quote { … })`) holds its
// data encoded as the `['quote', body]` S-expression. DOTTED path access used
// to descend into the encoded form and hit `null`, forcing
// `(object/get @config.machine "transitions")` workarounds. Path steps must
// decode a quoted value before descending further.
const MACHINE: SExpr = {
  name: 'Checkout',
  states: [{ name: 'pending', isInitial: true }],
  transitions: [{ from: 'pending', to: 'paid', event: 'PAY', index: 0 }],
};
function ctx(): EvaluationContext {
  return { ...createMinimalContext({ active: 'pending' }), config: { machine: quoteExpr(MACHINE) } };
}

describe('dotted binding paths into quoted config values (G-CROSS-076)', () => {
  it('decodes the quoted value itself', () => {
    expect(resolveBinding('@config.machine', ctx())).toEqual(MACHINE);
  });

  it('resolves one path step past the decode', () => {
    expect(resolveBinding('@config.machine.transitions', ctx())).toEqual(MACHINE.transitions);
  });

  it('resolves deep paths past the decode', () => {
    expect(resolveBinding('@config.machine.transitions.0.event', ctx())).toBe('PAY');
  });

  it('feeds typed operators directly', () => {
    const ev = new SExpressionEvaluator();
    const guard: SExpr = ['array/some', '@config.machine.transitions', ['fn', 't', ['==', '@t.from', '@entity.active']]];
    expect(ev.evaluate(guard, ctx())).toBe(true);
  });

  it('leaves non-quoted config values untouched', () => {
    const c: EvaluationContext = { ...createMinimalContext(), config: { start: { x: 1, y: 2 } } };
    expect(resolveBinding('@config.start.y', c)).toBe(2);
  });
});