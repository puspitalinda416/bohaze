export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const sgd = v => 'S$' + Number(v || 0).toFixed(2);
export const orders = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n)) + ' sold';
export const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const pick = (arr, seed, salt = 0) => arr[(hash(seed) + salt * 7919) % arr.length];
export const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/[\s,:;(-]+\S*$/, '') + '…');

// Inline markup for content strings: [text](/path/) and **bold**. Text is escaped first.
export const md = s => esc(s).replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}">${t}</a>`).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
export const paras = b => (Array.isArray(b) ? b : [b]).map(t => `<p>${md(t)}</p>`).join('');
export const plain = s => String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');

// AliExpress titles are keyword soup. Build a readable display title.
const NOISE = /\b(20\d\d|hot ?sale|new ?arrival|top ?brand|free ?shipping|drop ?shipping|wholesale|new|upgrade[d]?|2in1|in stock|gift|best ?seller|hot|factory|oem|odm|cheap|official|original)\b/gi;
export function cleanTitle(t) {
  let s = String(t).replace(/m3\s*\/\s*h/gi, 'm³∕h').replace(/[\[\(【].*?[\]\)】]/g, ' ').replace(NOISE, ' ').replace(/[|\/,;·•]+/g, ' ').replace(/\s+/g, ' ').trim();
  const seen = new Set(), out = [];
  for (const w of s.split(' ')) { const k = w.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(w); } }
  s = out.slice(0, 10).join(' ');
  s = s.replace(/\b(\w)(\w*)/g, (m, a, b) => (m === m.toUpperCase() && m.length > 3 ? a + b.toLowerCase() : m));
  const ACR = { hepa: 'HEPA', cadr: 'CADR', hcho: 'HCHO', tvoc: 'TVOC', usb: 'USB', uv: 'UV', led: 'LED', co2: 'CO2', wifi: 'WiFi', pm10: 'PM10', hd: 'HD', app: 'App' };
  s = s.replace(/\b(hepa|cadr|hcho|tvoc|usb|uv|led|co2|wifi|pm10)\b/gi, m => ACR[m.toLowerCase()]);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const shortTitle = t => cleanTitle(t).split(' ').slice(0, 6).join(' ');
export const slugify = (t, id) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '') + '-' + id;

// AliExpress CDN serves resized variants by suffix. Original URL is kept as onerror fallback in templates.
export const thumb = (url, n = 400) => /alicdn\.com/.test(url) && !/_\d+x\d+/.test(url) ? `${url}_${n}x${n}.jpg` : url;
