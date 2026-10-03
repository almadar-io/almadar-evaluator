/**
 * Typed evaluation errors — twins of orbital-core `EvalError` (src/error.rs),
 * same message text, so both execution paths report a failure identically.
 *
 * @packageDocumentation
 */

/** The value's type as orbital-core's `Value::type_name` names it (undefined is `null`). */
export function runtimeTypeName(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'function') return 'function';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/** `EvalError::TypeMismatch`: an operator got a value of the wrong type. */
export class EvalTypeMismatchError extends Error {
  readonly expected: string;
  readonly actual: string;

  constructor(expected: string, actual: string) {
    super(`Type mismatch: expected ${expected}, got ${actual}`);
    this.name = 'EvalTypeMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}
