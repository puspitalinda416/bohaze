import { esc, sgd, orders, thumb, md, plain } from './util.mjs';
import { featuresOf, specsOf } from './article.mjs';

const NAV = { bedroom: 'Bedroom', living: 'Living room', car: 'Car', desk: 'Desk', monitor: 'Monitors' };
const BANDS = [['Good', '0 to 50', '#3FA66A'], ['Moderate', '51 to 100', '#D9C03F'], ['Unhealthy', '101 to 200', '#EE8A2B'], ['Very unhealthy', '201 to 300', '#D2452F'], ['Hazardous', 'above 300', '#8E2C6B']];

export function makeTemplates(cfg, ctx) {
  const { TODAY, SAMPLE, guides, fx } = ctx;
  const off = p => (p.was > p.price ? Math.round((1 - p.price / p.was) * 100) : 0);

  const logo = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#13231F"/><g stroke-width="3.4" stroke-linecap="round"><path d="M8 14h24" stroke="#F0A22E"/><path d="M8 21h16" stroke="#F5F1E8"/><path d="M8 28h20" stroke="#F5F1E8" opacity=".55"/></g></svg>`;

  // Gauge: lima busur sama lebar (36 derajat), jarum diputar oleh app.js sesuai PSI live.
  const gauge = () => {
    const cx = 160, cy = 160, r = 118, pt = a => [cx - r * Math.cos(a * Math.PI / 180), cy - r * Math.sin(a * Math.PI / 180)].map(n => n.toFixed(1));
    const arcs = BANDS.map(([, , col], i) => { const [x1, y1] = pt(i * 36 + 1.4), [x2, y2] = pt((i + 1) * 36 - 1.4); return `<path d="M${x1} ${y1}A${r} ${r} 0 0 1 ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="22"/>`; }).join('');
    return `<div class="gauge" id="gauge"><svg viewBox="0 0 320 176" role="img" aria-label="Pollutant Standards Index gauge from Good to Hazardous">${arcs}
<g class="needle" id="needle"><line x1="160" y1="160" x2="160" y2="58" stroke="#F0A22E" stroke-width="5" stroke-linecap="round"/></g><circle cx="160" cy="160" r="10" fill="#F0A22E"/><circle cx="160" cy="160" r="3.5" fill="#13231F"/></svg>
<div class="gread"><b id="psinum">--</b><span id="psiband">24-hour PSI</span></div><p class="gnote" id="psinote">Checking NEA's latest reading...</p>
<ul class="gleg">${BANDS.map(([n, r2, c]) => `<li><i style="background:${c}"></i><b>${n}</b><span>${r2}</span></li>`).join('')}</ul>
<small>Source: NEA via data.gov.sg. Official advice at <a href="https://www.haze.gov.sg" rel="noopener">haze.gov.sg</a>.</small></div>`;
  };

  const img = (src, alt, w, h, extra = '', size = 400) => `<img src="${esc(thumb(src, size))}" data-full="${esc(src)}" onerror="if(this.dataset.full&&this.src!==this.dataset.full)this.src=this.dataset.full" alt="${esc(alt)}" width="${w}" height="${h}" ${extra}>`;
  const buy = (p, cls = '', label = 'Buy on AliExpress') => `<a class="btn buy ${cls}" href="${esc(p.link)}" target="_blank" rel="sponsored nofollow noopener" data-pid="${p.id}">${label}</a>`;
  const priceRow = p => `<p class="pr"><b>${sgd(p.price)}</b>${off(p) ? `<s>${sgd(p.was)}</s>` : ''}</p>`;
  const meta = p => `<p class="meta"><span>${orders(p.sold)}</span>${featuresOf(p).slice(0, 2).map(f => `<span>${esc(f)}</span>`).join('')}</p>`;
  const tag = p => (p.hot ? '<span class="tag hot">Hot in SG</span>' : off(p) >= 5 ? `<span class="tag">-${off(p)}%</span>` : '');

  const card = (p, lazy = true) => `<article class="card" data-price="${p.price}" data-sold="${p.sold}"><a class="ph" href="/p/${p.slug}/" tabindex="-1" aria-hidden="true">${img(p.img, p.title, 400, 400, lazy ? 'loading="lazy"' : '')}</a>${tag(p)}
<h3><a href="/p/${p.slug}/">${esc(p.title)}</a></h3>${meta(p)}${priceRow(p)}<div class="acts">${buy(p, 'sm', 'Buy now')}<a class="btn sm ghost" href="/p/${p.slug}/">Our take</a></div></article>`;

  const row = (p, i) => `<li class="brow"><span class="rank">${String(i + 1).padStart(2, '0')}</span><a class="bimg" href="/p/${p.slug}/" tabindex="-1" aria-hidden="true">${img(p.img, p.title, 96, 96, 'loading="lazy"', 200)}</a>
<div class="binfo"><a href="/p/${p.slug}/">${esc(p.title)}</a>${meta(p)}</div><div class="bprice">${priceRow(p)}</div><div class="acts">${buy(p, 'sm', 'Buy now')}<a class="btn sm ghost" href="/p/${p.slug}/">Our take</a></div></li>`;

  const specs = p => {
    const s = specsOf(p), r = [];
    if (s.cadr) r.push(['CADR', `${s.cadr} m³/h`]); if (s.hepa) r.push(['Filter', s.hepa]); if (s.room) r.push(['Coverage claim', `${s.room} m²`]); if (s.noise) r.push(['Noise', `${s.noise} dB`]);
    r.push(['Plug', s.plug ? `${s.plug} (Singapore uses Type G)` : 'Not in title. Check listing']);
    return `<dl class="specs">${r.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="cap">Read from the listing title, not tested by us.</p>`;
  };

  const faqHtml = f => `<div class="faq">${f.map(q => `<details><summary>${esc(plain(q.q))}</summary><p>${md(q.a)}</p></details>`).join('')}</div>`;
  const ld = a => `<script type="application/ld+json">${JSON.stringify(a).replace(/</g, '\\u003c')}</script>`;
  const crumbLd = l => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: l.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x[0], item: cfg.domain + x[1] })) });
  const faqLd = f => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: f.map(q => ({ '@type': 'Question', name: plain(q.q), acceptedAnswer: { '@type': 'Answer', text: plain(q.a) } })) });
  const crumb = l => `<nav class="crumb" aria-label="Breadcrumb">${l.map(([t, u]) => u ? `<a href="${u}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join('<i>/</i>')}</nav>`;

  const navItems = [['Hot in SG', '/hot/'], ...cfg.categories.map(c => [NAV[c.id] || c.label, `/c/${c.id}/`]), ['Guides', '/guides/'], ['CADR tool', '/tools/cadr/']];
  const cur = (u, path) => (u === path || (u.length > 3 && path.startsWith(u) && u !== '/c/') ? ' aria-current="page"' : '');

  const page = ({ title, desc, path, body, schema = '', image = '', cls = '', type = 'website', noindex = false }) => `<!doctype html>
<html lang="en-SG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${cfg.domain}${path}">
<link rel="alternate" hreflang="en-sg" href="${cfg.domain}${path}"><link rel="alternate" hreflang="x-default" href="${cfg.domain}${path}">
${SAMPLE || noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${cfg.domain}${path}"><meta property="og:site_name" content="${esc(cfg.siteName)}"><meta property="og:locale" content="en_SG">${image ? `<meta property="og:image" content="${esc(image.startsWith('http') ? image : cfg.domain + image)}">` : ''}
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#F5F1E8"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">${schema}</head>
<body class="${cls}"><a class="skip" href="#main">Skip to content</a>
<div class="psibar" id="psibar" hidden><div class="wrap"><i class="dot" id="psidot"></i><span id="psitext"></span><a href="/hot/">See what is selling &rarr;</a></div></div>
<header class="top"><div class="wrap"><a href="/" class="logo">${logo}<span>${esc(cfg.siteName)}</span></a><nav aria-label="Main">${navItems.map(([t, u]) => `<a href="${u}"${cur(u, path)}>${esc(t)}</a>`).join('')}</nav></div></header>
${SAMPLE ? '<p class="sample">SAMPLE PREVIEW: demo products and placeholder links. Never publish this build.</p>' : ''}
<main id="main">${body}</main>
<footer><div class="wrap"><div class="fcols">
<div><h2>${esc(cfg.siteName)}</h2><p>${esc(cfg.description)}</p><p><b>Affiliate disclosure:</b> we are an independent site, not run by AliExpress. When you buy through our links we may earn a commission, at no extra cost to you. <a href="/disclosure/">Read more</a>.</p></div>
<div><h2>Shop</h2><ul><li><a href="/hot/">Hot in Singapore</a></li>${cfg.categories.map(c => `<li><a href="/c/${c.id}/">${esc(c.label)}</a></li>`).join('')}${ctx.buds.map(b => `<li><a href="/best/under-${b}/">Under S$${b}</a></li>`).join('')}</ul></div>
<div><h2>Read</h2><ul>${guides.slice(0, 6).map(g => `<li><a href="/guides/${g.slug}/">${esc(g.h1)}</a></li>`).join('')}<li><a href="/guides/">All guides</a></li><li><a href="/tools/cadr/">CADR calculator</a></li><li><a href="/about/">About</a></li></ul></div></div>
<p class="fine">Rankings use recent AliExpress order counts on listings that ship to Singapore. Prices are in Singapore dollars, checked ${TODAY}, and can change.${fx ? ` Prices are converted from USD at about 1 USD = S$${fx.toFixed(2)} and may differ slightly at checkout.` : ''} GST, delivery and the final total are confirmed at checkout. Haze readings come from NEA via data.gov.sg. &copy; ${new Date().getFullYear()} ${esc(cfg.siteName)}</p></div></footer>
<script src="/app.js" defer></script></body></html>`;

  return { off, gauge, img, buy, priceRow, card, row, specs, faqHtml, ld, crumbLd, faqLd, crumb, page, tag, meta };
}
