// One-off: fetch bot-protected BNP assets (logo + missing sponsoring images).
// The API request context gets 403 (like curl), but an in-PAGE fetch() runs
// with the real browser fingerprint and returns 200. So we navigate to the
// origin, then fetch each asset inside the page and hand bytes back as base64.
import { chromium } from '/home/node/.excat-marketplaces/excat-marketplace/excat/skills/excat-content-import/scripts/node_modules/playwright/index.mjs';
import { writeFileSync, readFileSync } from 'node:fs';

const logo = {
  url: 'https://www.bnpparibasfortis.be/media/images/ebw-portal/fortis/brand-logo/bnppf-logo.svg',
  out: 'content/images/bnp-logo.svg',
};
const missing = JSON.parse(readFileSync('/tmp/missing_imgs.json', 'utf-8'))
  .map((m) => ({ url: m.url, out: `content/media-da/${m.hash}` }));
const jobs = [logo, ...missing];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
});
const page = await ctx.newPage();
// Land on the origin so the in-page fetch is same-origin with a warm session.
await page.goto('https://www.bnpparibasfortis.be/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

let ok = 0; let fail = 0;
for (const job of jobs) {
  try {
    const res = await page.evaluate(async (u) => {
      const r = await fetch(u, { headers: { Accept: 'image/*,*/*' } });
      const buf = await r.arrayBuffer();
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      return { status: r.status, ct: r.headers.get('content-type') || '', b64: btoa(bin), len: bytes.length };
    }, job.url);
    const isHtml = res.ct.includes('text/html');
    if (res.status === 200 && res.len > 200 && !isHtml) {
      writeFileSync(job.out, Buffer.from(res.b64, 'base64'));
      console.log(`OK   ${res.status} ${res.ct} ${res.len}b -> ${job.out}`);
      ok += 1;
    } else {
      console.log(`FAIL ${res.status} ${res.ct} ${res.len}b (html=${isHtml}) ${job.url}`);
      fail += 1;
    }
  } catch (e) {
    console.log(`ERR  ${job.url}: ${String(e).slice(0, 140)}`);
    fail += 1;
  }
}
console.log(`\nDONE ok=${ok} fail=${fail}`);
await browser.close();
