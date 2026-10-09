# Structured data (JSON-LD) generated on AEM author

Puts the page's schema.org **WebPage** and **FAQPage** JSON-LD into the page HTML
that Edge Delivery serves (visible in *View source*), built automatically from
what authors maintain. Nobody edits JSON.

## How it works

1. Whenever a page's properties or content change on AEM author (title,
   description, an FAQ item, ...), `StructuredDataListener` rebuilds the page's
   JSON-LD with `StructuredDataBuilder`.
2. It stores the result in the page property `json-ld` (shown read-only in
   Universal Editor as *JSON-LD (generated automatically)*).
3. On preview/publish, Edge Delivery renders the `json-ld` page property as
   `<script type="application/ld+json">` in the page HTML.

The bank (`BankOrCreditUnion`) is global and lives in `head.html` of the Edge
Delivery project. In the browser, `scripts/structured-data.js` only fills in
WebPage/FAQPage data for pages that don't have it in their HTML yet (e.g. pages
not saved since this was deployed).

### Properties (only the ones bnpparibasfortis.be uses)

Each property is only written when its authored value exists.

| JSON-LD | Authored source |
|---|---|
| WebPage `name` | `jcr:title` (page title) |
| WebPage `description` | `jcr:description` |
| WebPage `url` | production URL: site origin + page path below the content root (no `/public`) |
| WebPage `datePublished` | page `jcr:created` |
| WebPage `dateModified` | `cq:lastModified` |
| WebPage `inLanguage` | `jcr:language` (e.g. `nl_BE` becomes `nl-BE`), else the language folder + `-BE` |
| FAQPage `mainEntity` | every item of the page's `accordion-faq` blocks, in page order: `summary` is the question, `text` (rich text, as plain text) the answer |

Both items share one `@graph`, because Edge Delivery allows one JSON-LD block
per page.

## Deploying (AEM as a Cloud Service project)

1. Copy `src/main/java/com/bnpparibasfortis/eds/seo/` into the **core** bundle
   of the AEM project, and `src/test/java/...` into its tests. Only AEM SDK API
   classes are used (Sling, OSGi, Jackson, Commons Text); no new dependencies.
2. Copy `src/main/config/config.author/` into
   `ui.config/src/main/content/jcr_root/apps/<project>/osgiconfig/config.author/`.
3. In
   `org.apache.sling.serviceusermapping.impl.ServiceUserMapperImpl.amended~bnppf-structured-data.cfg.json`,
   replace `REPLACE_WITH_CORE_BUNDLE_SYMBOLIC_NAME` with the core bundle's
   `Bundle-SymbolicName` (e.g. `bnpparibasfortis.core`).
4. Check `com.bnpparibasfortis.eds.seo.StructuredDataListener.cfg.json`:
   `contentRoot` (AEM path mapped to the site root, from the Edge Delivery path
   mapping `/content/bnpparibasfortis/be/:/`) and `siteOrigin` (production
   domain).
5. Deploy through the Cloud Manager pipeline.
6. Existing pages get their JSON-LD the next time they are edited. To fill all
   pages at once, touch them, e.g. re-save the page properties, or run a one-off
   Groovy or Sling script that updates `cq:lastModified`. Then preview and
   publish.

The `repoinit` config creates the service user `bnppf-structured-data` with
read/write access to `/content/bnpparibasfortis` only. Everything is author-only
(`config.author`).

## Building and testing this module on its own

Requires JDK 11+ and Maven:

```sh
mvn test
```

The tests (AEM Mocks, JUnit 5) build the sponsoring page as authored, then
check that:

- the output has exactly the source site's properties;
- properties without an authored value are left out;
- the listener stores the property and doesn't re-write it when nothing changed,
  so the change event caused by its own write ends there.
