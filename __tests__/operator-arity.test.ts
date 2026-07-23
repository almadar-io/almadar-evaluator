import { describe, it, expect } from 'vitest';
import { SExpressionEvaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';

/**
 * R-EVALUATOR-NO-ARITY-CHECK: the interpreter enforces the SAME canonical
 * arity bounds the compiled path's `resolve_sexpr_call` does. Variadic
 * operators (maxArity: null) keep accepting any count; fixed-arity operators
 * throw instead of silently truncating/wrapping.
 */
describe('operator arity guard', () => {
  const ev = new SExpressionEvaluator();

  it('variadic + folds every argument', () => {
    expect(ev.evaluate(['+', 5, 2, 16], createMinimalContext())).toBe(23);
  });

  it('fixed-arity operator throws on excess arguments', () => {
    // `%` is canonically 2..2.
    expect(() => ev.evaluate(['%', 10, 3, 1], createMinimalContext())).toThrow(/expected 2 argument/);
  });

  it('fixed-arity operator throws on missing arguments', () => {
    expect(() => ev.evaluate(['%', 10], createMinimalContext())).toThrow(/expected 2 argument/);
  });

  it('unregistered heads stay data arrays', () => {
    expect(ev.evaluate(['static'], createMinimalContext())).toEqual(['static']);
  });
});
