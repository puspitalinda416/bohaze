// Peningkatan progresif: halaman tetap berfungsi penuh tanpa JS. Widget PSI gagal diam-diam kalau feed NEA tidak terjangkau.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---- Live PSI & PM2.5 (NEA via data.gov.sg) ----
  const BASE = 'https://api-open.data.gov.sg/v2/real-time/api/';
  const PSI_BANDS = [[50, 'Good', '#3FA66A', 'Clear skies. Good time to sort out a purifier before everyone else remembers they need one.'],
    [100, 'Moderate', '#D9C03F', 'Not alarming, but the family chat has probably started sharing PSI screenshots.'],
    [200, 'Unhealthy', '#EE8A2B', 'Windows shut, air-con on recirculate, purifier running. Follow NEA\'s advisory.'],
    [300, 'Very unhealthy', '#D2452F', 'Stay indoors where you can and follow NEA\'s advisories.'],
    [Infinity, 'Hazardous', '#8E2C6B', 'Follow NEA and MOH advisories closely.']];
  const pmBand = v => (v <= 55 ? 'Normal' : v <= 150 ? 'Elevated' : v <= 250 ? 'High' : 'Very high');
  const bandOf = v => { const i = PSI_BANDS.findIndex(b => v <= b[0]); return [i, PSI_BANDS[i]]; };
  const EDGES = [0, 50, 100, 200, 300, 400]; // lima busur sama lebar (36 derajat per band)
  const needleDeg = v => {
    v = Math.max(0, Math.min(400, v));
    const i = Math.max(0, EDGES.findIndex((e, k) => k > 0 && v <= e) - 1), f = (v - EDGES[i]) / (EDGES[i + 1] - EDGES[i]);
    return -90 + (i + Math.min(1, f)) * 36;
  };
  const regional = (r, k) => { const o = r?.[k]; if (!o) return null; if (typeof o.national === 'number') return o.national; const n = Object.values(o).filter(x => typeof x === 'number'); return n.length ? Math.max(...n) : null; };
  const get = async path => { const r = await fetch(BASE + path, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); const d = await r.json(); return (d.data || d).items?.[0]?.readings; };

  async function psi() {
    const bar = $('#psibar'); if (!bar) return;
    let c; try { c = JSON.parse(sessionStorage.getItem('psi') || 'null'); } catch { c = null; }
    let out = c && Date.now() - c.t < 600000 ? c : null;
    if (!out) try {
      const [a, b] = await Promise.all([get('psi'), get('pm25').catch(() => null)]);
      out = { t: Date.now(), psi: regional(a, 'psi_twenty_four_hourly'), pm: regional(b, 'pm25_one_hourly') };
      try { sessionStorage.setItem('psi', JSON.stringify(out)); } catch { /* storage penuh/diblok: abaikan */ }
    } catch { return; }
    if (typeof out.psi !== 'number') return;
    const [, [, name, col, msg]] = bandOf(out.psi);
    $('#psidot').style.background = col;
    $('#psitext').textContent = `Singapore now: PSI ${out.psi} (${name})${typeof out.pm === 'number' ? ` · 1-hr PM2.5 ${out.pm} µg/m³ (${pmBand(out.pm)})` : ''}`;
    bar.hidden = false;
    const n = $('#psinum'); if (n) {
      n.textContent = out.psi; $('#psiband').textContent = `${name} · 24-hour PSI`; $('#psinote').textContent = msg;
      requestAnimationFrame(() => { $('#needle').style.transform = `rotate(${needleDeg(out.psi)}deg)`; });
    }
  }
  psi();

  // ---- Sort kategori ----
  const sort = $('#sort'), grid = $('#pgrid');
  if (sort && grid) sort.addEventListener('change', () => {
    const k = sort.value, items = $$('.card', grid);
    items.sort((a, b) => k === 'low' ? a.dataset.price - b.dataset.price : k === 'high' ? b.dataset.price - a.dataset.price : b.dataset.sold - a.dataset.sold);
    items.forEach(i => grid.appendChild(i));
  });

  // ---- Galeri produk ----
  const main = $('#mainimg');
  $$('.thumbs button').forEach(b => b.addEventListener('click', () => {
    main.src = b.dataset.full; $$('.thumbs button').forEach(x => x.removeAttribute('aria-current')); b.setAttribute('aria-current', 'true');
  }));

  // ---- Kalkulator CADR: volume ruangan x air changes per jam ----
  const L = $('#len'), W = $('#wid'), H = $('#hgt'), A = $('#ach'), out = $('#cadrout');
  if (L && out) {
    const calc = () => {
      const l = +L.value, w = +W.value, h = +H.value, a = +A.value;
      if (!(l > 0 && w > 0 && h > 1.8 && h < 6)) { out.textContent = 'Enter length, width and ceiling height in metres.'; return; }
      const vol = l * w * h, need = Math.ceil(vol * a / 5) * 5;
      const cat = l * w <= 16 ? ['/c/bedroom/', 'bedroom and small room picks'] : ['/c/living/', 'living room picks'];
      out.innerHTML = `Room volume: <b>${vol.toFixed(1)} m³</b>. For ${a} air changes an hour, look for a CADR of about <b>${need} m³/h</b> (${Math.round(need * 0.5886)} cfm). <a href="${cat[0]}" style="color:#F0A22E">See ${cat[1]}</a>.`;
    };
    [L, W, H, A].forEach(e => e.addEventListener('input', calc));
  }
})();
