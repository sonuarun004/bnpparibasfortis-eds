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

**Delivery mapping** (`paths.json`): the **BE country root**
`/content/bnpparibasfortis/be/` maps to `/`, so an AEM path like
`/content/bnpparibasfortis/be/nl/…/sponsoring` is delivered at `/nl/…/sponsoring`
(see §2.1). Only `be/**` plus the root `redirects`, `configuration` and `metadata`
sheets are published; `language-masters/**` is never published.

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
`docs/msm-setup-runbook.md`): create the blueprint folders, the `fr`/`en`
language copies, the rollout config, and the `be/{nl,fr,en}` Live Copies, then
publish. `helix-query.yaml` already excludes `/language-masters/**` from the public
index/sitemap so blueprint pages aren't indexed.

### 2.1 Domain mapping for the BE site

The site `bnpparibasfortis-eds` **is the BE site**: its `paths.json` maps the BE
country root to the domain root, so public URLs start with the language:

```json
"mappings": [
  "/content/bnpparibasfortis/be/:/",
  "/content/bnpparibasfortis/redirects:/redirects.json",
  "/content/bnpparibasfortis/configuration:/.helix/config.json",
  "/content/bnpparibasfortis/metadata:/metadata.json"
],
"includes": [ "/content/bnpparibasfortis/be/", "/content/bnpparibasfortis/redirects",
  "/content/bnpparibasfortis/configuration", "/content/bnpparibasfortis/metadata" ]
```

AEM reads `paths.json` from the `main` branch when it publishes, so a mapping change
only takes effect for pages **published after** it is merged; already-published URLs
stay until they are unpublished or redirected.

| AEM path | Public URL on `www.bnpparibasfortis.be` |
|----------|------------------------------------------|
| `/content/bnpparibasfortis/be/nl/over-ons/…/sponsoring` | `/nl/over-ons/…/sponsoring` |
| `/content/bnpparibasfortis/be/fr/…` | `/fr/…` |
| `/content/bnpparibasfortis/be/en/…` | `/en/…` |
| `/content/bnpparibasfortis/language-masters/**` | not published |

The domain root `/` redirects via the `redirects` sheet at
`/content/bnpparibasfortis/redirects` (Source `/` → Destination `/nl/…`). The CDN
points `www.bnpparibasfortis.be` at `main--bnpparibasfortis-eds--sonuarun004.aem.live`.

**Another country later** (e.g. `lu`) follows Adobe's MSM pattern of one aem.live
site per country site sharing this repo ("repoless"): a new site
`bnpparibasfortis-lu` mapped to `/content/bnpparibasfortis/lu/:/`, same code. Steps
(admin rights required) are in `docs/msm-setup-runbook.md` Part C.

### 2.2 Locale handling in code

`getLocale()` in `scripts/scripts.js` reads the language from the first of the
leading URL segments that is a supported language (`LANGUAGES = ['nl','fr','en']`,
first = default). It works on every URL shape: `/nl/…` (BE site), `/be/nl/…`
(brand-level site) and `/content/be/nl/…` (local dev). It drives:
- `<html lang>` (set in `loadEager`),
- the header language switcher: the toggle shows the current language, each entry
  links to the **same page** with the language segment swapped (`localeUrl()`),
  the current one is marked `aria-current`,
- the header logo link (current locale's home, `/{lang}/`),
- per-locale nav/footer: `fetchLocaleFragment()` loads the page locale's own
  `/{lang}/nav` and `/{lang}/footer` (the Live Copies under `be/{lang}`), then the
  default language under the same prefix (`/nl/nav`), then
  `DEFAULT_LOCALE_ROOT = '/nl'` (pages without a locale such as the 404 page, and
  the local dev server). The old root `/nav` and `/footer` are no longer used.

The nav fragment's language list only needs the language codes as link text
(`NL` / `FR` / `EN`); its hrefs (`/nl/`, `/fr/`, `/en/`) are fallbacks for pages
without a locale.

> **Caveat:** swapping the language segment assumes the same page name in every
> language, which MSM language copies keep by default. If French pages get
> translated URL names, the switcher would land on a 404 for those pages.

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

- **Header** — content-first **fragment**. `header.js` fetches the locale's
  `/{lang}/nav.plain.html`, falling back to the default locale's `/nl/nav.plain.html`
  (see §2.2), and builds the utility bar (logo, audience tabs, search, language
  switcher) + main nav with click megamenus.
- **Footer** — **hybrid**. `footer.js` decorates an authored **Footer block** when
  present (Universal-Editor editable), and otherwise fetches the locale's
  `/{lang}/footer` fragment, falling back to `/nl/footer`. See §4.3.

The nav and footer are pages in the MSM tree: authored in
`language-masters/{lang}/nav|footer`, rolled out to `be/{lang}/nav|footer` (Live
Copies) and published from there.

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

**Import block table** (full detail in `docs/footer-import-block-table.md`;
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
- Edit the nav/footer in the **language master**: `language-masters/{lang}/nav` and
  `language-masters/{lang}/footer` (the footer can also be authored as the Footer
  block). Keep the language-switcher entries as `NL` / `FR` / `EN`.
- **Roll out** to `be/{lang}` (Live Copy Overview → Rollout, or a Blueprint
  configuration for a Rollout button on the master pages).
- **Publish** `be/{lang}/nav` and `be/{lang}/footer` so every page in that locale picks
  them up. Do not publish the language-master pages. From the command line:
```bash
curl -X POST "https://admin.hlx.page/preview/sonuarun004/bnpparibasfortis-eds/main/nl/nav"
curl -X POST "https://admin.hlx.page/live/sonuarun004/bnpparibasfortis-eds/main/nl/nav"
# same for /{nl,fr,en}/{nav,footer}  (AEM page be/{lang}/… is delivered at /{lang}/…)
```
- `/nl/nav` and `/nl/footer` (AEM `be/nl/nav|footer`) are the fallback for every
  locale and for pages without a locale (404 page) — they must always be published.
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
importer writes `content/**/*.plain.html`. See `docs/migration-plan.md`.

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
| `docs/migration-plan.md` | Overall migration plan & status |
| `docs/msm-setup-runbook.md` | Step-by-step AEM author MSM setup |
| `docs/footer-import-block-table.md` | Footer UE block table + field mapping |
| `tools/importer/footer-block-source.html` | Ready-to-ingest footer block markup |
| `tools/preview/fragments.html` | Standalone header/footer preview tool |

> These docs also have working copies under `migration-work/` (git-ignored scratch);
> the versioned source of truth is here in `docs/`.
| `AGENTS.md` | Project coding standards & EDS conventions |
