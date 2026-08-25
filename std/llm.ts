/**
 * LLM Module Runtime Evaluators
 *
 * Runtime implementations for llm/* operators.
 * Pure operators return safe defaults when ctx.llm is undefined.
 * Effect operators return null when ctx.llm is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';
import type { LlmMessage, LlmToolDef } from '@almadar/core';
import type { RuntimeValue } from '@almadar/core';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export function evalLlmGenerate(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Promise<string> | null {
  if (!ctx.llm) return null;
  const prompt = evaluate(args[0], ctx) as string;
  const options = args.length > 1 ? (evaluate(args[1], ctx) as { json?: boolean; maxTokens?: number; provider?: string; model?: string }) : undefined;
  return ctx.llm.generate(prompt, options);
}

export function evalLlmCallTools(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Promise<unknown> | null {
  if (!ctx.llm) return null;
  const messages = evaluate(args[0], ctx) as LlmMessage[];
  const tools = evaluate(args[1], ctx) as LlmToolDef[];
  return ctx.llm.callTools(messages, tools);
}

export function evalLlmEmbed(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Promise<number[][]> | null {
  if (!ctx.llm) return null;
  const texts = evaluate(args[0], ctx) as string[];
  return ctx.llm.embed(texts);
}

export function evalLlmTokenCount(
  _args: SExpr[],
  _evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  if (!ctx.llm) return 0;
  return ctx.llm.tokenCount();
}

export function evalLlmSwitch(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): RuntimeValue {
  if (!ctx.llm) return;
  const provider = evaluate(args[0], ctx) as string;
  const model = args.length > 1 ? (evaluate(args[1], ctx) as string) : undefined;
  ctx.llm.switchProvider(provider, model);
}

export function evalLlmCompact(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Promise<{ before: number; after: number }> | null {
  if (!ctx.llm) return null;
  const strategy = args.length > 0 ? (evaluate(args[0], ctx) as string) : undefined;
  return ctx.llm.compact(strategy);
}
