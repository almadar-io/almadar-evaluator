/**
 * Benchmark: interpreted vs compiled evaluation of the real physics tick.
 *
 * Loads std-platformer-body's physicsTick (722-node SExpr tree) and
 * std-patrol-hazard's patrolTick from the std registry and times
 * interpreted (first-sight, fresh evaluator) vs compiled (`compile()`)
 * execution. Run: `npx tsx bench/physics-tick.ts` from the package root.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SExpressionEvaluator } from '../SExpressionEvaluator.js';
import { createMinimalContext } from '../context.js';
import type { SExpr } from '../types/expression.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function loadTick(rel: string, tickName: string): SExpr[] {
  const orb = JSON.parse(readFileSync(path.join(here, '../../almadar-std/behaviors/registry', rel), 'utf-8')) as {
    orbitals?: Array<{ traits?: Array<{ ticks?: Array<{ name: string; effects: SExpr[] }> }> }>;
    traits?: Array<{ ticks?: Array<{ name: string; effects: SExpr[] }> }>;
  };
  const traits = orb.orbitals?.flatMap((o) => o.traits ?? []) ?? orb.traits ?? [];
  for (const t of traits) {
    for (const tick of t.ticks ?? []) {
      if (tick.name === tickName) return tick.effects;
    }
  }
  throw new Error(`tick ${tickName} not found in ${rel}`);
}

const physicsTick = loadTick('ui/game/atoms/std-platformer-body.orb', 'physicsTick');
const patrolTick = loadTick('ui/game/atoms/std-patrol-hazard.orb', 'patrolTick');

const ctx = createMinimalContext(
  {
    id: 'board',
    x: 100, y: 100, vx: 3, vy: 0, width: 24, height: 24,
    grounded: false, playing: true, over: false, fell: false,
    skatings: false,
    body: { x: 100, y: 100, vx: 3, vy: 0, width: 24, height: 24, grounded: false },
    patrols: [{ x: 50, dir: 1, min: 0, max: 200 }],
  },
  {},
  'active',
);
// Silent handlers so effect warnings don't dominate the timing.
ctx.mutateEntity = () => undefined;
ctx.emit = () => undefined;
ctx.config = {
  moveSpeed: 220, jumpSpeed: 620, gravity: 1800, killY: 900,
  platforms: [
    { x: 0, y: 500, width: 800, height: 40 },
    { x: 200, y: 400, width: 200, height: 20 },
  ],
  hazards: [], goals: [], skate: false, skateCurve: [], skateSnap: 10,
};

const ITERATIONS = 10_000;

function bench(label: string, effects: SExpr[]): void {
  // Interpreted: fresh evaluator each iteration would re-mark; the honest
  // comparison is one evaluator running interpreted (first sight) — emulate
  // by clearing the cache so every call interprets.
  const interp = new SExpressionEvaluator();
  const t0 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    interp.clearCache();
    for (const e of effects) interp.evaluate(e, ctx);
  }
  const interpMs = performance.now() - t0;

  const comp = new SExpressionEvaluator();
  const compiled = effects.map((e) => comp.compile(e));
  const t1 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    for (const fn of compiled) fn(ctx);
  }
  const compMs = performance.now() - t1;

  console.log(`${label}: interpreted ${(interpMs).toFixed(0)}ms, compiled ${compMs.toFixed(0)}ms, speedup ${(interpMs / compMs).toFixed(1)}x`);
}

bench('physicsTick (722 nodes)', physicsTick);
bench('patrolTick (183 nodes)', patrolTick);
bench('physicsTick + patrolTick (folded frame)', [...physicsTick, ...patrolTick]);
