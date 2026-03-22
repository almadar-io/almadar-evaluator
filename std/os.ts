/**
 * OS Module - Operating System Event Watchers
 *
 * Evaluator implementations for os/* operators.
 * These operators register OS-level watchers via the runtime bridge.
 * Server-side only.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type Evaluator = (expr: SExpr, ctx: EvaluationContext) => unknown;

function registerTrigger(
  ctx: EvaluationContext,
  type: string,
  config: Record<string, unknown>,
): void {
  const bridge = (ctx as unknown as Record<string, unknown>).registerOsTrigger as
    | ((type: string, config: Record<string, unknown>) => void)
    | undefined;
  if (bridge) {
    bridge(type, config);
  }
}

export function evalOsWatchFiles(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const glob = evaluate(args[0], ctx) as string;
  const options = args[1] ? (evaluate(args[1], ctx) as Record<string, unknown>) : {};
  registerTrigger(ctx, 'watch-files', { glob, ...options });
}

export function evalOsWatchProcess(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const name = evaluate(args[0], ctx) as string;
  const subcommand = args[1] ? (evaluate(args[1], ctx) as string) : undefined;
  registerTrigger(ctx, 'watch-process', { name, subcommand });
}

export function evalOsWatchPort(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const port = evaluate(args[0], ctx) as number;
  const protocol = args[1] ? (evaluate(args[1], ctx) as string) : 'tcp';
  registerTrigger(ctx, 'watch-port', { port, protocol });
}

export function evalOsWatchHttp(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const urlPattern = evaluate(args[0], ctx) as string;
  const method = args[1] ? (evaluate(args[1], ctx) as string) : undefined;
  registerTrigger(ctx, 'watch-http', { urlPattern, method });
}

export function evalOsWatchCron(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const expression = evaluate(args[0], ctx) as string;
  registerTrigger(ctx, 'watch-cron', { expression });
}

export function evalOsWatchSignal(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const signal = evaluate(args[0], ctx) as string;
  registerTrigger(ctx, 'watch-signal', { signal });
}

export function evalOsWatchEnv(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const variable = evaluate(args[0], ctx) as string;
  registerTrigger(ctx, 'watch-env', { variable });
}

export function evalOsDebounce(args: SExpr[], evaluate: Evaluator, ctx: EvaluationContext): void {
  const ms = evaluate(args[0], ctx) as number;
  const eventType = evaluate(args[1], ctx) as string;
  registerTrigger(ctx, 'debounce', { ms, eventType });
}
