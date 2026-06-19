/**
 * Animation Module Runtime Evaluators
 *
 * Runtime implementations for anim/* operators.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

/**
 * anim/frame-at - select frame index for elapsed time
 * i = floor(elapsed/frameDur); loop default true → i % frameCount;
 * else min(i, frameCount-1)
 */
export function evalAnimFrameAt(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const elapsed = evaluate(args[0], ctx) as number;
  const frameDur = evaluate(args[1], ctx) as number;
  const frameCount = evaluate(args[2], ctx) as number;
  const loop = args.length > 3 ? Boolean(evaluate(args[3], ctx)) : true;
  if (frameCount <= 0) {
    return 0;
  }
  const i = Math.floor(elapsed / frameDur);
  if (loop) {
    return ((i % frameCount) + frameCount) % frameCount;
  }
  return Math.min(i, frameCount - 1);
}

/**
 * anim/sheet-rect - sprite-sheet source rect for a frame index
 * {sx:(frameIndex%cols)*frameW, sy:floor(frameIndex/cols)*frameH, sw:frameW, sh:frameH}
 */
export function evalAnimSheetRect(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): { sx: number; sy: number; sw: number; sh: number } {
  const frameIndex = evaluate(args[0], ctx) as number;
  const cols = evaluate(args[1], ctx) as number;
  const frameW = evaluate(args[2], ctx) as number;
  const frameH = evaluate(args[3], ctx) as number;
  return {
    sx: (frameIndex % cols) * frameW,
    sy: Math.floor(frameIndex / cols) * frameH,
    sw: frameW,
    sh: frameH,
  };
}

/**
 * anim/direction-from-delta - cardinal/diagonal facing from a movement delta.
 * ways default 4. angle = atan2(dy,dx) in (-PI,PI]. Buckets are chosen by the
 * nearest 1/ways slice of the circle (sector width = 2PI/ways), centered on the
 * axis directions, so the result is symmetric and identical across languages.
 * Screen coords (y grows downward): +dy → "down", -dy → "up".
 */
export function evalAnimDirectionFromDelta(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  const dx = evaluate(args[0], ctx) as number;
  const dy = evaluate(args[1], ctx) as number;
  const ways = args.length > 2 ? (evaluate(args[2], ctx) as number) : 4;
  const angle = Math.atan2(dy, dx); // (-PI, PI]
  const twoPi = Math.PI * 2;
  if (ways === 8) {
    // 8 sectors of PI/4; sector 0 centered on +x ("right"), increasing CCW
    // in math but +y is screen-down so we keep atan2(dy,dx) directly.
    const sector = Math.round(angle / (Math.PI / 4));
    const idx = ((sector % 8) + 8) % 8;
    const dirs8 = [
      'right',
      'down-right',
      'down',
      'down-left',
      'left',
      'up-left',
      'up',
      'up-right',
    ];
    return dirs8[idx];
  }
  // 4-way: nearest axis, sectors of PI/2 centered on right/down/left/up
  const sector = Math.round(angle / (Math.PI / 2));
  const idx = ((sector % 4) + 4) % 4;
  const dirs4 = ['right', 'down', 'left', 'up'];
  return dirs4[idx];
}
