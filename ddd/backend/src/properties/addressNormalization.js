function normalizeWhitespace(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeToken(token) {
  const base = normalizeWhitespace(token).toLowerCase().replace(/[.,]/g, '');

  const replacements = new Map([
    ['street', 'st'],
    ['st', 'st'],
    ['avenue', 'ave'],
    ['ave', 'ave'],
    ['road', 'rd'],
    ['rd', 'rd'],
    ['boulevard', 'blvd'],
    ['blvd', 'blvd'],
    ['lane', 'ln'],
    ['ln', 'ln'],
    ['drive', 'dr'],
    ['dr', 'dr'],
    ['court', 'ct'],
    ['ct', 'ct'],
    ['place', 'pl'],
    ['pl', 'pl'],
    ['highway', 'hwy'],
    ['hwy', 'hwy'],
    ['apartment', 'apt'],
    ['apt', 'apt'],
    ['suite', 'ste'],
    ['ste', 'ste'],
    ['north', 'n'],
    ['south', 's'],
    ['east', 'e'],
    ['west', 'w'],
  ]);

  return base
    .split(' ')
    .filter(Boolean)
    .map((part) => replacements.get(part) ?? part)
    .join(' ');
}

function normalizePostalCode(postalCode) {
  return normalizeWhitespace(postalCode).replace(/\s+/g, '').toLowerCase();
}

export function normalizeResolvedAddress({
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  country,
}) {
  return [
    normalizeToken(addressLine1),
    normalizeToken(addressLine2),
    normalizeToken(city),
    normalizeToken(state),
    normalizePostalCode(postalCode),
    normalizeToken(country),
  ]
    .filter((part) => part.length > 0)
    .join('|');
}
