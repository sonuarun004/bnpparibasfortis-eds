# BNP Paribas Fortis — MSM (Multi Site Manager) Setup Runbook

**Goal:** Author a single Dutch (`nl`) **language master**, translate it into `fr` and `en`,
then use MSM **Live Copies** to spin up country sites — starting with **Belgium (`be`)** in
NL / FR / EN.

**Decisions (locked):**
- **Master / source of truth:** Dutch (`nl`)
- **Tree layout:** `language-masters/{en,nl,fr}` + `be/{nl,fr,en}`
- **Project type:** xwalk (EDS-delivered AEM Cloud Service site)
- **AEM author:** `author-p9652-e115365.adobeaemcloud.com`
- **Site root:** `/content/bnpparibasfortis`  •  **DAM:** `/content/dam/bnpparibasfortis`

---

## Target content tree

```
/content/bnpparibasfortis
├── language-masters/                 ← BLUEPRINTS (authored + translated)
│   ├── nl   ← MASTER (source of truth — authored here first)
│   ├── fr   ← language copy of nl, then translated
│   └── en   ← language copy of nl, then translated
└── be/                               ← BELGIUM country site (LIVE COPIES)
    ├── nl   ← Live Copy of language-masters/nl
    ├── fr   ← Live Copy of language-masters/fr
    └── en   ← Live Copy of language-masters/en
```

**Rollout direction:**
`language-masters/nl` (author) → language copies `fr`, `en` (translate) → each `be/{lang}`
is a **Live Copy** of the matching master and inherits changes on rollout.

Adding a future country (e.g. Luxembourg) = create `lu/{nl,fr,en}` as Live Copies of the
same masters. No re-authoring.

---

## Part A — AEM author steps (run when author-p9652 is reachable)

> The author instance was HTTP 503 during setup. These steps are performed in the AEM
> author UI (or via `curl`/Groovy with injected credentials — no token in chat). Do them
> in order.

### A1. Create the folder skeleton
In **Sites** (`/sites.html/content/bnpparibasfortis`):
1. Create `language-masters` (type: folder or structure page per site template).
2. Under it create language roots `nl`, `fr`, `en`.
3. Create `be` and, under it, `nl`, `fr`, `en` (these will be replaced by Live Copies in A5).

### A2. Author the NL master
- Author the real pages under `language-masters/nl` (the migrated **sponsoring** page seeds
  `language-masters/nl/over-ons/wie-zijn-we/ons-engagement/sponsoring`).
- This is the ONLY tree authored by hand; everything else derives from it.

### A3. Create language copies (nl → fr, en)
Use **References rail → Language Copies** (or **Create → Language Copy**) on
`language-masters/nl`:
- Create `fr` and `en` language copies.
- Send to translation (human or machine). Until translated, they carry NL text — that's fine
  for wiring MSM; translate before go-live.

### A4. Create the Rollout Configuration
- Tool: **Tools → Cloud Services / MSM → Rollout Configurations** (or reuse the standard
  **"Standard rollout config"**).
- Recommended trigger: **on modification** with the **"Standard rollout config"** sync
  actions (contentCopy, contentUpdate, referencesUpdate, orderChildren, etc.).
- If country sites must diverge in layout, prefer **"on rollout"** (manual) so authors control
  when master changes propagate.

### A5. Create the Belgium Live Copies
For each language, create a **Live Copy** (Tools → Sites → Create → Live Copy, or
**MSM Control Center**):

| Live Copy (target)          | Blueprint / source                  | Rollout config |
|-----------------------------|-------------------------------------|----------------|
| `/content/bnpparibasfortis/be/nl` | `/content/bnpparibasfortis/language-masters/nl` | Standard |
| `/content/bnpparibasfortis/be/fr` | `/content/bnpparibasfortis/language-masters/fr` | Standard |
| `/content/bnpparibasfortis/be/en` | `/content/bnpparibasfortis/language-masters/en` | Standard |

- Enable **"Live Copy"** with children; keep the inheritance so future master edits roll out.
- Do the first **Rollout** from each master to populate the Live Copy.

### A6. (Optional) Blueprint config
- If you want the master pages to show a **"Rollout"** button and a Blueprint status tab,
  create a **Blueprint** pointing at `language-masters` (Tools → MSM → Blueprints). Not
  required for Live Copy to function, but nicer for authors.

### A7. Publish
- Publish `be/{nl,fr,en}` trees (and the DAM assets) so EDS can deliver them.

---

## Part B — EDS-side (prepared in this repo now)

The EDS delivery must mirror the AEM tree. Changes made in the repo:

1. **`paths.json`** — the site-root mapping `"/content/bnpparibasfortis/:/"` already flattens
   the whole tree to the delivery root, so `be/nl/...` serves at `/be/nl/...` automatically.
   No per-locale mapping is strictly required; the single root mapping covers all locales.
2. **Content relocation** — the migrated NL sponsoring page moves under the MSM tree so it
   seeds the master (see `Relocate NL content` task).
3. **Locale-aware header/footer** — the language switcher points at in-site
   `/be/{nl,fr,en}/...` equivalents instead of the external bnpparibasfortis.be URLs.
4. **Locale root pages** — each `be/{lang}` needs an index; NL is real content, FR/EN are
   placeholders until translation/rollout completes.

### Delivery URL mapping

| AEM path                                             | Delivered URL (localhost + prod)          |
|------------------------------------------------------|-------------------------------------------|
| `/content/bnpparibasfortis/be/nl/index`              | `/be/nl` (and `/be/nl.html`)              |
| `/content/bnpparibasfortis/be/fr/index`              | `/be/fr`                                  |
| `/content/bnpparibasfortis/be/en/index`              | `/be/en`                                  |
| `/content/bnpparibasfortis/language-masters/nl/...`  | `/language-masters/nl/...` (master, not public) |

> Consider excluding `/language-masters/**` from the sitemap/robots so blueprint pages aren't
> indexed publicly (add an exclude to `helix-query.yaml` / `helix-sitemap.yaml`).

---

## Status / blockers
- **AEM author (author-p9652):** HTTP 503 at setup time — Part A pending reachability.
- **BNP source site:** HTTP 503 — real images for FR/EN pages pending.
- Part B (this repo) is being prepared now regardless.
