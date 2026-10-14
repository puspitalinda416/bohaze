import { pick, hash, sgd, shortTitle, clip } from './util.mjs';
import { sb } from './supabase.mjs';

const E = process.env;
const GUIDE = {
  bedroom: ['room size guide', 'air-purifier-size-for-hdb-rooms-cadr'], living: ['purifier buying guide', 'how-to-choose-air-purifier-for-haze'],
  car: ['car purifier guide', 'car-air-purifier-haze-singapore'], desk: ['HEPA vs ionizer guide', 'hepa-vs-ionizer-ozone-purifiers'],
  monitor: ['PM2.5 monitor guide', 'pm25-monitor-vs-air-purifier']
};
const g = c => `[${GUIDE[c][0]}](/guides/${GUIDE[c][1]}/)`;

// ---- Specs read straight from the listing title (never invented) ----
export function specsOf(p) {
  const t = p.raw, m = re => t.match(re);
  const cadr = +(m(/cadr[^0-9]{0,8}(\d{2,4})/i)?.[1] || m(/(\d{2,4})\s*m3\s*\/?\s*h/i)?.[1] || m(/(\d{2,4})\s*m³/i)?.[1] || 0) || null;
  const hepaN = m(/\bh(1[1-4])\b|hepa ?(1[1-4])/i), hepa = hepaN ? 'H' + (hepaN[1] || hepaN[2]) + ' HEPA' : /hepa/i.test(t) ? 'HEPA (grade not stated)' : null;
  const plug = m(/\b(eu|us|uk|au|sg)\s*plug\b/i)?.[1]?.toUpperCase() || null;
  return {
    cadr, hepa, plug, room: +(m(/(\d{2,3})\s*(?:m2|m²|sqm|square ?met)/i)?.[1] || 0) || null, noise: +(m(/(\d{2})\s*db/i)?.[1] || 0) || null,
    carbon: /carbon|charcoal/i.test(t), uv: /\buv\b/i.test(t), ion: /ioniz|negative ion|anion/i.test(t), ozone: /ozone/i.test(t),
    smart: /wifi|wi-fi|tuya|\bapp\b|smart/i.test(t), display: /display|screen|aqi|sensor/i.test(t), hcho: /formaldehyde|hcho/i.test(t),
    usb: /usb|type-?c|12v|cigarette lighter/i.test(t)
  };
}
export function featuresOf(p) {
  const s = specsOf(p), f = [];
  if (s.cadr) f.push(`CADR ${s.cadr} m³/h`); if (s.hepa) f.push(s.hepa); if (s.carbon) f.push('activated carbon'); if (s.uv) f.push('UV light');
  if (s.ion) f.push('ionizer'); if (s.ozone) f.push('ozone mentioned'); if (s.smart) f.push('smart or app control'); if (s.display) f.push('display or sensor');
  if (s.hcho) f.push('formaldehyde (HCHO) sensing'); if (s.noise) f.push(`${s.noise} dB noise`); if (s.usb) f.push('USB or 12 V power'); if (s.plug) f.push(`${s.plug} plug`);
  return f.slice(0, 7);
}
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a.at(-1);
const tier = v => v < 15 ? 'about two chicken rice sets and a kopi' : v < 35 ? 'about one mid-range mall dinner' : v < 70 ? 'about a weekend brunch for two, with extras' : v < 130 ? 'about a night out in town with friends' : 'a proper appliance spend, so treat it like one';

// Computed, not claimed: the airflow a room needs at 4 to 5 air changes an hour, 2.6 m ceiling.
function insights(p, s, cat) {
  const out = [];
  if (s.cadr && (cat === 'bedroom' || cat === 'living')) {
    const lo = Math.floor(s.cadr / 13), hi = Math.floor(s.cadr / 10.4);
    out.push(`If that CADR is accurate, the maths says roughly **${lo} to ${hi} m²** of floor space at 4 to 5 air changes an hour with a 2.6 m ceiling.${s.room && s.room > hi * 1.8 ? ` The listing's coverage claim of ${s.room} m² is far more generous than that, so trust the airflow number over the coverage number.` : ''}`);
  } else if (s.room && (cat === 'bedroom' || cat === 'living')) out.push(`The listing claims coverage of about ${s.room} m² but states no CADR, which makes that claim hard to check. Ask the seller or look at recent buyer comments.`);
  if (s.ozone || s.ion) out.push('The title mentions ionizing or ozone features. Some ionizers produce ozone, a lung irritant, so check the product page for ozone emission details before you buy.');
  if (s.hepa === 'HEPA (grade not stated)') out.push('It says HEPA but not which grade. "HEPA-type" and "HEPA-like" are not the same as real HEPA, so look for H11 to H14 or a test standard on the product page.');
  return out;
}
const plugPara = (s, cat) => s.plug && !['UK', 'SG'].includes(s.plug)
  ? `The title mentions an ${s.plug} plug, which is not what Singapore sockets use. Singapore runs on 230 V with the UK-style three-pin Type G plug, so pick a listing that offers a UK or Singapore plug instead of stacking adapters on a machine that runs all night.`
  : s.plug ? `The title mentions a ${s.plug} plug, which suits Singapore's Type G sockets. Confirm it on the product page before paying.`
  : (s.usb || cat === 'car' || cat === 'desk') ? 'This one looks USB or low-voltage powered, which sidesteps the wall-plug question. Check the cable and the power source it expects.'
  : 'The listing does not state a plug type in the title. Singapore uses 230 V with the UK-style three-pin Type G plug, so confirm it on the product page and avoid improvising with cheap travel adapters.';

const SG_A = ['Delivery: AliExpress shows an estimated arrival date at checkout. Demand and shipping queues both go up when PSI spikes, so order before the app turns orange, not after.',
  'Delivery: check the estimated arrival date at checkout and whether the listing offers tracked shipping to Singapore. A purifier that arrives after the haze has cleared is a very expensive reminder.',
  'Delivery: the date at checkout is the number to trust. If you are buying with a haze forecast in mind, give yourself a buffer.'];
const SG_B = ['Seller check: look at the store rating, how long the store has been open and recent buyer photos. A 4.8 rating on a three-week-old store is not the same product as a 4.8 on a three-year-old one.',
  'Returns: read the seller return terms and the Buyer Protection window before paying. For an electrical item, that thirty seconds is cheaper than a dispute later.',
  'Seller check: filter the reviews to ones with photos and read the three-star ones first. They tend to be the most honest about noise and build quality.'];
const GST = ['GST: depending on the seller and order, GST may already be in the price or added at checkout. The total on the payment page is the only number that counts.',
  'Tax: the price you see may or may not include GST. Compare final totals, not headline prices.'];

// ---- Copy pools per category. {n}=name {p}=price {t}=price tier {g}=guide link ----
const POOL = {
  bedroom: {
    hook: ['The {n} goes in the room where you want the least drama: the bedroom. At {p} ({t}), it is a cheap way to find out whether a purifier changes how hazy nights feel.',
      'Haze season has a ritual: refresh the PSI app, close every window, stare at the ceiling fan. The {n} is {p} and aimed at the room you retreat to when the skyline disappears.',
      'A bedroom purifier sits a metre from your pillow, so noise matters as much as filtration. The {n} costs {p}, and whether it is worth it depends on how honest the specs are.'],
    fitH: 'Will it cope with a bedroom?',
    fit: ['Small rooms are forgiving. A compact purifier can turn over a small volume of air several times an hour, as long as the CADR on the listing is real. Check it against your room with the [CADR calculator](/tools/cadr/), and read our {g} before you commit.',
      'Keep the door and windows shut, run a split air-con on recirculate if you have one, and park the purifier a little away from the wall so air can get in and out. That setup does more than any spec sheet. Our {g} walks through the sizing maths.',
      "The usual trap is buying by the coverage claim. Sellers love a big square-metre number. Turn it into airflow instead: your room's volume times 4 to 5 air changes an hour, which our {g} explains."],
    suit: 'Anyone with a bedroom of roughly 8 to 15 m² who wants cleaner air at night and does not mind changing a filter every so often.',
    skip: 'Anyone trying to clean an open-plan living area, or who needs medical-grade performance. A bedroom unit has limits, and a family room with the balcony door open will test them.',
    careH: 'Filters, noise and running costs',
    care: 'Check the noise level at low speed, since that is where you will probably run it. Filters wear out faster in a long haze season, so look up the replacement filter price and availability before you buy the machine. A cheap purifier with an impossible-to-find filter is not cheap.',
    pros: ['Small footprint for bedroom use', 'Easy to run at low speed overnight', 'Low entry price compared with big-brand models'],
    cons: ['Coverage claims in listings are often generous', 'Replacement filters can be hard to find', 'Specs are written by the seller, so verify before relying on them'],
    quick: 'A compact bedroom purifier at {p}. Worth a look if the listing states a CADR and a real HEPA grade, and the plug suits Singapore sockets.',
    faq: [['Is this purifier big enough for my bedroom?', 'Work out your room volume and aim for a CADR that gives 4 to 5 air changes an hour. The [CADR calculator](/tools/cadr/) does the maths in seconds.'],
      ['Is it quiet enough to sleep next to?', 'Check the listed noise level at the lowest speed and read recent buyer comments. Specs at full speed tell you little about night use.']],
    verdict: ['Buy the {n} if the CADR and filter details check out for your room. At {p}, the downside is a decent backup purifier, not a financial crisis.',
      'The {n} is not trying to be a flagship. It is a {p} bedroom option, and the real test is whether the seller numbers hold up.',
      'If your bedroom is on the small side and the plug situation sorts itself out, the {n} is a reasonable low-cost bet. If the listing hides its CADR or filter grade, keep scrolling.']
  },
  living: {
    hook: ['Living rooms in Singapore are the open-plan battleground: one big space, a balcony door that never seals properly, and a household that keeps opening it. The {n} ({p}) is aimed at that problem.',
      'If the living room is where everyone lands after work, it is also where PM2.5 has the most doors to sneak through. The {n} is {p}, which is {t}.',
      'Bigger rooms are where cheap purifiers start over-promising. The {n} costs {p}, so let us look at what the listing actually supports.'],
    fitH: 'Will it cope with a living room?',
    fit: ['Size is everything here. Multiply floor area by ceiling height, then by 4 to 5 air changes an hour, and compare the result with the CADR on the listing. Our [CADR calculator](/tools/cadr/) does it for you, and the {g} explains the rest.',
      'Place it where air can circulate, not shoved behind the sofa, and keep balcony and main doors shut during a haze spike. A strong purifier fighting an open door is a losing match.',
      'Open-plan layouts mean one purifier is covering more than the sofa area. If the unit is borderline for your space, size up. Our {g} explains why.'],
    suit: 'Households with a living area of about 20 to 40 m² who want a single, stronger unit for the shared space and are happy to check the numbers first.',
    skip: 'Anyone who only needs to clean a bedroom (a smaller unit is quieter and cheaper), or who expects one machine to cover a whole flat with every door open.',
    careH: 'Filters, noise and running costs',
    care: 'Bigger purifiers move more air, which usually means more noise at the top speeds and a higher filter bill. Check the filter size and the price of the replacement before you commit, and decide where you will keep a spare for haze season.',
    pros: ['Higher airflow than compact units, when the CADR is real', 'Better suited to open-plan rooms', 'Often includes extras like a display or app control'],
    cons: ['Louder at full speed', 'Bigger footprint and bigger filter costs', 'Coverage claims can be optimistic'],
    quick: 'A larger-room purifier at {p}. Check the CADR against your room size before you trust the coverage claim.',
    faq: [['Is one purifier enough for a whole HDB flat?', 'Usually not with doors open. A purifier cleans the room it sits in, so one for the bedroom and one for the living room is more realistic than one machine for everything.'],
      ['What matters more, CADR or filter grade?', 'Both. A great filter with weak airflow cleans slowly, and strong airflow through a weak filter just moves air around. Look for a stated CADR and a real HEPA grade.']],
    verdict: ['The {n} is a sensible option for a shared space if the CADR holds up for your room. At {p}, it is cheaper than most name-brand options, with the usual AliExpress homework attached.',
      'Buy it if the numbers fit your room and you are comfortable with the plug and filter situation. Skip it if the listing is vague about airflow.',
      'For {p}, the {n} could be the haze-season workhorse of the flat. Do the CADR check first, and give the seller review page a proper read.']
  },
  car: {
    hook: ['Traffic on the PIE and haze make a bad combo: you are stuck in a small cabin with whatever the ventilation lets in. The {n} costs {p} and targets that cabin.',
      'Car purifiers are the most over-sold gadgets in this category, so let us be fair to the {n}: at {p}, it is a small experiment, not a cabin miracle.',
      'A car is a metal box that sits in the sun, then in a jam. The {n} ({p}) is a small add-on for that box, and here is what it can realistically do.'],
    fitH: 'How much can a car purifier do?',
    fit: ['Cabin units are small, so their airflow is small. They can help over time in a closed cabin, but they are not a substitute for recirculation mode and a clean cabin filter. Our {g} goes through the order of operations.',
      'Put it where air can reach it and where it does not block a cup holder, vent or your sightline. Run the air-con on recirculate, windows up. The purifier is the supporting actor.',
      'Any claim about cleaning a cabin in minutes deserves suspicion unless the listing shows airflow and filter details. Read our {g} before you rely on it.'],
    suit: 'Drivers who spend a lot of time in traffic, want a small extra layer, and understand it will not match a home purifier.',
    skip: 'Anyone expecting a hospital-clean cabin from a gadget that plugs into a lighter socket, or anyone drawn to units marketed as ozone or "active oxygen".',
    careH: 'Power, filters and upkeep',
    care: 'Check how it is powered (USB or 12 V), how long the cable is, and whether the filter is replaceable. Small filters clog faster in a polluted cabin, and a washable filter you never wash is not doing much.',
    pros: ['Cheap and easy to try', 'Plug-in setup with no installation', 'Useful as a supplement in a closed cabin'],
    cons: ['Limited airflow in a small unit', 'Small filters need regular replacement', 'Marketing claims often outrun the specs'],
    quick: 'A small in-car purifier at {p}. Treat it as an extra on top of recirculation mode, not a replacement for it.',
    faq: [['Do car air purifiers actually work?', 'Small ones can reduce particles in a small cabin over time, but airflow is limited. Think of them as an add-on to recirculation mode and a clean cabin filter.'],
      ['Is it safe to leave plugged in?', 'Many are designed for continuous use, but check the listing for power specs and avoid anything that markets itself as an ozone generator.']],
    verdict: ['The {n} is a cheap, low-risk experiment if you spend a lot of time in the car. Do not expect it to replace sensible habits like recirculate mode and a fresh cabin filter.',
      'At {p}, the {n} can be a useful extra layer. If the listing leans on vague "active oxygen" claims, move on.',
      'Buy it if you want a small add-on and understand the limits. Skip it if you are hoping for a single gadget to solve the haze problem.']
  },
  desk: {
    hook: ['A cubicle or work-from-home desk is a different problem: small space, one person, and an air-con vent that decides your afternoon. The {n} ({p}) is built for that tiny bubble.',
      'Desktop purifiers are for personal space, not whole rooms. The {n} is {p}, which is {t}, so expectations should match.',
      'The {n} is a small purifier for the spot where you spend eight hours a day. At {p}, it is a cheap experiment, and we will be straight about its limits.'],
    fitH: 'What a desktop purifier can and cannot do',
    fit: ['Small units move a small volume of air, so they work best in a small, enclosed space and close to you. They will not clean a room. Our {g} explains how to tell a real filter from an ionizer.',
      'Place it within an arm or two of where you sit, with nothing blocking the intake. If it is an ionizer rather than a filter, adjust your expectations accordingly.',
      'Personal purifiers are a convenience, not a substitute for a room unit on a haze day. For a whole room, check the [CADR calculator](/tools/cadr/) and the bedroom and living room picks.'],
    suit: 'Anyone with a small enclosed workspace who wants a quiet, low-cost extra and understands it is a personal-space tool.',
    skip: 'Anyone expecting it to clean a bedroom or living room, and anyone who wants a marketed "negative ion" gadget to do the job of a filter.',
    careH: 'Filters, power and upkeep',
    care: 'Check whether there is a replaceable filter or just an ionizing element, how it is powered, and how loud it gets. A silent gadget with no filter is a different product from a quiet one with a HEPA filter.',
    pros: ['Small and quiet, in most cases', 'Cheap enough to try', 'Easy to move between desk and bedside'],
    cons: ['Very limited coverage', 'Many are ionizers rather than filters', 'Marketing numbers can be hard to verify'],
    quick: 'A personal purifier at {p}. Good as an extra for a small space, not as the main defence against haze.',
    faq: [['Is a desktop purifier worth it?', 'It can make sense for a small, enclosed workspace. If you want a whole room cleaned, you need a floor-standing unit with a proper CADR.'],
      ['Do ionizers clean the air?', 'Some charge particles so they settle on surfaces rather than removing them, and some can produce ozone. A real filter with a stated airflow is the safer bet.']],
    verdict: ['The {n} is a small, cheap add-on for a small space. At {p}, it is low-risk as long as you do not expect it to replace a room purifier.',
      'Buy it if you want a personal extra and the listing is clear about filtration. Skip it if the sales copy is all "ions" and no airflow.',
      'For {p}, the {n} is a reasonable desk companion if you are realistic about what it does.']
  },
  monitor: {
    hook: ["You can't fix what you can't see, and PM2.5 is invisible until it is bad. The {n} is a {p} way to check your indoor air without trusting vibes.",
      'NEA tells you outdoor numbers. The {n} ({p}) tells you about the air in your own room, which is where you spend most of the haze season.',
      'A monitor is the honest friend of a purifier: it shows whether the machine is earning its electricity. The {n} costs {p}, which is {t}.'],
    fitH: 'How to use a PM2.5 monitor at home',
    fit: ['Put it at breathing height, away from the purifier outlet, windows and cooking areas. Compare the reading with the outdoor numbers from NEA to see how well your home holds up. Our {g} explains what the readings mean.',
      'Use it to spot trends: what happens when you cook, open a door or turn the purifier on. The absolute number matters less than the change.',
      'Consumer sensors are not lab instruments. Treat the reading as a useful indicator and read our {g} for how to interpret it.'],
    suit: 'Anyone who wants to see whether their purifier is doing anything, compare rooms, or just stop guessing about air quality at home.',
    skip: 'Anyone expecting lab-grade accuracy, or who wants a monitor to replace NEA readings. It complements them.',
    careH: 'Sensors, calibration and upkeep',
    care: 'Optical sensors can drift and read higher in humid air, which Singapore has plenty of. Keep the vent clear, avoid placing it near steam, and compare it against NEA readings now and then to catch drift.',
    pros: ['Shows what is happening in your own room', 'Helps check whether a purifier is working', 'Much cheaper than a lab-grade device'],
    cons: ['Consumer sensors are not lab-grade', 'Humidity can skew readings', 'Extra gadget to charge or plug in'],
    quick: 'A PM2.5 monitor at {p}. Use it for trends and comparisons, not for arguing with NEA.',
    faq: [['Are cheap PM2.5 monitors accurate?', 'They are fine for trends and comparisons, less so for exact numbers. Check how the reading behaves over a few days.'],
      ['Do I need a monitor if I have a purifier?', 'Not strictly. A monitor helps you see when the purifier is working hard and compare rooms.']],
    verdict: ['The {n} is a sensible way to see your indoor air. At {p}, it is a small spend for a lot of clarity, as long as you treat the numbers as a guide.',
      'Buy it if you like data and want to check your purifier. Skip it if you only want a quick answer, in which case just run the purifier.',
      'For {p}, the {n} can turn "I think it is hazy" into a number. Use it for trends.']
  }
};


// Pilih template judul pertama yang muat <= 60 karakter; kalau semua kepanjangan, potong NAMA produknya, bukan kalimatnya.
function fitTitle(name, price, id) {
  const T = [n => `${n}: Worth It in Singapore? (${price})`, n => `${n} for Haze in Singapore (${price})`, n => `Is the ${n} Worth ${price}?`];
  const start = hash(id) % T.length, order = [0, 1, 2].map(i => T[(start + i) % T.length]);
  const fit = order.find(f => f(name).length <= 60);
  if (fit) return fit(name);
  const f = order[0], room = 60 - f('').length;
  return f(clip(name, Math.max(12, room)).replace(/…$/, ''));
}

function fallback(p, cfg, c) {
  const C = POOL[p.cat], s = specsOf(p), feats = featuresOf(p), name = shortTitle(p.title), price = sgd(p.price);
  const f = t => t.replaceAll('{n}', name).replaceAll('{p}', price).replaceAll('{t}', tier(p.price)).replaceAll('{g}', g(p.cat));
  const noun = p.cat === 'monitor' ? 'air quality monitor' : 'air purifier';
  const ins = insights(p, s, p.cat);
  return {
    title: fitTitle(name, price, p.id),
    meta: clip(`${name} at ${price} on AliExpress, shipping to Singapore. What to check on airflow, filters, plug and GST before you buy.`, 155),
    h1: `${name}: what to know before you buy in Singapore`,
    quick: f(C.quick),
    intro: f(pick(C.hook, p.id, 1)),
    sections: [
      { h: `What you get with the ${name}`, b: [`It is an ${noun} listed at ${price}${p.was > p.price ? ` (marked down from ${sgd(p.was)})` : ''}, with ${p.sold.toLocaleString('en-US')}+ recent orders${p.rate ? ` and a ${p.rate} positive rating` : ''}.`,
        feats.length ? `The listing title mentions: ${list(feats)}. Confirm the details on the product page, because titles are written by sellers, not by an editor with a conscience.` : 'The title does not give much to go on, so check the product page for airflow, filter type and power details before you commit.', ...ins] },
      { h: C.fitH, b: f(pick(C.fit, p.id, 2)) },
      { h: 'Who should buy it, and who should skip it', b: [`**Good fit:** ${C.suit}`, `**Skip it if:** ${C.skip}`] },
      { h: C.careH, b: f(C.care) },
      { h: 'Buying from AliExpress in Singapore', b: [plugPara(s, p.cat), pick(SG_A, p.id, 3), pick(GST, p.id, 4), pick(SG_B, p.id, 5)] },
      { h: 'The verdict', b: f(pick(C.verdict, p.id, 6)) }
    ],
    pros: C.pros, cons: C.cons,
    faq: [...C.faq.map(([q, a]) => ({ q, a })), { q: 'Does this ship to Singapore?', a: 'Listings on this site are requested for Singapore delivery and shown in S$. Confirm the delivery estimate, GST and final price at checkout.' }]
  };
}

// ---- Gemini (optional) ----
let cand;
async function models() {
  if (cand) return cand;
  if (E.GEMINI_MODEL) return (cand = [E.GEMINI_MODEL]);
  const fb = ['gemini-2.5-flash', 'gemini-3-flash-preview'];
  try {
    const r = await (await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': E.GEMINI_API_KEY } })).json();
    const v = n => +(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);
    const names = (r.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace('models/', ''))
      .filter(n => /flash/.test(n) && !/lite|tts|image|live|audio|computer|embed|thinking|exp/.test(n)).sort((a, b) => (/preview/.test(a) - /preview/.test(b)) || v(b) - v(a));
    cand = names.length ? names.slice(0, 3) : fb;
  } catch { cand = fb; }
  return cand;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const tidy = s => typeof s === 'string' ? s.replace(/\s*—\s*|\s+–\s+/g, ', ') : s;

export async function article(p, cfg, c) {
  const id = `sg${cfg.articleVersion}-${p.id}`;
  const hit = await sb('GET', `articles?id=eq.${id}&select=data`);
  if (hit?.[0]) return hit[0].data;
  let a = fallback(p, cfg, c), ok = false;
  const name = shortTitle(p.title);
  const prompt = `Write a 700-word SEO buyer's-guide style article (NOT a hands-on review: never claim to have tested, used or received the product; base it on the listing and general know-how) for shoppers in Singapore about this product listed on AliExpress: "${p.raw}", price ${sgd(p.price)} (SGD), ${p.sold} recent orders, positive rating ${p.rate || 'n/a'}. Category: ${c.label} (${c.mood}). Features visible in the title: ${featuresOf(p).join(', ') || 'none stated'}.
Reader: Singapore resident, 25-50, HDB or condo, worried about haze, wants a sensible low-cost purchase.
Voice: casual, witty, relatable to Singaporeans (refreshing the PSI app, HDB bedrooms, split air-con, the skyline vanishing). Singlish at most once or twice and only if natural. BANNED: marketing cliches and slogans ("elevate", "must-have", "game changer", "breathe easy", "say goodbye to", "peace of mind", "perfect for any"), emojis, em dashes. Be honest and include real cons.
Rules: only state specs you can infer from the title; never invent numbers, certifications, filter grades, noise levels or materials. If a detail is unknown, say to check the listing. No medical claims (never say it protects health or prevents illness). Mention Singapore buying points: Singapore uses 230 V and the UK-style three-pin Type G plug, GST and delivery estimate are shown at checkout, seller rating and return terms, filter replacement availability. NEA's 24-hour PSI and 1-hour PM2.5 bands may be mentioned but do not invent readings. Do not mention luxury brands.
Primary keyword: "${name}" (use it in the intro, one H2 and the verdict). Natural internal links allowed with markdown: [CADR calculator](/tools/cadr/), [how to choose an air purifier for haze](/guides/how-to-choose-air-purifier-for-haze/), [air purifier size guide](/guides/air-purifier-size-for-hdb-rooms-cadr/), [PSI vs PM2.5](/guides/psi-vs-pm25-singapore-haze-explained/).
Return ONLY JSON: {"title":"<=58 chars, includes 'Singapore' and either 'Worth It' or the price","meta":"<=155 chars","h1":"","quick":"one-sentence short version, <=200 chars","intro":"","sections":[{"h":"","b":""}] (5-6 sections, last is 'The verdict'),"pros":["","",""],"cons":["","",""],"faq":[{"q":"","a":""}] (3 items)}`;
  if (E.GEMINI_API_KEY) for (let t = 0; t < 3 && !ok; t++) try {
    await wait(5000 * (t + 1));
    const ms = await models(), m = ms[t % ms.length];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, { method: 'POST',
      headers: { 'x-goog-api-key': E.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4500 } }) });
    if (!res.ok) throw new Error(`HTTP ${res.status} (${m}): ${(await res.text()).slice(0, 200)}`);
    const j = JSON.parse((await res.json()).candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim());
    if (!j.h1 || !j.sections?.length || !j.faq?.length) throw new Error('bad JSON shape');
    a = { ...a, ...j, title: clip(tidy(j.title || a.title), 60), meta: clip(tidy(j.meta || a.meta), 155), h1: tidy(j.h1), quick: tidy(j.quick), intro: tidy(j.intro),
      sections: j.sections.map(s => ({ h: tidy(s.h), b: tidy(s.b) })), faq: j.faq.map(x => ({ q: tidy(x.q), a: tidy(x.a) })) };
    ok = true;
  } catch (e) { console.warn(`Gemini attempt ${t + 1} failed for ${p.id}: ${e.message}`); }
  if (ok) await sb('POST', 'articles', { id, data: a }, { Prefer: 'resolution=merge-duplicates' });
  return a;
}
