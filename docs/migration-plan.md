# Migration Plan: BNP Paribas Fortis Sponsoring Page

**Mode:** Single Page
**Source:** https://www.bnpparibasfortis.be/nl/public/over-ons/wie-zijn-we/ons-engagement/sponsoring
**Target:** Replace index page + global header/footer
**Generated:** 2026-09-20

## Steps
- [x] 0. Initialize Migration Plan
- [x] 1. Project Setup (project.json exists — reused)
- [x] 2. Identify Page Templates (page-templates.json exists — reused: "ons-engagement")
- [x] 3. Page Analysis (recovered from Wayback snapshot; site was HTTP 503)
- [x] 3.5. Block Library Generation (all 3 variants reused)
- [x] 4. Block Mapping (selectors verified: 3/12/4)
- [x] 5. Import Infrastructure (3 parsers + cleanup transformer verified)
- [x] 6. Content Import → content/index.plain.html (H1 + 3 pillars + 12 cards + 4 FAQ)

## Foundation blocks (requested) — DONE
- [x] Global Header → content/nav.plain.html (logo, 3 audience tabs, search/contact, NL/FR/EN language, 4 megamenus + Private Banking + CTAs). Renders via blocks/header.
- [x] Global Footer → content/footer.plain.html (3 link columns, cardstop phone band, 6 legal links, copyright). Renders via blocks/footer.

## Notes
- Live source was HTTP 503 (maintenance) throughout; content recovered from Wayback snapshot + bd-snapshot.
- Header/footer built content-first from recovered snapshot markup (nav/footer orchestrators' live-comparison gates require a reachable source, which was unavailable).
- Logo asset CDN was 403-blocked; a clean branded placeholder SVG (content/images/bnp-logo.svg) is in place — swap for the real asset when the site is back up.
- Lint (js + css) passes.

## Blocks Requested
- Header (global nav) — exists
- Page Intro (H1 + intro)
- Rich Text + Image (three pillars) → columns-feature
- Partnership Collection (12 initiatives) → cards-partner
- FAQ (accordion + JSON-LD) → accordion-faq
- Footer (global) — exists

## Artifacts
- .migration/project.json (exists)
- tools/importer/page-templates.json (exists, ons-engagement)
- tools/importer/parsers/{accordion-faq,cards-partner,columns-feature}.js (exist)
- tools/importer/transformers/bnpparibasfortis-cleanup.js (exists)
- tools/importer/import-ons-engagement.js (exists)
