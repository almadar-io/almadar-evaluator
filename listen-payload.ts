/**
 * The canonical evaluator for `listens { … with { field: <expr> } }` mapping
 * values.
 *
 * `@almadar/core` owns the mapping contract (`applyListenPayloadMapping`) but
 * sits upstream of this package and cannot evaluate. Every delivery path — the
 * server runtime and the client cross-trait wiring — passes THIS function, so
 * the two paths cannot drift into different `with{}` semantics.
 *
 * The binding context is payload-only, matching `orbital-core`'s listener
 * fan-out (`runtime/listener.rs:107-109`, `runtime/kernel.rs:687-689`), which
 * builds `BindingContextBuilder::new().payload(…).build()`. Binding `@entity`
 * or `@config` here would let a mapping resolve on the JS path and silently
 * yield nothing on the compiled one.
 *
 * @packageDocumentation
 */

import type { ListenPayloadEvaluator, RuntimeValue } from '@almadar/core';
import { createMinimalContext } from './context.js';
import { evaluate } from './SExpressionEvaluator.js';

export const evaluateListenPayloadExpr: ListenPayloadEvaluator = (expr, payload) =>
  evaluate(expr, createMinimalContext({}, payload)) as RuntimeValue;
