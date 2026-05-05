const STRIP_SUFFIXES = new Set([
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'co',
  'technologies', 'technology', 'services', 'solutions',
  'consulting', 'group', 'company', 'the', 'and'
]);

function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')   // remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 0 && !STRIP_SUFFIXES.has(word))
    .join(' ')
    .trim();
}

// SHA-256 hash using Node's built-in crypto — no library needed
const { createHash } = require('crypto');

function hashCompanyName(name) {
  const normalized = normalizeCompanyName(name);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

module.exports = { normalizeCompanyName, hashCompanyName };
