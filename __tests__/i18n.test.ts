// `i18n/t` reads the active locale's catalog; keys arrive qualified with their behavior's name. Twin of orbital-core `evaluator/operators/i18n.rs`.
import { describe, it, expect } from 'vitest';
import { createMinimalContext, resolveBinding, type EvaluationContext } from '../context.js';
import { evaluate } from '../SExpressionEvaluator.js';

function ctx(locale: string, messages: Record<string, string>): EvaluationContext {
  return { ...createMinimalContext({}, {}, 'idle'), locale, messages };
}

describe('i18n/t', () => {
  it("resolves the active locale's message", () => {
    expect(evaluate(['i18n/t', 'home:hero.title'], ctx('ar', { 'home:hero.title': 'مرحبا' }))).toBe('مرحبا');
  });

  it('fills placeholders from params', () => {
    const c = ctx('en', { 'home:posts.count': '{{n}} posts by {{who}}' });
    expect(evaluate(['i18n/t', 'home:posts.count', { n: 3, who: 'Osama' }], c)).toBe('3 posts by Osama');
  });

  it("control: another locale's catalog gives another message", () => {
    expect(evaluate(['i18n/t', 'home:hero.title'], ctx('en', { 'home:hero.title': 'Hello' }))).toBe('Hello');
  });

  it('a missing key is an error, not a fallback', () => {
    expect(() => evaluate(['i18n/t', 'home:hero.title'], ctx('sl', {}))).toThrow(/home:hero.title/);
  });

  it('the locale binding reads the active locale', () => {
    expect(resolveBinding('@locale', ctx('sl', {}))).toBe('sl');
  });
});
