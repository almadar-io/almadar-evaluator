import { describe, it, expect } from 'vitest';
import { evaluate } from '../index.js';
import { createMinimalContext } from '../context.js';

function parse(text: string | null) {
  return evaluate(['csv/parse', text], createMinimalContext({}));
}

describe('csv/parse', () => {
  it('keys each data row by the header row', () => {
    expect(parse('name,age\nAda,36\nGrace,45')).toEqual([
      { name: 'Ada', age: '36' },
      { name: 'Grace', age: '45' },
    ]);
  });

  it('keeps quoted commas, escaped quotes and quoted line breaks in one cell', () => {
    expect(parse('a,b\n"x, y","she said ""hi"""\n"l1\nl2",z')).toEqual([
      { a: 'x, y', b: 'she said "hi"' },
      { a: 'l1\nl2', b: 'z' },
    ]);
  });

  it('ends records on CRLF, CR and LF and ignores a trailing newline', () => {
    const expected = [{ a: '1', b: '2' }];
    expect(parse('a,b\r\n1,2\r\n')).toEqual(expected);
    expect(parse('a,b\r1,2\r')).toEqual(expected);
    expect(parse('a,b\n1,2\n')).toEqual(expected);
    expect(parse('a,b\n1,2')).toEqual(expected);
  });

  it('returns no rows for empty and header-only text, and for non-string input', () => {
    expect(parse('')).toEqual([]);
    expect(parse('a,b')).toEqual([]);
    expect(parse('a,b\n')).toEqual([]);
    expect(parse('\n\n')).toEqual([]);
    expect(parse(null)).toEqual([]);
  });

  it('skips blank lines and normalizes short and long rows', () => {
    expect(parse('a,b\n\n1\n2,3,4\n')).toEqual([
      { a: '1', b: '' },
      { a: '2', b: '3' },
    ]);
  });

  it('keeps empty cells and a quoted empty field, and ignores a BOM', () => {
    expect(parse('a,b,c\n,"",x')).toEqual([{ a: '', b: '', c: 'x' }]);
    expect(parse('a\n""')).toEqual([{ a: '' }]);
    expect(parse('﻿a\n1')).toEqual([{ a: '1' }]);
  });
});
