/**
 * CSV Module Runtime Evaluators
 *
 * `(csv/parse text)` — pure, deterministic: CSV text → one `Map string string`
 * per data row, keyed by the header row (RFC 4180: quoted fields, `""` escapes
 * a quote, a quoted field may hold commas and line breaks; records end in CRLF,
 * LF or CR). A blank line is skipped, a short row's missing cells are `""`,
 * a long row's extra cells are dropped, a leading BOM is ignored. Empty text,
 * header-only text and non-string input → `[]`, never throws.
 *
 * @packageDocumentation
 */

import type { SExpr } from '../types/expression.js';
import type { EvaluationContext } from '../context.js';

type EvalFn = (expr: SExpr, ctx: EvaluationContext) => unknown;

function records(text: string): string[][] {
  const out: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const endRecord = (): void => {
    if (record.length === 0 && field === '' && !quoted) return;
    record.push(field);
    out.push(record);
    record = [];
    field = '';
    quoted = false;
  };
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      inQuotes = true;
      quoted = true;
    } else if (c === ',') {
      record.push(field);
      field = '';
      quoted = false;
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRecord();
    } else {
      field += c;
    }
  }
  endRecord();
  return out;
}

/**
 * csv/parse - Parse CSV text into one string-to-string map per data row
 */
export function evalCsvParse(
  args: SExpr[],
  evaluate: EvalFn,
  ctx: EvaluationContext
): Record<string, string>[] {
  const text = evaluate(args[0], ctx);
  if (typeof text !== 'string') return [];
  const [header, ...rows] = records(text);
  if (header === undefined) return [];
  return rows.map((cells) => {
    const row: Record<string, string> = {};
    header.forEach((name, index) => {
      row[name] = cells[index] ?? '';
    });
    return row;
  });
}
