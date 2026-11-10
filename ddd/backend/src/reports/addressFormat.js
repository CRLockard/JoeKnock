export function formatAddress(row) {
  const line1 = String(row.address_line_1 ?? '').trim();
  const line2 = String(row.address_line_2 ?? '').trim();
  const city = String(row.city ?? '').trim();
  const state = String(row.state ?? '').trim();
  const postalCode = String(row.postal_code ?? '').trim();

  const street = [line1, line2].filter(Boolean).join(' ');
  const cityStatePostal = [city, state, postalCode].filter(Boolean).join(' ');

  return [street, cityStatePostal].filter(Boolean).join(', ');
}
