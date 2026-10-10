// `@trait.X` is a client-only composition token: the renderer swaps it for the
// trait's frame. Evaluation must hand it back verbatim — inside an `if` branch
// or a map body it became null, so std-hero's `mediaContent` embed was empty.
import { describe, it, expect } from 'vitest';
import type { SExpr } from '@almadar/core';
import { evaluate, resolveBinding } from '../index.js';
import { createMinimalContext } from '../context.js';

const media = { type: 'box', children: ['@trait.HeroArt'] };

describe('client-only @trait bindings evaluate to themselves', () => {
  it('resolveBinding returns the token', () => {
    expect(resolveBinding('@trait.HeroArt', createMinimalContext())).toBe('@trait.HeroArt');
  });

  it('a slot-qualified token is returned whole', () => {
    expect(resolveBinding('@trait.HeroArt.main', createMinimalContext())).toBe('@trait.HeroArt.main');
  });

  it('an if branch holding a render node keeps the token', () => {
    const expr: SExpr = ['if', ['==', '', ''], media, { type: 'box', children: [] }];
    expect(evaluate(expr, createMinimalContext())).toEqual(media);
  });

  it('a map body keeps the token', () => {
    const expr: SExpr = ['array/map', ['quote', '[1]'], ['fn', 'n', { type: 'card', children: ['@trait.Row'] }]];
    expect(evaluate(expr, createMinimalContext())).toEqual([{ type: 'card', children: ['@trait.Row'] }]);
  });

  it('control: an unbound @entity field is still undefined', () => {
    expect(resolveBinding('@entity.missing', createMinimalContext())).toBeUndefined();
  });

  it('control: a non-binding string is untouched', () => {
    expect(evaluate(['if', true, 'trait.HeroArt', 'x'], createMinimalContext())).toBe('trait.HeroArt');
  });
});
