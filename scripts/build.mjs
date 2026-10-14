import { mkdir, writeFile, rm, cp } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import guides from '../content/guides.mjs';
import { fetchCatalog } from './lib/ali.mjs';
import { sampleCatalog } from './lib/sample.mjs';
import { article } from './lib/article.mjs';
import { saveSnapshot, loadSnapshot } from './lib/supabase.mjs';
import { makeTemplates } from './lib/templates.mjs';
import { esc, sgd, orders, shortTitle, md, paras, clip } from './lib/util.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const cfg = JSON.parse(readFileSync('config.json', 'utf8'));
const E = process.env, SAMPLE = E.SAMPLE === '1', TODAY = new Date().toISOString().slice(0, 10), LAUNCH = cfg.launchDate || '2026-10-14';
if (!SAMPLE && !(E.ALI_APP_KEY && E.ALI_APP_SECRET && E.ALI_TRACKING_ID)) throw new Error('ALI_APP_KEY, ALI_APP_SECRET and ALI_TRACKING_ID are required. (For a local demo run: SAMPLE=1 node scripts/build.mjs)');

const write = async (path, html) => { await mkdir(join('dist', path), { recursive: true }); await writeFile(join('dist', path, 'index.html'), html); };
const idOf = h => String(h).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sitemap = [];
const cats = Object.fromEntries(cfg.categories.map(c => [c.id, c]));

// ---------- Catalog ----------
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
let valid, fx = 0;
if (SAMPLE) {
  const bad = new RegExp(cfg.exclude.join('|'), 'i'), must = new RegExp(cfg.mustMatch, 'i');
  valid = (await sampleCatalog('dist')).filter(p => p.price >= cfg.minPrice && must.test(p.raw) && !bad.test(p.raw));
} else {
  ({ list: valid, fx } = await fetchCatalog(cfg));
  if (!valid.length) {
    console.warn('API returned nothing. Trying the last good catalog from Supabase...');
    const snap = await loadSnapshot();
    if (snap?.items?.length) ({ items: valid, fx = 0 } = snap); else throw new Error('No products returned and no snapshot available. See the [AliExpress ...] lines above for the API error.');
  }
}
const per = Math.ceil(cfg.maxProducts / cfg.categories.length);
const all = cfg.categories.flatMap(c => valid.filter(p => p.cat === c.id).sort((a, b) => b.sold - a.sold).slice(0, per));
const byVol = [...all].sort((a, b) => b.sold - a.sold);
const hot = [...byVol.filter(p => p.hot), ...byVol.filter(p => !p.hot)].slice(0, cfg.hotCount).sort((a, b) => b.sold - a.sold);
all.forEach(p => (p.hot = false)); hot.forEach(p => (p.hot = true));
const purifiers = byVol.filter(p => p.cat !== 'monitor');
const buds = cfg.budgets.filter(b => purifiers.filter(p => p.price <= b).length >= 3);
if (!SAMPLE) await saveSnapshot({ items: all, fx });
console.log(`Catalog: ${all.length} products, ${hot.length} hot, budgets: ${buds.join(', ') || 'none'}`);

const T = makeTemplates(cfg, { TODAY, SAMPLE, guides, fx, buds });
const { card, row, buy, img, faqHtml, ld, crumbLd, faqLd, crumb, page, off, gauge, specs, meta } = T;

await cp('public', 'dist', { recursive: true });
const catItems = id => byVol.filter(p => p.cat === id);
const liveCats = cfg.categories.filter(c => catItems(c.id).length);
const guideFor = cat => guides.find(g => g.cat === cat) || guides.find(g => g.slug === 'how-to-choose-air-purifier-for-haze');
const glist = list => `<ul class="glist">${list.map(g => `<li><a class="t" href="/guides/${g.slug}/">${esc(g.h1)}</a><p>${esc(g.meta)}</p></li>`).join('')}</ul>`;
const itemList = items => ({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${cfg.domain}/p/${p.slug}/`, name: p.title })) });
const orgLd = { '@type': 'Organization', name: cfg.siteName, url: cfg.domain };
const articleLd = (headline, image, modified) => ({ '@context': 'https://schema.org', '@type': 'Article', headline, image, datePublished: LAUNCH, dateModified: modified, inLanguage: 'en-SG', author: orgLd, publisher: orgLd });
const h2s = 'style="font-size:26px;margin:52px 0 10px"';
const sec = (title, sub, inner, extra = '') => `<section class="sec"><div class="wrap"><div class="sec-head"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${extra}</div>${inner}</div></section>`;

// ---------- Home ----------
sitemap.push('/');
await write('', page({ title: `${cfg.siteName}: Best Air Purifiers for Haze in Singapore (S$)`, desc: cfg.description, path: '/', image: hot[0].img,
  schema: ld([{ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: cfg.domain, inLanguage: 'en-SG' }, { '@context': 'https://schema.org', ...orgLd }]),
  body: `<section class="hero"><div class="wrap"><div><p class="kicker">Singapore haze, sorted</p><h1>Air purifiers for when the skyline goes <em>missing</em>.</h1>
<p class="lede">Purifiers and PM2.5 monitors that ship to Singapore, ranked by what people actually order and priced in S$. Plus a live PSI check, so you know if tonight is a purifier night.</p>
<div class="cta"><a class="btn buy big" href="/hot/">See what is hot in SG</a><a class="btn big" href="/tools/cadr/">Size a purifier for your room</a></div>
<small class="stamp">Prices checked ${TODAY}. Buy buttons are affiliate links.</small></div>${gauge()}</div></section>
<section class="sec"><div class="wrap"><p class="kicker">The short version</p><h2>A three-step haze plan</h2>
<ol class="steps"><li><span class="n">STEP 01</span><b>Know the number</b><p>${md('Check the 1-hour PM2.5 before you go out and the 24-hour PSI for the day. [How to read them](/guides/psi-vs-pm25-singapore-haze-explained/).')}</p></li>
<li><span class="n">STEP 02</span><b>Shut the gaps</b><p>${md('Windows closed, air-con on recirculate, no incense. [The haze checklist](/guides/haze-season-checklist-singapore-home/).')}</p></li>
<li><span class="n">STEP 03</span><b>Size it right</b><p>${md('Match airflow to room volume, not to a sticker. [CADR calculator](/tools/cadr/).')}</p></li></ol></div></section>
${sec('Hot in Singapore', 'Most ordered right now, on listings that ship to Singapore.', `<ol class="board">${hot.map(row).join('')}</ol><p style="margin-top:22px"><a class="btn" href="/hot/">Full top 20</a></p>`)}
${sec('Pick by room', 'Different rooms, different airflow. Start with where the haze bothers you most.', `<ul class="rooms">${liveCats.map((c, i) => `<li><a class="room" href="/c/${c.id}/"><span class="rn">0${i + 1}</span><span class="rimg">${img(catItems(c.id)[0].img, c.label, 260, 260, 'loading="lazy"', 300)}</span><b>${esc(c.label)}</b><span class="rm">${esc(c.mood)}</span><em>${esc(c.size)}</em></a></li>`).join('')}</ul>`)}
${liveCats.map(c => sec(esc(c.label), esc(c.mood) + '.', `<div class="grid">${catItems(c.id).slice(0, 4).map(card).join('')}</div>`, `<a class="btn" href="/c/${c.id}/">See all</a>`)).join('')}
${sec('Read before you buy', 'Short guides that save you a return label.', glist(guides.slice(0, 4)), '<a class="btn" href="/guides/">All guides</a>')}
${buds.length ? `<section class="band"><div class="wrap"><h2>Shopping with a number in mind</h2><div class="pills">${buds.map(b => `<a href="/best/under-${b}/">Under S$${b}</a>`).join('')}</div></div></section>` : ''}` }));

// ---------- Hot in Singapore ----------
const top = byVol.slice(0, 20);
const hotFaq = [{ q: 'How is "hot in Singapore" decided?', a: 'We rank by recent AliExpress order counts on listings that ship to Singapore, plus AliExpress hot-product data where our account has access. It is a popularity signal, not a quality score and not data about Singapore buyers specifically.' },
  { q: 'Are these prices in Singapore dollars?', a: 'Yes. Prices are shown in S$ as of our last update. GST, delivery and the final total are confirmed at checkout.' },
  { q: 'Is the most popular purifier the best one?', a: 'Not necessarily. Popular means plenty of people ordered it. Check airflow (CADR), filter grade and the plug type, then use our [CADR calculator](/tools/cadr/) to see if it suits your room.' }];
sitemap.push('/hot/');
await write('hot', page({ title: 'Hot Air Purifiers in Singapore Right Now (S$)', desc: `The ${top.length} most-ordered air purifiers and PM2.5 monitors that ship to Singapore, with S$ prices and direct buy links. Updated ${TODAY}.`.slice(0, 155), path: '/hot/', image: top[0].img,
  schema: ld([itemList(top), crumbLd([['Home', '/'], ['Hot in Singapore', '/hot/']]), faqLd(hotFaq)]),
  body: `<div class="wrap pg">${crumb([['Home', '/'], ['Hot in Singapore']])}<h1>Hot air purifiers in Singapore</h1><div class="intro"><p>The air purifiers and monitors people keep ordering, filtered to listings that ship to Singapore and ranked by recent orders. Popular does not mean perfect, so tap through for what to check before you buy.</p><p class="upd">Updated ${TODAY}</p></div>
<ol class="board" style="margin-top:26px">${top.map(row).join('')}</ol><h2 ${h2s}>Quick answers</h2>${faqHtml(hotFaq)}</div>` }));

// ---------- Category pages ----------
for (const c of liveCats) {
  const items = catItems(c.id), path = `/c/${c.id}/`, others = liveCats.filter(x => x.id !== c.id), gd = guideFor(c.id);
  sitemap.push(path);
  await write(`c/${c.id}`, page({ title: c.title, desc: clip(`${c.h1}. ${items.length} picks ranked by recent orders, prices in S$, all shipping to Singapore.`, 155), path, image: items[0].img,
    schema: ld([{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.title, url: cfg.domain + path, inLanguage: 'en-SG', dateModified: TODAY }, itemList(items), crumbLd([['Home', '/'], [c.label, path]]), faqLd(c.faq)]),
    body: `<div class="wrap pg">${crumb([['Home', '/'], [c.label]])}<h1>${esc(c.h1)}</h1><div class="intro">${paras(c.intro)}<p class="upd">Updated ${TODAY}</p></div>
<div class="tools"><label for="sort">Sort by</label><select id="sort"><option value="sold">Most ordered</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option></select></div>
<div class="grid" id="pgrid">${items.map(card).join('')}</div>
<h2 ${h2s}>${esc(c.label)} FAQ</h2>${faqHtml(c.faq)}
<h2 ${h2s}>Read next</h2>${glist([gd])}
<h2 ${h2s}>More ways to shop</h2><p>${others.map(o => `<a href="/c/${o.id}/">${esc(o.label)}</a>`).join(' &nbsp;|&nbsp; ')}</p></div>` }));
}

// ---------- Product pages ----------
for (const p of all) {
  const c = cats[p.cat], a = await article(p, cfg, c), path = `/p/${p.slug}/`, gd = guideFor(p.cat);
  const rel = byVol.filter(x => x.cat === p.cat && x.id !== p.id).slice(0, 4), name = shortTitle(p.title);
  const secs = a.sections.map(s => ({ ...s, id: idOf(s.h) }));
  sitemap.push(path);
  const schema = ld([
    { '@context': 'https://schema.org', '@type': 'Product', name: p.title, image: p.gallery, description: a.meta, offers: { '@type': 'Offer', priceCurrency: 'SGD', price: p.price.toFixed(2), url: cfg.domain + path, availability: 'https://schema.org/InStock' } },
    articleLd(a.h1, p.img, TODAY), crumbLd([['Home', '/'], [c.label, `/c/${c.id}/`], [name, path]]), faqLd(a.faq)]);
  await write(`p/${p.slug}`, page({ title: a.title, desc: a.meta, path, image: p.img, schema, cls: 'pp', type: 'article', body: `<div class="wrap pg">${crumb([['Home', '/'], [c.label, `/c/${c.id}/`], [name]])}
<div class="prod"><div class="gal"><div class="main">${img(p.img, p.title, 640, 640, 'id="mainimg" fetchpriority="high"', 640)}</div>${p.gallery.length > 1 ? `<div class="thumbs">${p.gallery.map((g, i) => `<button type="button" data-full="${esc(g)}" aria-label="Show photo ${i + 1}"${i ? '' : ' aria-current="true"'}>${img(g, `${name} photo ${i + 1}`, 68, 68, 'loading="lazy"', 120)}</button>`).join('')}</div>` : ''}${specs(p)}</div>
<div class="buybox">${p.hot ? '<span class="tag hot" style="position:static;display:inline-block">Hot in SG</span>' : ''}<h1>${esc(a.h1)}</h1>
<div class="bigp"><b>${sgd(p.price)}</b>${off(p) ? `<s>${sgd(p.was)}</s>` : ''}</div>${meta(p)}
${buy(p, 'big')}<p class="note">Affiliate link: we earn a commission if you buy, at no extra cost to you. Price checked ${TODAY}; GST, delivery and the final total are shown at checkout.</p>
${a.quick ? `<div class="quick"><p>${md(a.quick)}</p></div>` : ''}</div></div>
<article class="post"><p class="lead">${md(a.intro)}</p><ul class="toc">${secs.map(s => `<li><a href="#${s.id}">${esc(s.h)}</a></li>`).join('')}<li><a href="#faq">FAQ</a></li></ul>
${secs.map(s => `<h2 id="${s.id}">${esc(s.h)}</h2>${paras(s.b)}`).join('')}
${a.pros && a.cons ? `<div class="pc"><div class="y"><h3>What works</h3><ul>${a.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="n"><h3>What to watch for</h3><ul>${a.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>` : ''}
<h2 id="faq">Quick answers</h2>${faqHtml(a.faq)}
<div class="endcta"><p>Ready to see the current price?</p>${buy(p, 'big')}</div>
<p class="upd">This write-up is based on the listing details and general know-how. We have not tested this specific product. Last updated ${TODAY}.</p>
<h2>Read before you buy</h2>${glist([gd, guides.find(g => g.slug === 'are-aliexpress-air-purifiers-worth-it-singapore')].filter(Boolean))}</article>
${rel.length ? `<section class="sec"><h2>More ${esc(c.label.toLowerCase())}</h2><div class="grid" style="margin-top:22px">${rel.map(card).join('')}</div></section>` : ''}</div>
<div class="bar"><b>${sgd(p.price)}</b>${buy(p, 'sm')}</div>` }));
}

// ---------- Guides ----------
const crumbG = [['Home', '/'], ['Guides', '/guides/']];
sitemap.push('/guides/');
await write('guides', page({ title: `Haze & Air Purifier Guides for Singapore | ${cfg.siteName}`, desc: 'Plain-English guides for Singapore: PSI vs PM2.5, choosing an air purifier, HDB room sizing, HEPA vs ionizers and buying from AliExpress safely.', path: '/guides/',
  schema: ld(crumbLd(crumbG)), body: `<div class="wrap pg">${crumb([['Home', '/'], ['Guides']])}<h1>Haze guides for people who check the PSI app twice an hour</h1><div class="intro"><p>Short, honest reads on haze numbers, purifier sizing, filters and buying from AliExpress without regrets.</p></div><div style="margin-top:28px">${glist(guides)}</div></div>` }));
const cadrTool = `<div class="calc"><h3>CADR calculator</h3><div class="g">
<div><label for="len">Length (m)</label><input id="len" type="number" inputmode="decimal" step="0.1" min="1" value="3.5"></div><div><label for="wid">Width (m)</label><input id="wid" type="number" inputmode="decimal" step="0.1" min="1" value="3.5"></div>
<div><label for="hgt">Ceiling (m)</label><input id="hgt" type="number" inputmode="decimal" step="0.1" min="2" value="2.6"></div><div><label for="ach">Air changes per hour</label><select id="ach"><option value="4">4 (steady)</option><option value="5" selected>5 (faster)</option><option value="6">6 (quick)</option></select></div></div>
<output id="cadrout" for="len wid hgt ach" aria-live="polite">Room volume: <b>31.9 m³</b>. For 5 air changes an hour, look for a CADR of about <b>160 m³/h</b> (94 cfm).</output>
<small>A planning rule of thumb, not a guarantee. Doors that open often, real-world performance and filter age all change the result, so leave some headroom.</small></div>`;
for (const g of guides) {
  const path = `/guides/${g.slug}/`, pickItems = (g.cat ? catItems(g.cat) : purifiers).slice(0, 4), secs = g.sections.map(s => ({ ...s, id: idOf(s.h) }));
  sitemap.push(path);
  await write(`guides/${g.slug}`, page({ title: g.title, desc: g.meta, path, image: pickItems[0]?.img, type: 'article',
    schema: ld([articleLd(g.h1, pickItems[0]?.img, g.updated || TODAY), crumbLd([...crumbG, [g.h1, path]]), faqLd(g.faq)]),
    body: `<div class="wrap pg">${crumb([['Home', '/'], ['Guides', '/guides/'], [g.title]])}<h1>${esc(g.h1)}</h1><p class="upd">Updated ${g.updated || TODAY}</p>
<article class="post" style="margin-top:20px"><div class="lead">${paras(g.intro)}</div>${g.tool === 'cadr' ? cadrTool : ''}<ul class="toc">${secs.map(s => `<li><a href="#${s.id}">${esc(s.h)}</a></li>`).join('')}<li><a href="#faq">FAQ</a></li></ul>
${secs.map(s => `<h2 id="${s.id}">${esc(s.h)}</h2>${paras(s.b)}`).join('')}<h2 id="faq">Quick answers</h2>${faqHtml(g.faq)}</article>
${pickItems.length ? `<section class="sec"><h2>Products to look at</h2><p class="sub">Most ordered right now, shipping to Singapore.</p><div class="grid" style="margin-top:22px">${pickItems.map(card).join('')}</div></section>` : ''}
<section class="sec"><h2 style="margin-bottom:12px">More guides</h2>${glist(guides.filter(x => x.slug !== g.slug).slice(0, 4))}</section></div>` }));
}

// ---------- Tool, budgets, about, disclosure, 404 ----------
sitemap.push('/tools/cadr/');
await write('tools/cadr', page({ title: 'CADR Calculator: Air Purifier Size for Your Room', desc: 'Type your room size and get the air purifier CADR (m³/h) you need for HDB bedrooms, living rooms and bigger spaces. Free, instant, Singapore-friendly.', path: '/tools/cadr/',
  schema: ld(crumbLd([['Home', '/'], ['CADR calculator', '/tools/cadr/']])), body: `<div class="wrap pg">${crumb([['Home', '/'], ['CADR calculator']])}<h1>CADR calculator</h1><div class="intro"><p>Measure your room, type it in and get the airflow to look for. Not sure what CADR means? Read the <a href="/guides/air-purifier-size-for-hdb-rooms-cadr/">room size guide</a>, or jump to <a href="/c/bedroom/">bedroom purifiers</a> and <a href="/c/living/">living room purifiers</a>.</p></div>${cadrTool}</div>` }));
for (const b of buds) {
  const items = purifiers.filter(p => p.price <= b).slice(0, 12), path = `/best/under-${b}/`, topP = items[0], cheap = [...items].sort((x, y) => x.price - y.price)[0];
  const faq = [{ q: `Are air purifiers under S$${b} any good?`, a: 'Often fine for a small room or a desk, as long as the listing states a CADR and a real HEPA grade. Expect compact units, so check your room size with the [CADR calculator](/tools/cadr/).' },
    { q: 'Do these prices include GST and delivery?', a: 'Prices are from AliExpress at our last update. GST, delivery and the final total are confirmed at checkout.' }];
  sitemap.push(path);
  await write(`best/under-${b}`, page({ title: `Best Air Purifiers Under S$${b} in Singapore`, desc: clip(`${items.length} air purifiers under S$${b} that ship to Singapore, ranked by recent orders. Top pick: ${shortTitle(topP.title)} at ${sgd(topP.price)}.`, 155), path, image: topP.img,
    schema: ld([itemList(items), crumbLd([['Home', '/'], [`Under S$${b}`, path]]), faqLd(faq)]),
    body: `<div class="wrap pg">${crumb([['Home', '/'], [`Under S$${b}`]])}<h1>Best air purifiers under S$${b}</h1><div class="intro"><p>${items.length} air purifiers at S$${b} or less that ship to Singapore, ranked by recent AliExpress orders. The most ordered is the ${esc(shortTitle(topP.title))} at ${sgd(topP.price)}, and the cheapest is the ${esc(shortTitle(cheap.title))} at ${sgd(cheap.price)}.</p><p>Cheap does not have to mean regret. Check the CADR, the filter grade and the plug, and read our <a href="/guides/are-aliexpress-air-purifiers-worth-it-singapore/">AliExpress buying guide</a> if you are new to this.</p><p class="upd">Updated ${TODAY}</p></div>
<ol class="board" style="margin-top:24px">${items.map(row).join('')}</ol><h2 ${h2s}>Quick answers</h2>${faqHtml(faq)}<h2 ${h2s}>Other budgets</h2><p>${buds.filter(x => x !== b).map(x => `<a href="/best/under-${x}/">Under S$${x}</a>`).join(' &nbsp;|&nbsp; ')}</p></div>` }));
}
sitemap.push('/about/', '/disclosure/');
await write('about', page({ title: `About ${cfg.siteName}`, desc: `How ${cfg.siteName} picks, ranks and writes about air purifiers for Singapore, and how the site makes money.`, path: '/about/', body: `<div class="wrap pg">${crumb([['Home', '/'], ['About']])}<h1>About ${esc(cfg.siteName)}</h1><div class="intro">
<p>We are an independent affiliate site about air purifiers and PM2.5 monitors, written for shoppers in Singapore. We pull current listings from AliExpress, filter them to ones that ship to Singapore, and show prices in S$.</p>
<p><b>How we rank.</b> Lists are ordered by recent order counts. That tells you what people are buying, not what is best, so every product comes with a plain-English write-up of what to check.</p>
<p><b>What we do not do.</b> We do not claim to have tested every product. Write-ups come from listing details and general know-how, and we say so on each page. We leave out ozone generators, replacement filters and wearable gadgets.</p>
<p><b>Haze data.</b> The live PSI and PM2.5 readings come from NEA via data.gov.sg. For official advice, see <a href="https://www.haze.gov.sg" rel="noopener">haze.gov.sg</a>.</p>
<p><b>How we make money.</b> Buy buttons are affiliate links. If you purchase, we may earn a commission at no extra cost to you. Details on our <a href="/disclosure/">disclosure page</a>.</p><p>Questions or corrections: ${esc(cfg.contactEmail)}</p></div></div>` }));
await write('disclosure', page({ title: `Affiliate Disclosure | ${cfg.siteName}`, desc: `How affiliate links work on ${cfg.siteName} and how we earn commissions.`, path: '/disclosure/', body: `<div class="wrap pg">${crumb([['Home', '/'], ['Disclosure']])}<h1>Affiliate disclosure</h1><div class="intro">
<p>${esc(cfg.siteName)} participates in the AliExpress affiliate program. Links to products on this site are affiliate links. If you click one and make a purchase, we may earn a commission, at no extra cost to you.</p>
<p>${esc(cfg.siteName)} is not owned or operated by AliExpress. Prices, availability, shipping times, GST and taxes are set by AliExpress and its sellers and can change. Always check the final total at checkout.</p>
<p>Rankings are based on order counts, not on payment from sellers. Commissions do not change how we write about a product. We are not a medical or health authority; for health advice during haze, follow NEA and MOH.</p></div></div>` }));
await writeFile('dist/404.html', page({ title: 'Page not found', desc: 'This page does not exist.', path: '/404.html', noindex: true, body: `<div class="wrap pg"><h1>This page disappeared into the haze</h1><div class="intro"><p>Try what is <a href="/hot/">hot in Singapore</a> or browse the <a href="/guides/">guides</a>.</p></div></div>` }));

// ---------- Sitemap, robots ----------
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map(u => `<url><loc>${cfg.domain}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('')}</urlset>`);
await writeFile('dist/robots.txt', SAMPLE ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${cfg.domain}/sitemap.xml\n`);
console.log(`Built ${all.length} product pages, ${guides.length} guides, ${sitemap.length} URLs in sitemap.`);
