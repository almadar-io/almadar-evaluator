/**
 * Compile Parity — interpreted vs compiled execution must agree.
 *
 * The tier-up compiler (R-EVALUATOR-JIT-IS-A-WRAPPER) re-executes every hot
 * tree as composed closures instead of a per-node tree-walk. This test is
 * the standing gate against semantic drift: a unit corpus covering each
 * operator family plus a sweep over EVERY guard/effect/tick tree in the std
 * + io behavior registries, each run interpreted (fresh evaluator, first
 * sight) and compiled (`compile()`), results deep-compared under a fixed
 * deterministic context.
 *
 * Nondeterministic operators (randomness, wall-clock, async I/O, substrate
 * services) are skipped in the sweep — both paths run them, but at different
 * times, so no deterministic comparison is possible.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { SExpr, RuntimeValue } from '@almadar/core';
import { SExpressionEvaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext, type EvaluationContext } from '../context.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Deterministic fixture context
// ---------------------------------------------------------------------------

function fixtureCtx(): EvaluationContext {
  const ctx = createMinimalContext(
    {
      id: 'e1',
      x: 10, y: 20, vx: 1, vy: -2, width: 24, height: 24,
      playing: true, active: true, over: false, result: 'none', score: 5,
      body: { x: 10, y: 20, vx: 1, vy: 0, width: 24, height: 24, grounded: true },
      items: [1, 2, 3],
      name: 'test',
      sections: [{ title: 'a' }, { title: 'b' }],
    },
    { dir: 1, value: 5 },
    'active',
  );
  ctx.config = { moveSpeed: 200, scripts: [], gravity: 900 };
  ctx.now = 1000;
  return ctx;
}

// ---------------------------------------------------------------------------
// Comparison harness
// ---------------------------------------------------------------------------

/** Nondeterministic / side-effecting operator families skipped in the sweep. */
const SKIP_OPS = /^(math\/random|time\/now|time\/today|async\/|os\/|llm\/|integration\/|workspace\/|session\/|memory\/|trace\/|call-service|prob\/)/;

function treeSkippable(expr: RuntimeValue): boolean {
  if (Array.isArray(expr)) {
    if (typeof expr[0] === 'string' && SKIP_OPS.test(expr[0])) return true;
    return expr.some((item) => treeSkippable(item as RuntimeValue));
  }
  if (typeof expr === 'object' && expr !== null) {
    return Object.values(expr).some((v) => treeSkippable(v as RuntimeValue));
  }
  return false;
}

type Outcome = { kind: 'value'; value: RuntimeValue } | { kind: 'throw'; message: string };

function runInterpreted(tree: SExpr, ctx: EvaluationContext): Outcome {
  try {
    return { kind: 'value', value: normalize(new SExpressionEvaluator().evaluate(tree, ctx)) };
  } catch (err) {
    return { kind: 'throw', message: err instanceof Error ? err.message : String(err) };
  }
}

function runCompiled(tree: SExpr, ctx: EvaluationContext): Outcome {
  try {
    // Fresh evaluator so compile() is the only execution path measured.
    return { kind: 'value', value: normalize(new SExpressionEvaluator().compile(tree)(ctx)) };
  } catch (err) {
    return { kind: 'throw', message: err instanceof Error ? err.message : String(err) };
  }
}

/** Lambdas compare by type only; everything else deep-compares. */
function normalize(value: RuntimeValue): RuntimeValue {
  if (typeof value === 'function') return '<function>';
  if (Array.isArray(value)) return value.map((v) => normalize(v as RuntimeValue));
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normalize(v as RuntimeValue)]),
    );
  }
  return value;
}

function expectParity(tree: SExpr, label: string): void {
  const interpreted = runInterpreted(tree, fixtureCtx());
  const compiled = runCompiled(tree, fixtureCtx());
  expect(compiled, label).toEqual(interpreted);
}

// ---------------------------------------------------------------------------
// Unit corpus — one fixture per semantic family
// ---------------------------------------------------------------------------

describe('compile parity: unit corpus', () => {
  const corpus: Array<[string, SExpr]> = [
    ['arithmetic', ['+', ['*', '@entity.x', 2], ['/', '@entity.y', 4], ['-', 1]]],
    ['comparison chain', ['and', ['>=', '@entity.score', 3], ['!=', '@entity.result', 'none']]],
    ['or short-circuit value', ['or', '@entity.missing', 'fallback', 7]],
    ['and returns falsy value', ['and', true, 0, 5]],
    ['if lazy branch', ['if', ['>', '@entity.x', 5], ['*', '@entity.x', 10], ['-', '@entity.x']]],
    ['let sequential bindings', ['let', [['a', '@entity.x'], ['b', ['+', '@a', 1]]], ['*', '@a', '@b']]],
    ['fn lambda over map', ['array/map', '@entity.items', ['fn', 'n', ['*', '@n', 2]]]],
    ['fn multi-param reduce', ['array/reduce', '@entity.items', 0, ['fn', ['acc', 'n'], ['+', '@acc', '@n']]]],
    ['bracket-path binding', ['object/get', '@entity', 'sections[1].title']],
    ['plain-object reduction', { label: ['+', '@entity.x', 1], deep: { v: ['*', 2, 3] } }],
    ['literal array reduction', [['+', 1, 1], ['*', 2, 2], 'raw']],
    ['unknown-head data array', ['animations', 'static', ['+', 1, 2]]],
    ['empty array', []],
    ['nested do block', ['do', ['+', 1, 2], ['*', 3, 4]]],
    ['when truthy', ['when', ['==', '@entity.playing', true], ['+', 40, 2]]],
    ['string ops', ['str/concat', 'x=', '@entity.x', ' y=', '@entity.y']],
    ['object ops', ['object/keys', '@entity.body']],
    ['min/max/clamp', ['clamp', ['min', '@entity.x', '@entity.y'], 0, 100]],
    ['payload binding', ['+', '@payload.value', '@payload.dir']],
    ['config binding', ['*', '@config.moveSpeed', 2]],
    ['state binding', ['==', '@state', 'active']],
    ['filter + find', ['array/find', ['array/filter', '@entity.items', ['fn', 'n', ['>', '@n', 1]]], ['fn', 'm', ['==', '@m', 2]]]],
    ['nested let+if+lambda', ['let', [['xs', '@entity.items']], ['array/map', '@xs', ['fn', 'q', ['if', ['>', '@q', 1], '@q', 0]]]]],
  ];

  for (const [label, tree] of corpus) {
    it(label, () => expectParity(tree, label));
  }

  it('arity violation throws identically', () => {
    const bad = ['object/get'] as unknown as SExpr;
    expectParity(bad, 'arity throw parity');
  });

  it('effect sequence parity — handlers see identical calls', () => {
    const tree: SExpr[] = [
      ['set', '@entity.x', ['+', '@entity.x', 1]],
      ['emit', 'MOVED', { x: ['+', '@entity.x', 1] }],
      ['when', ['>', '@entity.x', 0], ['set', '@entity.score', 6]],
    ];
    const record = (): { ctx: EvaluationContext; calls: RuntimeValue[] } => {
      const calls: RuntimeValue[] = [];
      const ctx = fixtureCtx();
      ctx.mutateEntity = (changes) => { calls.push(['set', changes]); };
      ctx.emit = (event, payload) => { calls.push(['emit', event, payload ?? null]); };
      return { ctx, calls };
    };
    const a = record();
    new SExpressionEvaluator().executeEffects(tree, a.ctx);
    const b = record();
    const ev = new SExpressionEvaluator();
    for (const t of tree) ev.compile(t)(b.ctx);
    expect(b.calls).toEqual(a.calls);
  });
});

// ---------------------------------------------------------------------------
// Registry sweep — every guard/effects/tick tree in both behavior registries
// ---------------------------------------------------------------------------

function collectOrbFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = path.join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.orb')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function collectTrees(node: RuntimeValue, into: SExpr[]): void {
  if (Array.isArray(node)) {
    if (node.length > 0 && typeof node[0] === 'string') into.push(node as SExpr);
    for (const item of node) collectTrees(item as RuntimeValue, into);
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const v of Object.values(node)) collectTrees(v as RuntimeValue, into);
  }
}

describe('compile parity: registry sweep', () => {
  const registries = [
    path.join(here, '../../almadar-std/behaviors/registry'),
    path.join(here, '../../almadar-behaviors/behaviors/registry'),
  ].filter((dir) => existsSync(dir)); // absent in a standalone (extracted) clone
  const sweepAvailable = registries.length > 0;
  const trees: Array<{ file: string; tree: SExpr }> = [];
  for (const reg of registries) {
    for (const file of collectOrbFiles(reg)) {
      const orb = JSON.parse(readFileSync(file, 'utf-8')) as RuntimeValue;
      const found: SExpr[] = [];
      collectTrees(orb, found);
      for (const tree of found) {
        if (!treeSkippable(tree)) trees.push({ file: path.basename(file), tree });
      }
    }
  }

  it('sweep found a meaningful corpus', () => {
    if (!sweepAvailable) return; // standalone clone: no sibling registries
    expect(trees.length).toBeGreaterThan(1000);
  });

  it('every registry tree evaluates identically interpreted vs compiled', () => {
    if (!sweepAvailable) return;
    const mismatches: string[] = [];
    for (const { file, tree } of trees) {
      const interpreted = runInterpreted(tree, fixtureCtx());
      const compiled = runCompiled(tree, fixtureCtx());
      if (JSON.stringify(compiled) !== JSON.stringify(interpreted)) {
        mismatches.push(`${file}: ${JSON.stringify(tree).slice(0, 200)}`);
        if (mismatches.length >= 10) break;
      }
    }
    expect(mismatches).toEqual([]);
  });
});
