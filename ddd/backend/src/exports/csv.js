function escapeCsvValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value);

  if (text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  if (text.includes(',') || text.includes('\n') || text.includes('\r')) {
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
