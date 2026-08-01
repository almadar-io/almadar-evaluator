/**
 * Time Module Runtime Evaluators
 *
 * Runtime implementations for time/* operators.
 * Provides date manipulation, formatting, and comparison functions.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

type TimeUnit = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'ms';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * The one time-unit vocabulary, mirroring `TimeUnit::parse` in
 * `orbital-rust/crates/orbital-core/src/evaluator/operators/system.rs`. The two
 * execution paths diverged silently once already
 * (`S-CALENDAR-RANGE-FILTER-USES-UNSUPPORTED-TIME-UNITS`): this path accepted
 * `month`/`year` while the Rust path threw on them, and this path silently
 * no-opped on `d`/`w` while the Rust path accepted them. Any edit here must land
 * in `system.rs` in the same change.
 */
const TIME_UNIT_ALIASES: Readonly<Record<string, TimeUnit>> = {
  ms: 'ms',
  millisecond: 'ms',
  milliseconds: 'ms',
  s: 'second',
  second: 'second',
  seconds: 'second',
  m: 'minute',
  minute: 'minute',
  minutes: 'minute',
  h: 'hour',
  hour: 'hour',
  hours: 'hour',
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  week: 'week',
  weeks: 'week',
  month: 'month',
  months: 'month',
  year: 'year',
  years: 'year',
};

const TIME_UNIT_VOCABULARY =
  'ms|millisecond(s), s|second(s), m|minute(s), h|hour(s), d|day(s), w|week(s), month(s), year(s)';

/**
 * Resolve a unit literal, throwing on anything outside the vocabulary. An
 * unknown unit used to fall through a `switch` and silently return the input
 * unchanged, which is how a wrong date range shipped undetected.
 */
function parseTimeUnit(unit: unknown): TimeUnit {
  const resolved = TIME_UNIT_ALIASES[String(unit)];
  if (resolved === undefined) {
    throw new TypeError(
      `Type mismatch: expected time unit (${TIME_UNIT_VOCABULARY}), got ${String(unit)}`
    );
  }
  return resolved;
}

/** Fixed-length units in ms. `month`/`year` have no fixed length. */
const FIXED_UNIT_MS: Readonly<Partial<Record<TimeUnit, number>>> = {
  ms: 1,
  second: MS_PER_SECOND,
  minute: MS_PER_MINUTE,
  hour: MS_PER_HOUR,
  day: MS_PER_DAY,
  week: MS_PER_WEEK,
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Calendar-correct month shift, in UTC so the result never depends on the host
 * timezone. The day-of-month **clamps** into the target month (31 Mar − 1 month
 * = 28/29 Feb) rather than overflowing into the next one, which is what
 * `Date.prototype.setMonth` would do. `add_calendar_months` in `system.rs`
 * clamps identically.
 */
function addCalendarMonths(ts: number, months: number): number {
  const date = new Date(ts);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const total = y * 12 + m + months;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const nd = Math.min(date.getUTCDate(), daysInMonth(ny, nm));
  const shifted = new Date(ts);
  shifted.setUTCFullYear(ny, nm, nd);
  return shifted.getTime();
}

/** Shift `ts` by `amount` of `unit`. Behind both time/add and time/subtract. */
function shiftTime(ts: number, amount: number, unit: TimeUnit): number {
  const fixed = FIXED_UNIT_MS[unit];
  if (fixed !== undefined) return ts + amount * fixed;
  return addCalendarMonths(ts, unit === 'year' ? Math.trunc(amount) * 12 : Math.trunc(amount));
}

/**
 * Start of the unit-bucket containing `ts`. Behind both time/startOf and
 * time/isSame. Weeks start **Monday** (ISO-8601), matching `start_of` in
 * `system.rs`; this path used to start weeks on Sunday.
 */
function startOf(ts: number, unit: TimeUnit): number {
  switch (unit) {
    case 'ms':
      return Math.floor(ts);
    case 'second':
      return Math.floor(ts / MS_PER_SECOND) * MS_PER_SECOND;
    case 'minute':
      return Math.floor(ts / MS_PER_MINUTE) * MS_PER_MINUTE;
    case 'hour':
      return Math.floor(ts / MS_PER_HOUR) * MS_PER_HOUR;
    case 'day':
      return Math.floor(ts / MS_PER_DAY) * MS_PER_DAY;
    case 'week': {
      const days = Math.floor(ts / MS_PER_DAY);
      const dow = (((days + 3) % 7) + 7) % 7; // Jan 1 1970 = Thu; 0 => Monday
      return (days - dow) * MS_PER_DAY;
    }
    case 'month': {
      const d = new Date(ts);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    }
    case 'year':
      return Date.UTC(new Date(ts).getUTCFullYear(), 0, 1);
  }
}

/**
 * Signed count of **whole** calendar months from `from` to `to`. A partial
 * trailing month does not count, so 31 Jan → 28 Feb is 0 months. Mirrors
 * `whole_months_between`; this path used a 30.44-day approximation.
 */
function wholeMonthsBetween(from: number, to: number): number {
  const lo = new Date(Math.min(from, to));
  const hi = new Date(Math.max(from, to));
  let months =
    (hi.getUTCFullYear() - lo.getUTCFullYear()) * 12 + (hi.getUTCMonth() - lo.getUTCMonth());

  const loRest: [number, number] = [lo.getUTCDate(), lo.getTime() - startOf(lo.getTime(), 'day')];
  const hiRest: [number, number] = [hi.getUTCDate(), hi.getTime() - startOf(hi.getTime(), 'day')];
  if (hiRest[0] < loRest[0] || (hiRest[0] === loRest[0] && hiRest[1] < loRest[1])) {
    months -= 1;
  }
  return to < from ? -months : months;
}

/**
 * time/now - Current timestamp
 */
export function evalTimeNow(): number {
  return Date.now();
}

/**
 * time/today - Today at midnight (local time)
 */
export function evalTimeToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/**
 * time/parse - Parse string to timestamp
 */
export function evalTimeParse(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const str = evaluate(args[0], ctx) as string;
  // Note: format param is accepted but we use native Date parsing
  // A full implementation would need a date parsing library
  const date = new Date(str);
  return date.getTime();
}

/**
 * time/format - Format timestamp to string
 */
export function evalTimeFormat(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  const timestamp = evaluate(args[0], ctx) as number;
  const format = evaluate(args[1], ctx) as string;

  const date = new Date(timestamp);

  // Simple format token replacement
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    M: String(date.getMonth() + 1),
    DD: String(date.getDate()).padStart(2, '0'),
    D: String(date.getDate()),
    HH: String(date.getHours()).padStart(2, '0'),
    H: String(date.getHours()),
    mm: String(date.getMinutes()).padStart(2, '0'),
    m: String(date.getMinutes()),
    ss: String(date.getSeconds()).padStart(2, '0'),
    s: String(date.getSeconds()),
    ddd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
    dddd: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      date.getDay()
    ],
    MMM: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
      date.getMonth()
    ],
    MMMM: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][date.getMonth()],
  };

  // One pass, longest token first: replacing in map order lets `MM` consume
  // the head of `MMM` ("MMM D" → "077 5"), and a multi-pass loop can also
  // re-substitute inside an already-emitted value ("July" → "Ju1y").
  const pattern = new RegExp(
    Object.keys(tokens)
      .sort((a, b) => b.length - a.length)
      .join('|'),
    'g',
  );

  return format.replace(pattern, (token) => tokens[token]);
}

/**
 * time/year - Get year from timestamp
 */
export function evalTimeYear(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getFullYear();
}

/**
 * time/month - Get month from timestamp (1-12)
 */
export function evalTimeMonth(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getMonth() + 1;
}

/**
 * time/day - Get day of month from timestamp (1-31)
 */
export function evalTimeDay(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getDate();
}

/**
 * time/weekday - Get day of week (0=Sunday, 6=Saturday)
 */
export function evalTimeWeekday(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getDay();
}

/**
 * time/hour - Get hour from timestamp (0-23)
 */
export function evalTimeHour(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getHours();
}

/**
 * time/minute - Get minute from timestamp (0-59)
 */
export function evalTimeMinute(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getMinutes();
}

/**
 * time/second - Get second from timestamp (0-59)
 */
export function evalTimeSecond(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  return new Date(timestamp).getSeconds();
}

/**
 * time/add - Add time to timestamp
 */
export function evalTimeAdd(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  const amount = evaluate(args[1], ctx) as number;
  const unit = parseTimeUnit(evaluate(args[2], ctx));

  return shiftTime(timestamp, amount, unit);
}

/**
 * time/subtract - Subtract time from timestamp
 */
export function evalTimeSubtract(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  const amount = evaluate(args[1], ctx) as number;
  const unit = parseTimeUnit(evaluate(args[2], ctx));

  return shiftTime(timestamp, -amount, unit);
}

/**
 * time/diff - Difference between timestamps
 */
export function evalTimeDiff(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  // Signed, so that diff(a, b) == -diff(b, a). Whole units truncate toward
  // zero for the same reason.
  const diffMs = a - b;
  if (args.length <= 2) return diffMs;

  const unit = parseTimeUnit(evaluate(args[2], ctx));
  const fixed = FIXED_UNIT_MS[unit];
  if (fixed !== undefined) return Math.trunc(diffMs / fixed);

  const months = wholeMonthsBetween(b, a);
  return unit === 'year' ? Math.trunc(months / 12) : months;
}

/**
 * time/startOf - Get start of time period
 */
export function evalTimeStartOf(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  const unit = parseTimeUnit(evaluate(args[1], ctx));

  return startOf(timestamp, unit);
}

/**
 * time/endOf - Get end of time period
 */
export function evalTimeEndOf(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): number {
  const timestamp = evaluate(args[0], ctx) as number;
  const unit = parseTimeUnit(evaluate(args[1], ctx));

  // Last millisecond of the bucket = start of the next bucket, minus one.
  if (unit === 'ms') return Math.floor(timestamp);
  return shiftTime(startOf(timestamp, unit), 1, unit) - 1;
}

/**
 * time/isBefore - Check if a is before b
 */
export function evalTimeIsBefore(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  return a < b;
}

/**
 * time/isAfter - Check if a is after b
 */
export function evalTimeIsAfter(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  return a > b;
}

/**
 * time/isBetween - Check if date is between start and end
 */
export function evalTimeIsBetween(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const date = evaluate(args[0], ctx) as number;
  const start = evaluate(args[1], ctx) as number;
  const end = evaluate(args[2], ctx) as number;
  return date >= start && date <= end;
}

/**
 * time/isSame - Check if timestamps are same (optionally by unit)
 */
export function evalTimeIsSame(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const a = evaluate(args[0], ctx) as number;
  const b = evaluate(args[1], ctx) as number;
  if (args.length <= 2) {
    return a === b;
  }

  // Same unit-bucket, i.e. startOf(a, unit) === startOf(b, unit). Defined in
  // terms of `startOf` so week/month/year cannot drift back to an exact
  // millisecond comparison.
  const unit = parseTimeUnit(evaluate(args[2], ctx));
  return startOf(a, unit) === startOf(b, unit);
}

/**
 * time/isPast - Check if timestamp is in the past
 */
export function evalTimeIsPast(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const timestamp = evaluate(args[0], ctx) as number;
  return timestamp < Date.now();
}

/**
 * time/isFuture - Check if timestamp is in the future
 */
export function evalTimeIsFuture(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const timestamp = evaluate(args[0], ctx) as number;
  return timestamp > Date.now();
}

/**
 * time/isToday - Check if timestamp is today
 */
export function evalTimeIsToday(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): boolean {
  const timestamp = evaluate(args[0], ctx) as number;
  const date = new Date(timestamp);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * time/relative - Format as relative time ("2 hours ago", "in 3 days")
 */
export function evalTimeRelative(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  const timestamp = evaluate(args[0], ctx) as number;
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  let value: number;
  let unit: string;

  if (absDiff < MS_PER_MINUTE) {
    return 'just now';
  } else if (absDiff < MS_PER_HOUR) {
    value = Math.round(absDiff / MS_PER_MINUTE);
    unit = value === 1 ? 'minute' : 'minutes';
  } else if (absDiff < MS_PER_DAY) {
    value = Math.round(absDiff / MS_PER_HOUR);
    unit = value === 1 ? 'hour' : 'hours';
  } else if (absDiff < MS_PER_WEEK) {
    value = Math.round(absDiff / MS_PER_DAY);
    unit = value === 1 ? 'day' : 'days';
  } else if (absDiff < MS_PER_DAY * 30) {
    value = Math.round(absDiff / MS_PER_WEEK);
    unit = value === 1 ? 'week' : 'weeks';
  } else if (absDiff < MS_PER_DAY * 365) {
    value = Math.round(absDiff / (MS_PER_DAY * 30));
    unit = value === 1 ? 'month' : 'months';
  } else {
    value = Math.round(absDiff / (MS_PER_DAY * 365));
    unit = value === 1 ? 'year' : 'years';
  }

  return isPast ? `${value} ${unit} ago` : `in ${value} ${unit}`;
}

/**
 * time/duration - Format milliseconds as duration ("2h 30m")
 */
export function evalTimeDuration(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): string {
  let ms = evaluate(args[0], ctx) as number;

  if (ms < 0) ms = -ms;

  const parts: string[] = [];

  if (ms >= MS_PER_DAY) {
    const days = Math.floor(ms / MS_PER_DAY);
    parts.push(`${days}d`);
    ms %= MS_PER_DAY;
  }

  if (ms >= MS_PER_HOUR) {
    const hours = Math.floor(ms / MS_PER_HOUR);
    parts.push(`${hours}h`);
    ms %= MS_PER_HOUR;
  }

  if (ms >= MS_PER_MINUTE) {
    const minutes = Math.floor(ms / MS_PER_MINUTE);
    parts.push(`${minutes}m`);
    ms %= MS_PER_MINUTE;
  }

  if (ms >= MS_PER_SECOND && parts.length < 2) {
    const seconds = Math.floor(ms / MS_PER_SECOND);
    parts.push(`${seconds}s`);
  }

  return parts.length > 0 ? parts.join(' ') : '0s';
}
