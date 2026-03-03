/**
 * Probabilistic Operators Runtime Evaluators
 *
 * Runtime implementations for prob/* operators.
 * Provides distribution sampling, Bayesian inference via rejection sampling,
 * and statistical summary functions.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

// ============================================================================
// Seeded PRNG (Mulberry32)
// ============================================================================

/**
 * Mulberry32: 32-bit seeded PRNG with good distribution properties.
 * Returns a value in [0, 1).
 */
function mulberry32(seed: { state: number }): number {
  let t = (seed.state += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Get a random number in [0, 1), using seeded PRNG if available.
 */
function getRandom(ctx: EvaluationContext): number {
  if (ctx._probSeed) {
    return mulberry32(ctx._probSeed);
  }
  return Math.random();
}

// ============================================================================
// Distribution Helpers
// ============================================================================

/**
 * Gamma variate using Marsaglia-Tsang method.
 * For shape >= 1. For shape < 1, use the relation:
 *   gamma(shape) = gamma(shape+1) * U^(1/shape)
 */
function gammaVariate(shape: number, ctx: EvaluationContext): number {
  if (shape < 1) {
    const u = getRandom(ctx);
    return gammaVariate(shape + 1, ctx) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  for (;;) {
    let x: number;
    let v: number;
    do {
      x = gaussianStandard(ctx);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = getRandom(ctx);

    if (u < 1 - 0.0331 * (x * x) * (x * x)) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Standard normal (mean=0, sigma=1) via Box-Muller.
 */
function gaussianStandard(ctx: EvaluationContext): number {
  const u1 = getRandom(ctx);
  const u2 = getRandom(ctx);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ============================================================================
// Distribution Sampling (7 operators)
// ============================================================================

/**
 * prob/seed - Set seeded PRNG on context for deterministic results.
 */
export function evalProbSeed(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): void {
  const n = evaluate(args[0], ctx) as number;
  ctx._probSeed = { state: n | 0 };
}

/**
 * prob/flip - Bernoulli trial: returns true with probability p.
 */
export function evalProbFlip(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const p = evaluate(args[0], ctx) as number;
  return getRandom(ctx) < p;
}

/**
 * prob/gaussian - Sample from a Gaussian distribution (Box-Muller transform).
 */
export function evalProbGaussian(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const mu = evaluate(args[0], ctx) as number;
  const sigma = evaluate(args[1], ctx) as number;
  return mu + sigma * gaussianStandard(ctx);
}

/**
 * prob/uniform - Sample from a uniform distribution [lo, hi).
 */
export function evalProbUniform(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const lo = evaluate(args[0], ctx) as number;
  const hi = evaluate(args[1], ctx) as number;
  return lo + getRandom(ctx) * (hi - lo);
}

/**
 * prob/beta - Sample from a Beta(alpha, beta) distribution.
 * Uses gamma variate ratio (Marsaglia-Tsang for gamma).
 */
export function evalProbBeta(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const alpha = evaluate(args[0], ctx) as number;
  const beta = evaluate(args[1], ctx) as number;
  const x = gammaVariate(alpha, ctx);
  const y = gammaVariate(beta, ctx);
  return x / (x + y);
}

/**
 * prob/categorical - Weighted random selection from items.
 */
export function evalProbCategorical(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown {
  const items = evaluate(args[0], ctx) as unknown[];
  const weights = evaluate(args[1], ctx) as number[];

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let r = getRandom(ctx) * totalWeight;

  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }

  return items[items.length - 1];
}

/**
 * prob/poisson - Sample from a Poisson distribution (Knuth's algorithm).
 */
export function evalProbPoisson(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const lambda = evaluate(args[0], ctx) as number;
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= getRandom(ctx);
  } while (p > limit);

  return k - 1;
}

// ============================================================================
// Inference (4 operators)
// ============================================================================

/**
 * prob/condition - Mark the current sample as rejected if predicate is false.
 * Used inside model expressions evaluated by prob/posterior and prob/infer.
 */
export function evalProbCondition(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): void {
  const predicate = evaluate(args[0], ctx);
  if (!predicate) {
    ctx._probRejected = true;
  }
}

/**
 * prob/sample - Evaluate an expression n times and collect results.
 * args[1] is evaluated lazily (re-evaluated each iteration).
 */
export function evalProbSample(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const n = evaluate(args[0], ctx) as number;
  const exprAst = args[1]; // lazy: don't evaluate, re-eval each iteration

  const results: unknown[] = [];
  for (let i = 0; i < n; i++) {
    results.push(evaluate(exprAst, ctx));
  }
  return results;
}

/**
 * prob/posterior - Rejection sampling. Returns accepted query values.
 * args: [model, evidence, query, n] (all lazy except n)
 *
 * For each sample:
 *   1. Create fresh child context with shallow-copied entity
 *   2. Evaluate model (may call prob/flip, prob/gaussian, prob/condition, set, etc.)
 *   3. Check if _probRejected was set by prob/condition
 *   4. If not rejected, evaluate evidence (boolean)
 *   5. If evidence passes, evaluate query and collect result
 */
export function evalProbPosterior(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): unknown[] {
  const modelAst = args[0];
  const evidenceAst = args[1];
  const queryAst = args[2];
  const n = evaluate(args[3], ctx) as number;

  const results: unknown[] = [];

  for (let i = 0; i < n; i++) {
    // Fresh child context per sample (shallow-copy entity for isolation)
    const sampleEntity = { ...ctx.entity };
    const sampleCtx: EvaluationContext = {
      ...ctx,
      entity: sampleEntity,
      _probRejected: false,
      mutateEntity: (changes: Record<string, unknown>) => {
        Object.assign(sampleEntity, changes);
      },
    };

    // Run the model
    evaluate(modelAst, sampleCtx);

    // Check if prob/condition rejected this sample
    if (sampleCtx._probRejected) continue;

    // Evaluate evidence
    const evidenceResult = evaluate(evidenceAst, sampleCtx);
    if (!evidenceResult) continue;

    // Collect query value
    results.push(evaluate(queryAst, sampleCtx));
  }

  return results;
}

/**
 * prob/infer - Like posterior but returns summary statistics.
 * Returns { mean, variance, samples, acceptRate }.
 */
export function evalProbInfer(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): { mean: number; variance: number; samples: number[]; acceptRate: number } {
  const modelAst = args[0];
  const evidenceAst = args[1];
  const queryAst = args[2];
  const n = evaluate(args[3], ctx) as number;

  const accepted: number[] = [];

  for (let i = 0; i < n; i++) {
    const sampleEntity = { ...ctx.entity };
    const sampleCtx: EvaluationContext = {
      ...ctx,
      entity: sampleEntity,
      _probRejected: false,
      mutateEntity: (changes: Record<string, unknown>) => {
        Object.assign(sampleEntity, changes);
      },
    };

    evaluate(modelAst, sampleCtx);

    if (sampleCtx._probRejected) continue;

    const evidenceResult = evaluate(evidenceAst, sampleCtx);
    if (!evidenceResult) continue;

    const queryVal = evaluate(queryAst, sampleCtx) as number;
    accepted.push(queryVal);
  }

  const count = accepted.length;
  if (count === 0) {
    return { mean: 0, variance: 0, samples: [], acceptRate: 0 };
  }

  const mean = accepted.reduce((s, v) => s + v, 0) / count;
  const variance = accepted.reduce((s, v) => s + (v - mean) ** 2, 0) / count;

  return {
    mean,
    variance,
    samples: accepted,
    acceptRate: count / n,
  };
}

// ============================================================================
// Statistics (5 operators)
// ============================================================================

/**
 * prob/expected-value - Mean of numeric samples.
 */
export function evalProbExpectedValue(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const samples = evaluate(args[0], ctx) as number[];
  if (samples.length === 0) return 0;
  return samples.reduce((s, v) => s + v, 0) / samples.length;
}

/**
 * prob/variance - Population variance of numeric samples.
 */
export function evalProbVariance(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const samples = evaluate(args[0], ctx) as number[];
  if (samples.length === 0) return 0;
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
}

/**
 * prob/histogram - Bin numeric samples into a histogram.
 * Returns { binEdges: number[], counts: number[] }.
 */
export function evalProbHistogram(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): { binEdges: number[]; counts: number[] } {
  const samples = evaluate(args[0], ctx) as number[];
  const bins = evaluate(args[1], ctx) as number;

  if (samples.length === 0) {
    return { binEdges: [], counts: [] };
  }

  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const binWidth = (max - min) / bins || 1;

  const binEdges: number[] = [];
  const counts: number[] = new Array(bins).fill(0) as number[];

  for (let i = 0; i <= bins; i++) {
    binEdges.push(min + i * binWidth);
  }

  for (const s of samples) {
    let idx = Math.floor((s - min) / binWidth);
    if (idx >= bins) idx = bins - 1; // clamp last value into final bin
    counts[idx]++;
  }

  return { binEdges, counts };
}

/**
 * prob/percentile - Get the p-th percentile (0-100) from sorted samples.
 */
export function evalProbPercentile(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const samples = evaluate(args[0], ctx) as number[];
  const p = evaluate(args[1], ctx) as number;

  if (samples.length === 0) return 0;

  const sorted = [...samples].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);

  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * prob/credible-interval - Compute symmetric credible interval.
 * alpha=0.05 gives 95% interval. Returns [lo, hi].
 */
export function evalProbCredibleInterval(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): [number, number] {
  const samples = evaluate(args[0], ctx) as number[];
  const alpha = evaluate(args[1], ctx) as number;

  if (samples.length === 0) return [0, 0];

  const sorted = [...samples].sort((a, b) => a - b);
  const loIdx = Math.floor((alpha / 2) * (sorted.length - 1));
  const hiIdx = Math.ceil((1 - alpha / 2) * (sorted.length - 1));

  return [sorted[loIdx], sorted[hiIdx]];
}
