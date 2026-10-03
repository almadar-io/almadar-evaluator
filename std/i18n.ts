/**
 * I18n Module Runtime Evaluators
 *
 * `i18n/t` — the active locale's message for a catalog key. Keys arrive
 * qualified with their behavior's name (the compiler qualifies them), and
 * `orb validate` checks every key against every declared locale, so a
 * missing message here is an error, never a fallback.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

/**
 * i18n/t - The active locale's message, with {{placeholders}} filled from params
 */
export function evalI18nT(args: SExpr[], evaluate: EvalFn, ctx: EvaluationContext): string {
  const key = String(evaluate(args[0], ctx));
  const message = ctx.messages?.[key];
  if (message === undefined) {
    throw new Error(`i18n/t: no \`${ctx.locale ?? 'unset'}\` message for \`${key}\``);
  }
  if (args.length < 2) return message;
  const params = evaluate(args[1], ctx);
  if (typeof params !== 'object' || params === null || Array.isArray(params)) return message;
  let out = message;
  for (const [name, value] of Object.entries(params)) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
}
