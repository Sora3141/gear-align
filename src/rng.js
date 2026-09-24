// 同じシードなら同じ盤面が出るようにするための擬似乱数。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // 紛らわしい 0/O/1/I は外す

export function randomSeed(len = 5) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  return s;
}

export function normalizeSeed(text) {
  const s = String(text).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12);
  return s || randomSeed();
}

export function seedNumber(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
