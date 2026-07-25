/**
 * Data Operators Runtime Evaluators
 *
 * Runtime implementations for data/* operators — dataset/dataloader
 * creation, splitting, normalization, augmentation, tokenization and
 * padding. Mirrors `data_helpers.py`
 * (`orbital-rust/crates/orbital-shell-python/src/backend.rs`, generator
 * `generate_data_helpers`) semantically. Tensors are plain JSON (see
 * contract.ts's `TensorValue`); a "dataset" is `{ data, config }` standing
 * in for Python's `OrbitalDataset`.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { TensorValue } from './contract.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export interface DatasetValue {
  data: unknown[];
  config: Record<string, unknown>;
}

export interface DataBatch {
  x: TensorValue[];
  y: TensorValue[];
}

export interface DataLoaderValue {
  batches: DataBatch[];
  batchSize: number;
  numBatches: number;
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Mirrors OrbitalDataset.__getitem__: dict -> (input/observation, target/output); list/tuple -> (item, item); else -> (item, item) verbatim. */
function datasetGetItem(dataset: DatasetValue, idx: number): [TensorValue, TensorValue] {
  const item = dataset.data[idx];
  if (isPlainRecord(item)) {
    const x = (item.input ?? item.observation ?? []) as TensorValue;
    const y = (item.target ?? item.output ?? []) as TensorValue;
    return [x, y];
  }
  if (Array.isArray(item)) {
    return [item as TensorValue, item as TensorValue];
  }
  return [item as TensorValue, item as TensorValue];
}

/**
 * Minimal local mirror of prob.ts's seeded Mulberry32 PRNG (that module's
 * helpers are private/unexported, and this file must not touch prob.ts).
 * Reuses `ctx._probSeed` so `prob/seed` also makes data/* shuffling and
 * data/augment's noise deterministic.
 */
function seededRandom(ctx: EvaluationContext): number {
  if (ctx._probSeed) {
    const seed = ctx._probSeed;
    let t = (seed.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return Math.random();
}

function seededGaussian(ctx: EvaluationContext): number {
  const u1 = seededRandom(ctx);
  const u2 = seededRandom(ctx);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function shuffleInPlace(arr: number[], ctx: EvaluationContext): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(ctx) * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function tensorShape(t: TensorValue): number[] {
  if (typeof t === 'number') return [];
  if (t.length === 0) return [0];
  const first = t[0];
  if (typeof first === 'number') return [t.length];
  return [t.length, ...tensorShape(first)];
}

function rank(t: TensorValue): number {
  return tensorShape(t).length;
}

function sampleMean(vals: number[]): number {
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

/** Sample (n-1 denominator) standard deviation, matching torch's default `unbiased=True`. */
function sampleStd(vals: number[], mean: number): number {
  if (vals.length <= 1) return 0;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

function normalizeZScore(t: TensorValue): TensorValue {
  if (rank(t) <= 1) {
    const vals = t as number[];
    const mean = sampleMean(vals);
    const std = Math.max(sampleStd(vals, mean), 1e-8);
    return vals.map((v) => (v - mean) / std);
  }
  const rows = t as number[][];
  const cols = rows[0].length;
  const means: number[] = [];
  const stds: number[] = [];
  for (let c = 0; c < cols; c++) {
    const col = rows.map((r) => r[c]);
    const m = sampleMean(col);
    means.push(m);
    stds.push(Math.max(sampleStd(col, m), 1e-8));
  }
  return rows.map((r) => r.map((v, c) => (v - means[c]) / stds[c]));
}

function normalizeMinMax(t: TensorValue): TensorValue {
  if (rank(t) <= 1) {
    const vals = t as number[];
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const denom = Math.max(mx - mn, 1e-8);
    return vals.map((v) => (v - mn) / denom);
  }
  const rows = t as number[][];
  const cols = rows[0].length;
  const mins: number[] = [];
  const maxs: number[] = [];
  for (let c = 0; c < cols; c++) {
    const col = rows.map((r) => r[c]);
    mins.push(Math.min(...col));
    maxs.push(Math.max(...col));
  }
  return rows.map((r) => r.map((v, c) => (v - mins[c]) / Math.max(maxs[c] - mins[c], 1e-8)));
}

function mapTensor(t: TensorValue, fn: (v: number) => number): TensorValue {
  if (typeof t === 'number') return fn(t);
  return t.map((sub) => mapTensor(sub, fn));
}

function padOrTruncateLastDim(t: TensorValue, targetLen: number, padValue: number): TensorValue {
  if (typeof t === 'number') return t;
  if (t.length === 0 || typeof t[0] === 'number') {
    const row = t as number[];
    if (row.length < targetLen) {
      return [...row, ...new Array(targetLen - row.length).fill(padValue)];
    }
    return row.slice(0, targetLen);
  }
  return t.map((sub) => padOrTruncateLastDim(sub, targetLen, padValue));
}

// ============================================================================
// Dataset Creation
// ============================================================================

/** data/dataset - Wrap a raw entity array with a preprocessing config, matching `data_dataset`. */
export function evalDataDataset(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): DatasetValue {
  const data = evaluate(args[0], ctx);
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  return { data: Array.isArray(data) ? data : [], config };
}

/**
 * data/dataloader - Materialize batches of `(x, y)` item pairs. `shuffle`
 * defaults true; `batchSize`/`batch_size` defaults 32, matching
 * `data_dataloader`'s `DataLoader` construction. There is no dependency-free
 * JS equivalent of a *lazy* torch DataLoader iterator, so batches are
 * eagerly materialized here — the deterministic, dependency-free stand-in.
 */
export function evalDataDataloader(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): DataLoaderValue {
  const dataset = evaluate(args[0], ctx) as DatasetValue;
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  const batchSize = (config.batchSize ?? config.batch_size ?? 32) as number;
  const shuffle = (config.shuffle ?? true) as boolean;

  const indices = Array.from({ length: dataset.data.length }, (_, i) => i);
  if (shuffle) shuffleInPlace(indices, ctx);

  const batches: DataBatch[] = [];
  for (let i = 0; i < indices.length; i += batchSize) {
    const chunk = indices.slice(i, i + batchSize);
    const x: TensorValue[] = [];
    const y: TensorValue[] = [];
    for (const idx of chunk) {
      const [xi, yi] = datasetGetItem(dataset, idx);
      x.push(xi);
      y.push(yi);
    }
    batches.push({ x, y });
  }
  return { batches, batchSize, numBatches: batches.length };
}

/** data/split - Random train/test split via `trainRatio`/`train_ratio` (default 0.8), matching `data_split`. */
export function evalDataSplit(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): [DatasetValue, DatasetValue] {
  const dataset = evaluate(args[0], ctx) as DatasetValue;
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  const ratio = (config.trainRatio ?? config.train_ratio ?? 0.8) as number;

  const trainSize = Math.trunc(dataset.data.length * ratio);
  const indices = Array.from({ length: dataset.data.length }, (_, i) => i);
  shuffleInPlace(indices, ctx);
  const trainIdx = indices.slice(0, trainSize);
  const testIdx = indices.slice(trainSize);

  return [
    { data: trainIdx.map((i) => dataset.data[i]), config: dataset.config },
    { data: testIdx.map((i) => dataset.data[i]), config: dataset.config },
  ];
}

// ============================================================================
// Preprocessing
// ============================================================================

/**
 * data/normalize - `method: "zscore"` (default) or `"minmax"`, per-column
 * over a `[N, D]` matrix or globally over a flat `[D]` vector — matches
 * `data_normalize`'s `dim=0` reduction. An unrecognized method returns the
 * tensor unchanged, matching Python's fallthrough `return t`.
 */
export function evalDataNormalize(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): TensorValue {
  const data = evaluate(args[0], ctx) as TensorValue;
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  const method = (config.method as string | undefined) ?? 'zscore';
  if (method === 'zscore') return normalizeZScore(data);
  if (method === 'minmax') return normalizeMinMax(data);
  return data;
}

/**
 * data/augment - Gaussian noise injection, `noiseScale`/`noise_scale`
 * default 0.01, matching `data_augment`. NOTE: the std/data.ts metadata
 * example (`{ "flip": true, "rotate": 15 }`) implies image-style
 * augmentation, but `data_augment` only ever reads `noiseScale`/`noise_scale`
 * — flip/rotate are undocumented no-ops on the Python path. Implemented to
 * match what `data_augment` actually does.
 */
export function evalDataAugment(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): TensorValue {
  const data = evaluate(args[0], ctx) as TensorValue;
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  const noiseScale = (config.noiseScale ?? config.noise_scale ?? 0.01) as number;
  return mapTensor(data, (v) => v + seededGaussian(ctx) * noiseScale);
}

// ============================================================================
// Tokenization & Padding
// ============================================================================

/**
 * data/tokenize - `config.mode` `"char"` (default, per-codepoint `ord`) or
 * `"word"` (whitespace split, `config.vocab` lookup, OOV -> 0), matching
 * `data_tokenize`. NOTE: the std/data.ts metadata calls the knob "method"
 * with a "bpe" example and a "max-length" cap — `data_tokenize` reads
 * `mode` (not "method") and has no BPE or length-capping support at all.
 * Implemented to match `data_tokenize`'s actual `mode` key and char/word
 * behavior, per this task's brief.
 */
export function evalDataTokenize(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): number[] {
  const text = evaluate(args[0], ctx);
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  const mode = (config.mode as string | undefined) ?? 'char';
  const textStr = String(text);

  if (mode === 'word') {
    const vocab = (config.vocab as Record<string, number> | undefined) ?? {};
    return textStr
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => vocab[w] ?? 0);
  }
  return Array.from(textStr).map((c) => c.codePointAt(0) ?? 0);
}

/** data/pad - Pad (with `padValue`/`pad_value`, default 0) or truncate the last axis to `length`/`targetLength`, matching `data_pad`. */
export function evalDataPad(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): TensorValue {
  const data = evaluate(args[0], ctx) as TensorValue;
  const config = evaluate(args[1], ctx) as Record<string, unknown>;
  const currentLen = (() => {
    const shape = tensorShape(data);
    return shape.length === 0 ? 0 : shape[shape.length - 1];
  })();
  const targetLen = (config.length ?? config.targetLength ?? currentLen) as number;
  const padValue = (config.padValue ?? config.pad_value ?? 0) as number;
  return padOrTruncateLastDim(data, targetLen, padValue);
}
