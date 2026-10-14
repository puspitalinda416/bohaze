# Bo Haze: minisite affiliate AliExpress untuk niche Haze Purifier (Singapore)

Static site generator: AliExpress Affiliate API -> HTML statis -> GitHub -> Cloudflare Pages. Supabase dipakai sebagai cache artikel dan snapshot katalog.
Bahasa Inggris (en-SG), harga S$, semua tombol Buy = link affiliate (`promotion_link` dari API, sudah membawa tracking ID kamu).

## Preview lokal (tanpa API key)
```
npm run preview      # build data contoh + serve di http://localhost:4173
npm run check        # build contoh + QA otomatis (link, JSON-LD, title/meta, alt, rel=sponsored)
```
Build SAMPLE memakai produk palsu dan otomatis `noindex`. Jangan pernah dipublish.

## Deploy
1. Push folder ini ke repo GitHub.
2. Supabase: jalankan `supabase.sql` di SQL Editor.
3. Cloudflare Pages -> Connect to Git. Build command `npm run build`, output directory `dist`, Node 20+.
4. Environment variables (Secret) sesuai `.env.example`. Wajib: `ALI_APP_KEY`, `ALI_APP_SECRET`, `ALI_TRACKING_ID`. Disarankan: `GEMINI_API_KEY`.
5. Ganti `domain`, `contactEmail`, `siteName` di `config.json`. Submit `/sitemap.xml` ke Google Search Console.
6. Auto-update harian: `.github/workflows/daily-rebuild.yml` butuh secret `CF_DEPLOY_HOOK` (Deploy Hook dari Cloudflare Pages).

## Hal yang perlu kamu cek setelah build pertama
- **Mata uang.** Build mencoba `target_currency=SGD`. Kalau API menolak, otomatis ambil USD lalu konversi (kurs live dari open.er-api.com, fallback `fxUsdFallback` di config). Lihat log build baris "Mata uang API". Footer otomatis memberi catatan "converted from USD" kalau konversi terjadi. Bandingkan 2-3 harga dengan halaman AliExpress.
- **Hot in SG** = order terbanyak + `hotproduct.query` kalau akunmu punya izin. Ini sinyal popularitas listing yang ship ke SG, bukan data pembeli Singapura. Halaman sudah menjelaskan ini.
- **Widget PSI live** memakai API publik data.gov.sg dari browser pengunjung. Gagal diam-diam kalau feed tidak terjangkau (strip PSI tidak muncul). Tes sekali di domain asli.
- **Artikel produk.** Tanpa `GEMINI_API_KEY`, artikel berasal dari template per kategori + spesifikasi yang dibaca dari judul listing (CADR, grade HEPA, plug). Bagus, tapi 20-45 halaman bertemplate mirip berisiko dianggap thin content. Pakai Gemini supaya tiap artikel unik; hasilnya di-cache di Supabase (ganti `articleVersion` untuk generate ulang).
- Semua artikel berstatus "buyer's guide dari data listing", bukan review. Jangan ubah jadi klaim "sudah kami tes" kalau memang belum.

## Struktur
- `config.json`: nama, domain, kategori + keyword, filter exclude, budget.
- `scripts/lib/ali.mjs`: API + normalisasi harga SGD. `article.mjs`: template/Gemini. `templates.mjs`: HTML. `build.mjs`: perakit halaman.
- `content/guides_*.mjs`: 8 panduan SEO (edit/tambah di sini).
- `public/style.css`, `public/app.js`: desain dan PSI/kalkulator CADR.
- `scripts/test-ali.mjs`: tes offline logika mata uang.

## Minisite berikutnya (niche lain)
Duplikat repo, ganti `config.json` (kategori, keyword, exclude, `mustMatch`), tulis ulang `content/guides_*.mjs`, dan sesuaikan `POOL` di `scripts/lib/article.mjs`.
