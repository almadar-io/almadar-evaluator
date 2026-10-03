// A config value that is itself a binding (`navItems = @pages`) resolves through, inside
// S-expressions too — the compiled path substitutes `@config.X` with its value before
// evaluation (orbital-compiler inline rewrite_config_bindings). std-app-layout's
// `(array/filter @config.navItems …)` got the literal "@pages" string.
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate, resolveBinding } from '../index.js';
import { createMinimalContext, type EvaluationContext } from '../context.js';

const PAGES = [{ href: '/a', label: 'A' }, { href: '/b', label: 'B' }];

function ctxWith(config: NonNullable<EvaluationContext['config']>): EvaluationContext {
  const ctx = createMinimalContext();
  ctx.config = config;
  ctx.pages = PAGES;
  ctx.entity = { name: 'Row' };
  return ctx;
}

describe('a config value that is a binding resolves through', () => {
  it('@config.navItems = "@pages" is the pages list', () => {
    expect(resolveBinding('@config.navItems', ctxWith({ navItems: '@pages' }))).toEqual(PAGES);
  });

  it('inside an S-expression: array/filter over it works', () => {
    const expr: SExpr = ['array/filter', '@config.navItems', ['fn', 'x', true]];
    expect(evaluate(expr, ctxWith({ navItems: '@pages' }))).toEqual(PAGES);
  });

  it('@config.theme = "@currentTheme" is the theme key', () => {
    const ctx = ctxWith({ theme: '@currentTheme' });
    ctx.currentTheme = 'ocean';
    expect(resolveBinding('@config.theme', ctx)).toBe('ocean');
  });

  it('a default bound to an entity field resolves to that field', () => {
    expect(resolveBinding('@config.title', ctxWith({ title: '@entity.name' }))).toBe('Row');
  });

  it('control: a plain string config value stays that string', () => {
    expect(resolveBinding('@config.title', ctxWith({ title: 'Hello' }))).toBe('Hello');
  });

  it('control: a client-only @trait binding passes through untouched', () => {
    expect(resolveBinding('@config.slot', ctxWith({ slot: '@trait.Header' }))).toBe('@trait.Header');
  });

  it('edge: a self-referencing default stays the raw binding, and array/filter over it is a type mismatch', () => {
    const ctx = ctxWith({ navItems: '@config.navItems' });
    expect(resolveBinding('@config.navItems', ctx)).toBe('@config.navItems');
    expect(() => evaluate(['array/filter', '@config.navItems', ['fn', 'x', true]], ctx)).toThrow('Type mismatch: expected array, got string');
  });

});
