/**
 * Trace Module Runtime Evaluators
 *
 * Runtime implementations for trace/* operators.
 * No-op when ctx.trace is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export function evalTraceEmit(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): void {
  if (!ctx.trace) return;
  const event = evaluate(args[0], ctx) as string;
  const payload = args.length > 1 ? evaluate(args[1], ctx) : undefined;
  ctx.trace.emit(event, payload);
}

export function evalTraceLog(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): void {
  if (!ctx.trace) return;
  const message = evaluate(args[0], ctx) as string;
  const level = args.length > 1 ? (evaluate(args[1], ctx) as 'log' | 'warn' | 'error') : undefined;
  const data = args.length > 2 ? evaluate(args[2], ctx) : undefined;
  ctx.trace.log(message, level, data);
}
