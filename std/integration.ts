/**
 * Integration Module Runtime Evaluators
 *
 * Runtime implementations for integration/* operators.
 * Returns null when ctx.integration is undefined.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

export function evalIntegrationHttp(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.integration) return null;
  const method = evaluate(args[0], ctx) as string;
  const url = evaluate(args[1], ctx) as string;
  const body = args.length > 2 ? evaluate(args[2], ctx) : undefined;
  const headers = args.length > 3 ? (evaluate(args[3], ctx) as Record<string, string>) : undefined;
  return ctx.integration.http(method, url, body, headers);
}

export function evalIntegrationGithubGetRepo(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.integration) return null;
  const owner = evaluate(args[0], ctx) as string;
  const repo = evaluate(args[1], ctx) as string;
  return ctx.integration.githubGetRepo(owner, repo);
}

export function evalIntegrationGithubCreateIssue(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): Promise<unknown> | null {
  if (!ctx.integration) return null;
  const owner = evaluate(args[0], ctx) as string;
  const repo = evaluate(args[1], ctx) as string;
  const title = evaluate(args[2], ctx) as string;
  const body = args.length > 3 ? (evaluate(args[3], ctx) as string) : undefined;
  return ctx.integration.githubCreateIssue(owner, repo, title, body);
}
