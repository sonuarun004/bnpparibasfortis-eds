# BNP Paribas Fortis — EDS Technical & Authoring Guide

A reference for developers and authors working on the BNP Paribas Fortis Edge
Delivery Services (EDS / xwalk) site. Covers the site architecture, blocks,
global header/footer, the MSM (Multi Site Manager) setup, fragment editing, and
day-to-day authoring workflows.

> **Project type:** AEM Edge Delivery Services, xwalk (Universal Editor authoring).
> **Repo:** `sonuarun004/bnpparibasfortis-eds` · **Content root:** `/content/bnpparibasfortis`
> **DAM:** `/content/dam/bnpparibasfortis` · **AEM author:** `author-p9652-e115365.adobeaemcloud.com`

---

## 1. Environments & URLs

| Environment | URL |
|-------------|-----|
| Local dev | `http://localhost:3000/` (via `aem up`) |
| Production preview | `https://main--bnpparibasfortis-eds--sonuarun004.aem.page/` |
| Production live | `https://main--bnpparibasfortis-eds--sonuarun004.aem.live/` |
| Feature preview | `https://<branch>--bnpparibasfortis-eds--sonuarun004.aem.page/` |

**Local dev server:**
```bash
npx -y @adobe/aem-cli up --no-open --html-folder content --prefer-plain-html \
  --addr '*' --port 3000 --url https://main--bnpparibasfortis-eds--sonuarun004.aem.page
```
Local content is served from `content/`; anything missing is proxied from `aem.page`.

**Delivery mapping** (`paths.json`): the site root `/content/bnpparibasfortis/` maps
to `/`, so an AEM path like `/content/bnpparibasfortis/be/nl/…/sponsoring` is
delivered at `/be/nl/…/sponsoring`.

---

## 2. Content structure (MSM)

The site is set up for **Multi Site Manager** with a Dutch language master and
per-country Live Copies. First country = Belgium (BE) in NL / FR / EN.

```
/content/bnpparibasfortis
├── language-masters/                 ← BLUEPRINTS (authored + translated)
│   ├── nl   ← MASTER (source of truth, authored first)
│   ├── fr   ← language copy of nl, then translated   (created on AEM author)
│   └── en   ← language copy of nl, then translated   (created on AEM author)
└── be/                               ← BELGIUM country site (LIVE COPIES)
    ├── nl   ← Live Copy of language-masters/nl
    ├── fr   ← Live Copy of language-masters/fr        (created on AEM author)
    └── en   ← Live Copy of language-masters/en        (created on AEM author)
```

**Rollout direction:** author `language-masters/nl` → language-copy + translate
into `fr`/`en` → each `be/{lang}` is a Live Copy that inherits master changes on
rollout. New countries later (e.g. `lu/`) = new Live Copies from the same masters,
no re-authoring.

**What exists in the repo today (EDS side):**
- `content/language-masters/nl/…/sponsoring` — the NL master seed
- `content/be/nl/…/sponsoring` — the Belgium NL Live-Copy seed

**Pending on the AEM author instance** (see the full runbook at
`migration-work/msm-setup-runbook.md`): create the blueprint folders, the `fr`/`en`
language copies, the rollout config, and the `be/{nl,fr,en}` Live Copies, then
publish. `helix-query.yaml` already excludes `/language-masters/**` from the public
index/sitemap so blueprint pages aren't indexed.

---

## 3. Page content blocks

The sponsoring page uses these content blocks (all Universal-Editor authorable,
each with a `_<block>.json` model):

| Block | Purpose | Model fields |
|-------|---------|--------------|
| `columns-feature` | Alternating image/text pillar rows | image + heading/text (columns pattern) |
| `cards-partner` | Partnership initiative cards | card: image, text |
| `accordion-faq` | Accessible FAQ accordion | item: summary, text |

Default content (H1, intro, section headings) is authored as plain content, not
blocks. After editing any `_<block>.json`, run:
```bash
npm run build:json   # regenerates component-definition/models/filters
npm run lint         # validates JS, CSS, and xwalk models
```

**Images on content pages** are DAM/content-bus assets, delivered as
`/media_<hash>.<ext>` and optimized by the EDS pipeline.

---

## 4. Global header & footer

### 4.1 Architecture (standard EDS pattern)

The header and footer are **global**, edited once and shown on every page. They
are decorated by `blocks/header/header.js` and `blocks/footer/footer.js`.

- **Header** — content-first **fragment**. `header.js` fetches `content/nav.plain.html`
  (dual-fetch: `/content/nav.plain.html` then `/nav.plain.html`) and builds the
  utility bar (logo, audience tabs, search, language) + main nav with click
  megamenus.
- **Footer** — **hybrid**. `footer.js` decorates an authored **Footer block** when
  present (Universal-Editor editable), and otherwise falls back to fetching the
  `content/footer.plain.html` fragment. See §4.3.

### 4.2 Brand imagery (logo, Card Stop icon)

Header logo and footer logo/Card Stop icon are served from the **code repo**
`/icons/` (`icons/bnppf-logo.svg`, `icons/stopcard.png`), NOT from the nav/footer
fragments. Reason: content-bus ingestion strips `<img>` from fragments on publish,
so referencing code assets guarantees they render on all published environments.

> **Known gap:** because these use absolute `/icons/…` paths, they render on the
> published site but appear **missing inside the AEM author / Universal Editor
> preview** (that host can't serve the EDS code origin). This is cosmetic (editing
> view only). To fix, upload the icons to `/content/dam/bnpparibasfortis` and point
> `header.js`/`footer.js` at the DAM paths — requires the Adobe credential opt-in.

### 4.3 Footer as a Universal-Editor block

The footer can be authored in Universal Editor via the `footer` block model
(`blocks/footer/_footer.json`):

- **Footer** (container) — fields: `cardstop` (label + phone), `legal` (links),
  `copyright`.
- **Footer Column** (repeatable item) — fields: `heading`, `links`.

**Import block table** (full detail in `migration-work/footer-import-block-table.md`;
ready-to-ingest markup in `tools/importer/footer-block-source.html`):

| Row | Cell 1 | Cell 2 |
|-----|--------|--------|
| Footer Column | `Ons aanbod` | link list |
| Footer Column | `Help en Contact` | link list |
| Footer Column | `Over ons` | link list |
| Card Stop | label + `tel:` phone | — |
| Legal | legal links list | — |
| Copyright | copyright text | — |

`footer.js` classifies rows by signature: two-cell → column; single cell with a
`tel:` link → Card Stop; single cell with `<ul>` → legal links; single cell text →
copyright. Ordering is not strict.

### 4.4 Fragment pages render once

When the `nav` or `footer` fragment is opened as a **standalone page** (`/nav`,
`/footer`), `scripts.js` skips injecting the global header/footer chrome, so the
fragment isn't rendered twice. Real content pages are unaffected (header + footer
appear once). Guard: `isFragmentPage()` in `scripts/scripts.js`.

---

## 5. Editing the header / footer

### 5.1 Edit fragment content (text)
- Header links/labels/language: edit `content/nav.plain.html`.
- Footer content: edit `content/footer.plain.html` (or author the Footer block).
- Then **preview + publish** the fragment path so every page picks it up:
```bash
curl -X POST "https://admin.hlx.page/preview/sonuarun004/bnpparibasfortis-eds/main/nav"
curl -X POST "https://admin.hlx.page/live/sonuarun004/bnpparibasfortis-eds/main/nav"
# same for /footer
```
(Credentials are injected automatically when the Adobe opt-in is enabled — never
paste a token.)

### 5.2 Preview the fragments in isolation
Use the standalone fragment preview (Experience-Fragment-style), which loads the
real CSS/JS and the live nav/footer fragments:
```
/tools/preview/fragments.html
```
Toolbar toggles: Header+Footer / Header only / Footer only, and Desktop / Mobile.

### 5.3 Author the footer in Universal Editor
Requires the Footer block content to exist in AEM (ingest
`tools/importer/footer-block-source.html`, or add the **Footer** component in UE and
fill the fields). Header remains a text-edited fragment (its megamenu is intentionally
not modeled for UE).

---

## 6. Content import (how pages were migrated)

Pages are imported with the project's bundled importer, not hand-written:
- Page template + block mappings: `tools/importer/page-templates.json`
- Parsers: `tools/importer/parsers/{columns-feature,cards-partner,accordion-faq}.js`
- Transformer (site cleanup): `tools/importer/transformers/bnpparibasfortis-cleanup.js`
- Import script: `tools/importer/import-ons-engagement.js` (target path set via
  `MSM_TARGET`: `language-masters/nl` or `be/nl`)

Run: bundle the import script, then run the bulk import against the source URL. The
importer writes `content/**/*.plain.html`. See `migration-work/migration-plan.md`.

> **Source-site note:** `www.bnpparibasfortis.be` was under HTTP 503 maintenance and
> its image CDN 403-blocks scrapers. Content was recovered from a Wayback snapshot +
> a saved bd-snapshot; images/logo were fetched via the stealth
> `download-images.js` helper. If re-importing, expect the live source may be
> unreachable — use the snapshots under `tools/importer/bd-snapshots/`.

---

## 7. Design tokens & section backgrounds

- `styles/brand.css`: `--background-color` (page grey `#f1f2f6`),
  `--surface-color` (white `#fff`), `--link-color` (BNP green `#00965e`),
  fonts (`bnppsans`, `bnppsans-light`).
- `main > .section` uses the white surface color → content sits on white over the
  grey page background (matches source).
- Footer background is **transparent** (grey page shows through); footer links are
  green at rest; the Card Stop phone number is BNP red (`#e2001a`).
- Brand fonts (BNPPSans Regular + Light) are real `.woff` files in `fonts/`, wired
  in `styles/fonts.css` + `styles/brand.css`.

---

## 8. Deploy workflow

1. Branch from `main`, make changes, `npm run lint`.
2. Push branch → AEM Code Sync builds a feature preview.
3. Open a PR to `main` with a test URL on the feature preview.
4. Merge → Code Sync deploys code to `main` preview/live (JS/CSS propagate a few
   minutes after merge).
5. **Content** (pages, fragments) is separate from code — it lives in the content
   store and is published via `admin.hlx.page` preview/live (§5.1). After changing
   fragment content or images, re-preview + re-publish so the live site updates.

---

## 9. Reference files

| File | What it is |
|------|-----------|
| `migration-work/migration-plan.md` | Overall migration plan & status |
| `migration-work/msm-setup-runbook.md` | Step-by-step AEM author MSM setup |
| `migration-work/footer-import-block-table.md` | Footer UE block table + field mapping |
| `tools/importer/footer-block-source.html` | Ready-to-ingest footer block markup |
| `tools/preview/fragments.html` | Standalone header/footer preview tool |
| `AGENTS.md` | Project coding standards & EDS conventions |
