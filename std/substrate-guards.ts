/**
 * Runtime guards for the interpreter → typed-substrate boundary.
 *
 * `isFieldValue`, `isEventPayloadValue`, `isSessionHistoryEntry`, and
 * `isPlanSnapshot` are owned by `@almadar/core` beside their types and
 * re-exported here for the std/* seam modules. `isOrbital` and
 * `isOrbitalSchemaValue` live here: they bridge core's zod schemas to its
 * hand-written interfaces as `unknown`-accepting predicates.
 *
 * @packageDocumentation
 */

import {
  OrbitalZodSchema,
  safeParseOrbitalSchema,
  type Orbital,
  type OrbitalSchema,
  type RuntimeValue,
} from '@almadar/core';

export {
  isFieldValue,
  isEventPayloadValue,
  isSessionHistoryEntry,
  isPlanSnapshot,
} from '@almadar/core';

/** Deep zod validation bridging to core's hand-written `Orbital` interface. */
export function isOrbital(value: RuntimeValue): value is Orbital {
  return OrbitalZodSchema.safeParse(value).success;
}

/** Deep zod validation bridging to core's hand-written `OrbitalSchema` interface. */
export function isOrbitalSchemaValue(value: RuntimeValue): value is OrbitalSchema {
  return safeParseOrbitalSchema(value).success;
}
