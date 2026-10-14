// Tes offline logika ali.mjs dengan fetch palsu. Jalankan: node scripts/test-ali.mjs
process.env.ALI_APP_KEY = 'k'; process.env.ALI_APP_SECRET = 's'; process.env.ALI_TRACKING_ID = 't';
const { fetchCatalog } = await import('./lib/ali.mjs');
const cfg = JSON.parse((await import('node:fs')).readFileSync('config.json', 'utf8'));
const prod = (id, title, price, cur) => ({ product_id: id, product_title: title, product_main_image_url: 'https://ae01.alicdn.com/x.jpg', target_sale_price: price, target_original_price: price * 2, target_sale_price_currency: cur, lastest_volume: 100, promotion_link: 'https://s.click.aliexpress.com/e/' + id });
const run = async (name, handler) => {
  globalThis.fetch = async url => { const u = new URL(url); if (u.hostname.includes('er-api')) return { json: async () => ({ rates: { SGD: 1.3 } }) }; return { json: async () => handler(u.searchParams) }; };
  const { list, fx } = await fetchCatalog(cfg);
  console.log(`${name}: ${list.length} items, fx=${fx}, first price=${list[0]?.price}, link=${list[0]?.link?.slice(0, 40)}`);
};
const wrap = p => ({ aliexpress_affiliate_product_query_response: { resp_result: { result: { products: { product: p } } } } });
await run('A) API honours SGD', q => wrap([prod(1, 'HEPA Air Purifier Bedroom', '50.00', 'SGD')]));
await run('B) API rejects SGD, serves USD', q => q.get('target_currency') === 'SGD' ? { error_response: { msg: 'invalid currency' } } : wrap([prod(2, 'HEPA Air Purifier Bedroom', '40.00', 'USD')]));
await run('C) currency field missing', q => wrap([prod(3, 'HEPA Air Purifier Bedroom', '40.00', undefined)]));
await run('D) junk filtered', q => wrap([prod(4, 'Replacement HEPA Filter Air Purifier', '40', 'SGD'), prod(5, 'Phone Case', '40', 'SGD'), prod(6, 'HEPA Air Purifier', '3', 'SGD')]));
