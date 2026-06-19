/**
 * Noise Module Runtime Evaluators
 *
 * Runtime implementations for noise/* operators (perlin, simplex, fbm).
 * Output range [-1, 1]. Pure + deterministic; byte-identical with the Rust impl.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

// Permutation table — copied VERBATIM and shared with the Rust impl for parity.
const PERM: number[] = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36,
  103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0,
  26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56,
  87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77,
  146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46,
  245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187,
  208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173,
  186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85,
  212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119,
  248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39,
  253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228,
  251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249,
  14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
  50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141,
  128, 195, 78, 66, 215, 61, 156, 180,
];

function p(i: number): number {
  return PERM[i & 255];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad2(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function perlin(x: number, y: number, seed: number): number {
  const s = Math.floor(seed) & 255;
  const X = (Math.floor(x) + s) & 255;
  const Y = (Math.floor(y) + s) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = p(p(X) + Y);
  const ab = p(p(X) + Y + 1);
  const ba = p(p(X + 1) + Y);
  const bb = p(p(X + 1) + Y + 1);
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1.0, yf), u);
  const x2 = lerp(grad2(ab, xf, yf - 1.0), grad2(bb, xf - 1.0, yf - 1.0), u);
  return lerp(x1, x2, v);
}

function simplex(x: number, y: number, seed: number): number {
  return (
    (perlin(x, y, seed) +
      perlin(x * 2 + 5.2, y * 2 + 1.3, seed) * 0.5 +
      perlin(x * 4 + 9.1, y * 4 + 7.7, seed) * 0.25) /
    1.75
  );
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let n = Math.floor(octaves);
  if (n < 1) n = 1;
  if (n > 8) n = 8;
  let total = 0;
  let freq = 1;
  let amp = 1;
  let max = 0;
  for (let i = 0; i < n; i++) {
    total += perlin(x * freq, y * freq, seed) * amp;
    max += amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return total / max;
}

/**
 * noise/perlin - 2D Perlin noise (x, y?, seed?) → number [-1,1]
 */
export function evalNoisePerlin(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const x = evaluate(args[0], ctx) as number;
  const y = args.length > 1 ? (evaluate(args[1], ctx) as number) : 0;
  const seed = args.length > 2 ? (evaluate(args[2], ctx) as number) : 0;
  return perlin(x, y, seed);
}

/**
 * noise/simplex - value-coherent noise (perlin-derived) (x, y, seed?) → number [-1,1]
 */
export function evalNoiseSimplex(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const x = evaluate(args[0], ctx) as number;
  const y = evaluate(args[1], ctx) as number;
  const seed = args.length > 2 ? (evaluate(args[2], ctx) as number) : 0;
  return simplex(x, y, seed);
}

/**
 * noise/fbm - fractal Brownian motion (x, y, octaves, seed?) → number [-1,1]
 */
export function evalNoiseFbm(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const x = evaluate(args[0], ctx) as number;
  const y = evaluate(args[1], ctx) as number;
  const octaves = evaluate(args[2], ctx) as number;
  const seed = args.length > 3 ? (evaluate(args[3], ctx) as number) : 0;
  return fbm(x, y, octaves, seed);
}
