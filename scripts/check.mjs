// QA statis untuk dist/: jalankan setelah build (npm run check). Gagal = exit code 1.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk('dist'), pages = files.filter(f => f.endsWith('.html'));
const problems = [], warn = [];
const exists = u => { const p = u.split('#')[0].split('?')[0]; if (!p) return true; const b = join('dist', p); return existsSync(b) && (statSync(b).isFile() || existsSync(join(b, 'index.html'))); };
let words = [];
for (const f of pages) {
  const h = readFileSync(f, 'utf8'), name = f.replace('dist/', '');
  const title = h.match(/<title>(.*?)<\/title>/)?.[1] || '', desc = h.match(/name="description" content="(.*?)"/)?.[1] || '';
  if (!title) problems.push(`${name}: no <title>`); if (title.length > 65) warn.push(`${name}: title ${title.length} chars`);
  if (desc.length < 50 || desc.length > 160) warn.push(`${name}: meta description ${desc.length} chars`);
  const h1 = (h.match(/<h1[ >]/g) || []).length; if (h1 !== 1 && name !== '404.html') problems.push(`${name}: ${h1} h1 tags`);
  for (const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) try { JSON.parse(m[1].replace(/\\u003c/g, '<')); } catch { problems.push(`${name}: invalid JSON-LD`); }
  for (const m of h.matchAll(/(?:href|src)="(\/[^"]*)"/g)) if (!exists(m[1])) problems.push(`${name}: broken internal ref ${m[1]}`);
  for (const m of h.matchAll(/<img (?![^>]*\balt=)[^>]*>/g)) problems.push(`${name}: img without alt`);
  if (/\bUSD\b|US\$|>\$\d/.test(h.replace(/<script.*?<\/script>/gs, ''))) problems.push(`${name}: stray USD/$ price (expected S$)`);
  if (/—/.test(h)) warn.push(`${name}: contains em dash`);
  if (name.startsWith('p/')) words.push([name, h.match(/<article class="post">(.*?)<\/article>/s)?.[1].replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length || 0]);
}
for (const f of pages.filter(f => f.includes('/p/'))) { const h = readFileSync(f, 'utf8'); if (!/rel="sponsored nofollow noopener"/.test(h)) problems.push(`${f}: buy link missing rel=sponsored`); }
console.log(`${pages.length} pages checked. Product article words: min ${Math.min(...words.map(w => w[1]))}, max ${Math.max(...words.map(w => w[1]))}`);
warn.forEach(w => console.log('WARN ', w)); problems.forEach(p => console.log('FAIL ', p));
process.exit(problems.length ? 1 : 0);
