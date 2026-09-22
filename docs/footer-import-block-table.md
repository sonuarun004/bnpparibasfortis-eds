# Footer — Universal Editor import block table

How to author/import the footer as a **UE-editable Footer block**. The block model
is `blocks/footer/_footer.json` (container **Footer** + repeatable **Footer Column**).
Brand imagery (Card Stop icon, brand logo) is rendered by `footer.js` from the code
repo `/icons/` — it is NOT authored, so there are no image fields in the table.

## Block table (as authored in a document / imported markup)

Block name: **Footer** (a table whose first cell is `Footer`).

| Row | Cell 1 | Cell 2 |
|-----|--------|--------|
| Footer Column | `Ons aanbod` | Particulieren / Professionals / Private Banking / Ondernemingen (link list) |
| Footer Column | `Help en Contact` | Fraude melden / Aangifte schadegeval / Suggestie of klacht / Contacteer ons |
| Footer Column | `Over ons` | Wie zijn we? / Jobs / Pers / Toegankelijkheid |
| (cardstop) | `Kaart verloren, gestolen of ingeslikt? 078 170 170` (the phone is a `tel:` link) | — |
| (legal) | Algemene voorwaarden / Gebruiksvoorwaarden van de website / Cookies / Privacyverklaring / Tarieven / Wettelijke informatie / Leveranciers (link list) | — |
| (copyright) | `© 2026 BNP Paribas Fortis NV` | — |

**How footer.js classifies each row (no strict ordering required):**
- A **two-cell** row → a link **column** (cell 1 = heading, cell 2 = `<ul>` of links).
- A **single-cell** row containing a `tel:` link → the **Card Stop** label + phone.
- A **single-cell** row containing a `<ul>` → the **legal links**.
- A **single-cell** row with plain text → the **copyright** line.

## Field mapping (model → cell)

**Footer Column** item model:
- `heading` (text) → cell 1
- `links` (richtext) → cell 2

**Footer** container model:
- `cardstop` (richtext) → the label + `tel:` phone
- `legal` (richtext) → the legal links list
- `copyright` (richtext) → the copyright line

## Ready-made import source

`tools/importer/footer-block-source.html` contains the exact block-form markup
(`<div class="footer"> …rows… </div>`). Ingesting that HTML at the footer path
produces a Footer block that opens and edits in Universal Editor and renders
identically to the current footer.

## Verified

`footer.js` renders this block-form source correctly (3 columns, Card Stop icon +
red phone, 7 legal links, copyright + logo) — confirmed in the local preview. The
legacy flat `footer.plain.html` fragment still renders too (fallback path), so
existing pages are unaffected until the block content is imported.
