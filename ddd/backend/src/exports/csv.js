function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // CSV quotes protect delimiters, not spreadsheet formula evaluation. Prefix
  // untrusted formula-like text only in the export; never alter stored values.
  const raw = String(value);
  // A quoted tab prefix is for spreadsheet viewing and remains in raw CSV.
  const text = /^[\s\uFEFF]*[=+@\-＝＋－＠]|^[\t\r\n]/u.test(raw)
    ? `\t${raw}`
    : raw;

  if (text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  if (text.includes(',') || /[\t\n\r]/.test(text)) {
    return `"${text}"`;
  }

  return text;
}

export function serializeCsv({ headers, rows }) {
  const headerLine = headers.map((item) => escapeCsvValue(item)).join(',');
  const rowLines = rows.map((row) =>
    row.map((value) => escapeCsvValue(value)).join(','),
  );

  return [headerLine, ...rowLines].join('\r\n');
}
