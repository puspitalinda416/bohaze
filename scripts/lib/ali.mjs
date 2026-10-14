import { createHmac } from 'node:crypto';
import { cleanTitle, slugify } from './util.mjs';

const E = process.env;
const API = E.ALI_API_URL || 'https://api-sg.aliexpress.com/sync';
let currency = 'SGD'; // diturunkan ke USD otomatis kalau API menolak SGD (lihat probe di fetchCatalog)

export async function ali(method, extra) {
  const p = { app_key: E.ALI_APP_KEY, timestamp: Date.now(), sign_method: 'sha256', method, tracking_id: E.ALI_TRACKING_ID,
    ship_to_country: 'SG', target_currency: currency, target_language: 'EN', ...extra };
  const base = Object.keys(p).sort().map(k => k + p[k]).join('');
  p.sign = createHmac('sha256', E.ALI_APP_SECRET).update(base).digest('hex').toUpperCase();
  try {
    const r = await (await fetch(API + '?' + new URLSearchParams(p))).json();
    const key = Object.keys(r).find(k => k.endsWith('_response'));
    const prods = r[key]?.resp_result?.result?.products?.product;
    if (!prods) console.warn(`[AliExpress ${method}] empty/error response:`, JSON.stringify(r).slice(0, 400));
    return prods || [];
  } catch (e) { console.warn(`[AliExpress ${method}] request failed: ${e.message}`); return []; }
}

// Kurs USD -> SGD hanya dipakai bila API mengembalikan harga USD. Coba kurs live, fallback ke config.
export async function usdToSgd(cfg) {
  try {
    const r = await (await fetch('https://open.er-api.com/v6/latest/USD')).json();
    if (r?.rates?.SGD > 0.5 && r.rates.SGD < 3) return Number(r.rates.SGD);
  } catch { /* pakai fallback */ }
  return cfg.currency.fxUsdFallback;
}

// Harga selalu keluar sebagai SGD. Kalau field mata uang bukan SGD (atau kosong), diasumsikan USD lalu dikonversi.
// Asumsi USD sengaja dipilih: lebih aman harga tampil sedikit lebih tinggi daripada lebih rendah dari kenyataan.
export function normalize(x, cat, hot, fx) {
  const title = cleanTitle(x.product_title);
  const imgs = x.product_small_image_urls?.string || [];
  const k = String(x.target_sale_price_currency || '').toUpperCase() === 'SGD' ? 1 : fx;
  const money = v => Math.round(Number(v || 0) * k * 100) / 100;
  return {
    id: String(x.product_id), raw: x.product_title, title, img: x.product_main_image_url,
    gallery: [x.product_main_image_url, ...imgs].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
    price: money(x.target_sale_price), was: money(x.target_original_price), rate: x.evaluate_rate || '',
    sold: Number(x.lastest_volume || 0), link: x.promotion_link, hot, cat, slug: slugify(title, x.product_id)
  };
}

export async function fetchCatalog(cfg) {
  const bad = new RegExp(cfg.exclude.join('|'), 'i'), must = new RegExp(cfg.mustMatch, 'i');
  const first = cfg.categories[0].keywords[0];
  let probe = await ali('aliexpress.affiliate.product.query', { keywords: first, page_size: 5 });
  if (!probe.length) {
    console.warn('SGD ditolak atau kosong. Mencoba USD dan konversi ke SGD...');
    currency = 'USD'; probe = await ali('aliexpress.affiliate.product.query', { keywords: first, page_size: 5 });
  }
  const sample = probe[0], got = String(sample?.target_sale_price_currency || '').toUpperCase();
  const fx = got === 'SGD' ? 1 : await usdToSgd(cfg);
  if (!got) console.warn('Field target_sale_price_currency kosong: harga diasumsikan USD dan dikonversi. Cek manual satu produk.');
  console.log(`Mata uang API: ${got || 'tidak diketahui'}; kurs konversi: ${fx === 1 ? 'tidak perlu' : fx.toFixed(4)}`);

  const seen = new Map();
  let hotOff = false;
  for (const c of cfg.categories) for (const [i, kw] of c.keywords.entries()) {
    for (const x of await ali('aliexpress.affiliate.product.query', { keywords: kw, page_size: cfg.perKeyword, sort: 'LAST_VOLUME_DESC', page_no: 1 }))
      if (!seen.has(x.product_id)) seen.set(x.product_id, normalize(x, c.id, false, fx));
    if (i === 0 && !hotOff) {
      const h = await ali('aliexpress.affiliate.hotproduct.query', { keywords: kw, page_size: 4 });
      if (!h.length) hotOff = true; // akun belum punya izin hot product API: fallback ke order terbanyak
      for (const x of h) seen.set(x.product_id, normalize(x, c.id, true, fx));
    }
  }
  const list = [...seen.values()].filter(p => p.link && p.img && p.price >= cfg.minPrice && must.test(p.raw) && !bad.test(p.raw));
  return { list, fx: fx === 1 ? 0 : fx };
}
