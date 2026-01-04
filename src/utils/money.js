function eurosToCents(value) {
  // Accept number or string (e.g. "12.50"). Always return integer cents.
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

module.exports = { eurosToCents };
