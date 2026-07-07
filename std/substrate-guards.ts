/**
 * Runtime guards for the interpreter → typed-substrate boundary.
 *
 * PUBLISH-GATE LEDGER: `isFieldValue`, `isEventPayloadValue`,
 * `isSessionHistoryEntry`, and `isPlanSnapshot` are structurally identical
 * copies of the guards added to `@almadar/core` (commit 35bc1b6, lands in
 * the next core release after 10.22.0). This package's pinned core install
 * cannot see them yet — once the pin reaches that release, delete the
 * copies here and import from `@almadar/core`. `isOrbital` and
 * `isOrbitalSchemaValue` stay: they bridge core's zod schemas to its
 * hand-written interfaces as `unknown`-accepting predicates.
 *
 * @packageDocumentation
 */

import {
  OrbitalZodSchema,
  safeParseOrbitalSchema,
  type EventPayloadValue,
  type FieldValue,
  type Orbital,
  type OrbitalSchema,
  type PlanSnapshot,
  type PlanSnapshotStatus,
  type SessionHistoryEntry,
} from '@almadar/core';

export function isFieldValue(value: unknown): value is FieldValue {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') return true;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.every((item: unknown) => isFieldValue(item));
  if (kind === 'object' && value !== null && typeof value === 'object') {
    return Object.values(value).every((item: unknown) => item === undefined || isFieldValue(item));
  }
  return false;
}

export function isEventPayloadValue(value: unknown): value is EventPayloadValue {
  if (value === null || value === undefined) return true;
  const kind = typeof value;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') return true;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.every((item: unknown) => isEventPayloadValue(item));
  if (kind === 'object' && value !== null && typeof value === 'object') {
    return Object.values(value).every((item: unknown) => isEventPayloadValue(item));
  }
  return false;
}

export function isSessionHistoryEntry(value: unknown): value is SessionHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'role' in value && typeof value.role === 'string' &&
    'content' in value && typeof value.content === 'string' &&
    'timestamp' in value && typeof value.timestamp === 'number'
  );
}

export function isPlanSnapshot(value: unknown): value is PlanSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const statuses: ReadonlyArray<PlanSnapshotStatus> = ['proposed', 'confirmed', 'built', 'failed'];
  return (
    'schemaVersion' in value && value.schemaVersion === 1 &&
    'status' in value && statuses.some((s) => s === value.status) &&
    'builtAt' in value && typeof value.builtAt === 'string' &&
    'orbitals' in value && Array.isArray(value.orbitals) &&
    'renames' in value && Array.isArray(value.renames) &&
    'deletedOrbitals' in value && Array.isArray(value.deletedOrbitals)
  );
}

/** Deep zod validation bridging to core's hand-written `Orbital` interface. */
export function isOrbital(value: unknown): value is Orbital {
  return OrbitalZodSchema.safeParse(value).success;
}

/** Deep zod validation bridging to core's hand-written `OrbitalSchema` interface. */
export function isOrbitalSchemaValue(value: unknown): value is OrbitalSchema {
  return safeParseOrbitalSchema(value).success;
}
