import { describe, expect, it } from 'vitest';
import { serializeCsv } from '../../src/exports/csv.js';

describe('spreadsheet-safe CSV serialization', () => {
  it.each([
    '=1+1',
    '+1 555 123 4567',
    '-1+1',
    '@SUM(1,1)',
    '\t=1+1',
    '\r=1+1',
    '\n=1+1',
    '  =1+1',
    '=1,2',
    '=1+1\nnext',
    '＝1+1',
    '＠SUM(1,1)',
  ])('neutralizes %j before delimiter escaping', (value) => {
    const output = serializeCsv({ headers: ['value'], rows: [[value]] });
    const expected = `\t${value}`;
    const cell = `"${expected.replace(/"/g, '""')}"`;
    expect(output).toBe(`value\r\n${cell}`);
  });
  it('retains normal text, delimiter escaping, empty values and numeric data', () => {
    expect(
      serializeCsv({
        headers: ['a', 'b', 'c', 'd', 'e'],
        rows: [
          ['Smith, John', 'He said "hi"', 'line1\nline2', null, 42],
          ['555-123-4567', '(555) 123-4567', 'a=1+1', undefined, ''],
        ],
      }),
    ).toBe(
      'a,b,c,d,e\r\n"Smith, John","He said ""hi""","line1\nline2",,42\r\n555-123-4567,(555) 123-4567,a=1+1,,',
    );
  });
  it('also protects text headers', () => {
    expect(serializeCsv({ headers: ['=header'], rows: [] })).toBe(
      '"\t=header"',
    );
  });
});
