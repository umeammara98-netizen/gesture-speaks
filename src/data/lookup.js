import signs from './signs.json';

const byEnglish = new Map(signs.map((sign) => [sign.english.toLowerCase(), sign]));
const byUrdu = new Map(signs.map((sign) => [sign.urdu, sign]));

function clean(token) {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function lookupLine(text) {
  const raw = text.trim();
  if (!raw) return [];
  const exact = byEnglish.get(raw.toLowerCase()) || byUrdu.get(raw);
  if (exact) return [exact];

  const tokens = raw.split(/\s+/);
  const found = [];
  for (let i = 0; i < tokens.length; i += 1) {
    let match = null;
    let span = 1;
    const room = Math.min(3, tokens.length - i);
    for (let len = room; len >= 1; len -= 1) {
      const slice = tokens.slice(i, i + len).map(clean);
      const phrase = slice.join(' ');
      const hit = byEnglish.get(phrase.toLowerCase()) || byUrdu.get(phrase);
      if (hit) {
        match = hit;
        span = len;
        break;
      }
    }
    if (match) {
      found.push(match);
      i += span - 1;
    }
  }
  return found;
}

export function signCategories(list = signs) {
  return [...new Set(list.map((sign) => sign.category))];
}

export { signs };
