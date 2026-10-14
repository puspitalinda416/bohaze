// Data contoh untuk PREVIEW LOKAL saja (SAMPLE=1). Tidak pernah dipakai di build produksi.
// Beberapa judul sengaja "jebakan" (filter pengganti, ozone, kalung) untuk memastikan filter exclude bekerja.
import { mkdir, writeFile } from 'node:fs/promises';
import { cleanTitle, slugify } from './util.mjs';

const body = {
  tower: (c1, c2) => `<rect x="130" y="50" width="140" height="300" rx="34" fill="${c1}"/><g stroke="${c2}" stroke-width="4" stroke-linecap="round" opacity=".55">${Array.from({ length: 8 }, (_, i) => `<path d="M156 ${84 + i * 14}h88"/>`).join('')}</g><circle cx="200" cy="262" r="30" fill="${c2}"/><circle cx="200" cy="262" r="12" fill="#F0A22E"/><rect x="170" y="316" width="60" height="8" rx="4" fill="${c2}" opacity=".7"/>`,
  cube: (c1, c2) => `<rect x="86" y="86" width="228" height="228" rx="36" fill="${c1}"/><circle cx="200" cy="200" r="78" fill="${c2}"/><g stroke="${c1}" stroke-width="6" stroke-linecap="round" opacity=".6">${Array.from({ length: 6 }, (_, i) => `<path d="M${140 + i * 24} 150v100"/>`).join('')}</g><circle cx="276" cy="124" r="7" fill="#F0A22E"/>`,
  drum: (c1, c2) => `<rect x="118" y="96" width="164" height="230" rx="18" fill="${c1}"/><ellipse cx="200" cy="96" rx="82" ry="22" fill="${c2}"/><ellipse cx="200" cy="96" rx="58" ry="12" fill="${c1}" opacity=".5"/><rect x="150" y="190" width="100" height="56" rx="10" fill="${c2}" opacity=".85"/><circle cx="270" cy="140" r="6" fill="#F0A22E"/>`,
  car: (c1, c2) => `<path d="M150 120h100l-14 214h-72z" fill="${c1}"/><ellipse cx="200" cy="120" rx="50" ry="14" fill="${c2}"/><g stroke="${c2}" stroke-width="5" stroke-linecap="round">${Array.from({ length: 5 }, (_, i) => `<path d="M170 ${176 + i * 22}h60"/>`).join('')}</g><circle cx="200" cy="300" r="7" fill="#F0A22E"/>`,
  desk: (c1, c2) => `<rect x="130" y="170" width="140" height="150" rx="26" fill="${c1}"/><rect x="150" y="186" width="100" height="28" rx="14" fill="${c2}"/><circle cx="200" cy="268" r="26" fill="${c2}"/><circle cx="200" cy="268" r="9" fill="#F0A22E"/>`,
  monitor: (c1, c2, n) => `<rect x="96" y="110" width="208" height="180" rx="22" fill="${c1}"/><rect x="116" y="130" width="168" height="110" rx="10" fill="#0d1b17"/><text x="200" y="196" text-anchor="middle" font-family="monospace" font-weight="700" font-size="52" fill="#7CF7C0">${n}</text><text x="200" y="224" text-anchor="middle" font-family="monospace" font-size="14" fill="#7CF7C0">PM2.5 ug/m3</text><circle cx="200" cy="266" r="7" fill="${c2}"/>`
};
const svg = (kind, c1, c2, bg, n) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><ellipse cx="200" cy="360" rx="110" ry="12" fill="#13231F" opacity=".12"/>${body[kind](c1, c2, n)}</svg>`;

const D = [
  // cat, title, price, was, sold, kind, body color, accent color
  ['bedroom', '2025 New HEPA H13 Air Purifier For Home Bedroom Quiet CADR 160m3/h PM2.5 Display UK Plug Hot Sale', 49.9, 89, 5400, 'tower', '#F2EFE6', '#CFC8B4'],
  ['bedroom', 'Mini Air Purifier Small Room H13 True HEPA Activated Carbon 25dB Night Light', 29.5, 52, 12800, 'cube', '#E8EEF0', '#B7C7CC'],
  ['bedroom', 'Smart Wifi Air Purifier Bedroom CADR 200 m3/h H12 HEPA Tuya App Control EU Plug', 68, 110, 2300, 'drum', '#EFE8E2', '#C9B8A8'],
  ['bedroom', 'Negative Ion Air Purifier Bedroom Ionizer Ozone Quiet Cleaner', 18.9, 30, 890, 'cube', '#E5E9E2', '#A9B8A4'],
  ['bedroom', 'Replacement HEPA Filter for Xiaomi Air Purifier 4 Compatible', 12, 20, 20000, 'cube', '#fff', '#ccc'],
  ['bedroom', 'Quiet Air Cleaner HEPA Filter For Bedroom Home 40m2 Coverage', 35, 60, 1500, 'drum', '#E9ECF3', '#B9C0D6'],
  ['living', 'Large Room Air Purifier CADR 400m3/h H13 HEPA 60m2 Coverage App PM2.5 Display UK Plug', 129, 220, 3100, 'tower', '#E6EDE9', '#A8C0B5'],
  ['living', 'Air Purifier For Home Living Room H14 HEPA Carbon Filter CADR 300m3/h Smart', 99, 180, 1700, 'tower', '#F3ECDF', '#D4C3A0'],
  ['living', 'Air Cleaner 3-Stage Filtration HEPA 500m3/h 80m2 Large Space', 149, 260, 950, 'tower', '#ECEAF2', '#BFBAD6'],
  ['living', 'Smart Wifi Air Purifier Tower PM2.5 Sensor Display 350m3/h H13 US Plug', 118, 190, 2800, 'drum', '#E4ECF0', '#A9C3CF'],
  ['living', 'Air Purifier Humidifier 2in1 HEPA Large Room Quiet', 85, 140, 640, 'cube', '#F0E8E8', '#D2B6B6'],
  ['car', 'Car Air Purifier HEPA Filter USB Negative Ion Cup Holder', 22.5, 38, 6700, 'car', '#E8E8EC', '#B4B4C4'],
  ['car', 'Car Air Purifier H13 HEPA 12V Cigarette Lighter Carbon', 31, 55, 2100, 'car', '#EAEEE6', '#B5C2A8'],
  ['car', 'Car Air Purifier PM2.5 Display HEPA Carbon USB Type-C', 39.9, 70, 1200, 'car', '#EFE9E1', '#CDBDA5'],
  ['car', 'Car Air Freshener Ozone Sterilizer Deodorizer', 15, 25, 3000, 'car', '#fff', '#ccc'],
  ['desk', 'Desktop Air Purifier USB HEPA Mini Quiet Personal', 24.9, 42, 4300, 'desk', '#EBEAF0', '#BDBBD0'],
  ['desk', 'Portable Air Purifier Personal H13 HEPA Filter USB Rechargeable Battery', 38.5, 66, 1900, 'desk', '#E6EEEC', '#A9C7C0'],
  ['desk', 'Personal Air Purifier Ionizer Desktop Negative Ion Cleaner', 16.5, 28, 2600, 'desk', '#F1ECE0', '#D3C7A6'],
  ['desk', 'Wearable Air Purifier Necklace Negative Ion', 9.9, 18, 8000, 'desk', '#fff', '#ccc'],
  ['monitor', 'PM2.5 Air Quality Monitor Detector HCHO TVOC Digital Display Indoor', 27.9, 48, 3900, 'monitor', '#E7E9EE', '#9AA3BF', '35'],
  ['monitor', 'Air Quality Monitor WiFi PM2.5 CO2 Tuya Smart Detector', 58, 95, 1400, 'monitor', '#EEE9E1', '#BFA97F', '18'],
  ['monitor', 'PM2.5 Detector Meter Portable Laser Sensor Rechargeable', 33, 54, 2200, 'monitor', '#E5EDE9', '#9BBBAE', '62'],
  ['monitor', 'Smart Air Quality Detector HCHO TVOC CO2 PM2.5 Display Rechargeable', 46, 80, 1000, 'monitor', '#EBE7EE', '#B5A6C6', '27']
];

export async function sampleCatalog(dir) {
  await mkdir(`${dir}/sample`, { recursive: true });
  const out = [];
  for (const [i, [cat, raw, price, was, sold, kind, c1, c2, n]] of D.entries()) {
    const id = String(9000000 + i), title = cleanTitle(raw);
    await writeFile(`${dir}/sample/${id}-a.svg`, svg(kind, c1, c2, '#F7F3EA', n));
    await writeFile(`${dir}/sample/${id}-b.svg`, svg(kind, c2, c1, '#EDE6D4', n));
    out.push({ id, raw, title, img: `/sample/${id}-a.svg`, gallery: [`/sample/${id}-a.svg`, `/sample/${id}-b.svg`], price, was, rate: `${92 + (i % 6)}.${i % 10}%`, sold,
      link: `https://example.com/sample-affiliate/${id}`, hot: sold > 5000, cat, slug: slugify(title, id) });
  }
  return out;
}
