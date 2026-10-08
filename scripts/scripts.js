import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/** Languages the site is published in. The first one is the default. */
export const LANGUAGES = ['nl', 'fr', 'en'];

/**
 * Work out the current locale from the URL. The language is the first of the
 * leading path segments that is a supported language code, so this works in
 * every environment:
 *   /nl/over-ons/...            country site (BE root mapped to the domain)
 *   /be/nl/over-ons/...         brand-level site
 *   /content/be/nl/over-ons/... local dev server
 * @param {string} [pathname]
 * @returns {{language: string, base: string, rest: string, matched: boolean}}
 *   base: path before the language segment; rest: path after it
 */
export function getLocale(pathname = window.location.pathname) {
  const segments = pathname.split('/');
  const index = segments.findIndex((s, i) => i > 0 && i <= 3 && LANGUAGES.includes(s));
  if (index === -1) {
    return {
      language: LANGUAGES[0], base: '', rest: '/', matched: false,
    };
  }
  return {
    language: segments[index],
    base: segments.slice(0, index).join('/'),
    rest: `/${segments.slice(index + 1).join('/')}`,
    matched: true,
  };
}

/**
 * URL of the current page in another language. On a page without a locale
 * this is the language's home page.
 * @param {string} language target language code
 * @param {object} [locale] result of getLocale()
 * @returns {string}
 */
export function localeUrl(language, locale = getLocale()) {
  return `${locale.base}/${language}${locale.rest}`;
}

/**
 * Locale whose nav/footer is used for pages without a locale (e.g. the 404
 * page). The BE country root is the domain root, so the default is /nl.
 */
export const DEFAULT_LOCALE_ROOT = `/${LANGUAGES[0]}`;

/** The site being migrated; pages not migrated yet are still served there. */
export const SOURCE_ORIGIN = 'https://www.bnpparibasfortis.be';

let migratedPages;

/**
 * Paths of the pages published on this site, from the query index.
 * @returns {Promise<Set<string>>}
 */
function fetchMigratedPages() {
  if (!migratedPages) {
    migratedPages = fetch('/query-index.json')
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then(({ data = [] }) => new Set(data.map(({ path }) => path)))
      .catch(() => new Set());
  }
  return migratedPages;
}

/**
 * Point links that use the source site's paths (e.g. authored nav/footer links
 * like /nl/public/particulieren/...) at the right page: our migrated page when
 * it exists (same path without /public), otherwise the page on the source site.
 * @param {Element} container
 */
export async function resolveSourceLinks(container) {
  const pages = await fetchMigratedPages();
  container.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    let url;
    try {
      url = new URL(href, window.location.href);
    } catch (e) {
      return;
    }
    const isSource = url.origin === SOURCE_ORIGIN;
    if (!isSource && (url.origin !== window.location.origin || !href.startsWith('/'))) return;
    // a language home page we haven't migrated: the source site's home page
    const home = url.pathname.match(/^\/([a-z]{2})\/?$/);
    if (home && !isSource) {
      if (LANGUAGES.includes(home[1]) && !pages.has(`/${home[1]}/`) && !pages.has(`/${home[1]}`)) {
        a.href = `${SOURCE_ORIGIN}/`;
      }
      return;
    }
    const match = url.pathname.match(/^\/([a-z]{2})\/(public|generic)(\/.*)?$/);
    if (!match || !LANGUAGES.includes(match[1])) return;
    const [, language, area, rest = ''] = match;
    const localPath = `/${language}${rest}`.replace(/\/$/, '');
    if (area === 'public' && pages.has(localPath)) {
      a.href = `${localPath}${url.search}${url.hash}`;
    } else if (!isSource) {
      a.href = `${SOURCE_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
  });
}

/**
 * Fetch the first URL that responds OK.
 * @param {string[]} urls
 * @returns {Promise<Response|null>}
 */
async function fetchFirst(urls) {
  if (!urls.length) return null;
  const resp = await fetch(urls[0]);
  return resp.ok ? resp : fetchFirst(urls.slice(1));
}

/**
 * Fetch a global fragment (nav, footer) for the current page: the page's own
 * locale first (e.g. /fr/nav), then the default language under the same prefix
 * (/nl/nav), then DEFAULT_LOCALE_ROOT (covers pages without a locale and the
 * local dev server, where pages sit under /content/be/...).
 * @param {string} name fragment name, e.g. 'nav'
 * @returns {Promise<Document|null>}
 */
export async function fetchLocaleFragment(name) {
  const locale = getLocale();
  const urls = [`${DEFAULT_LOCALE_ROOT}/${name}.plain.html`];
  if (locale.matched) {
    urls.unshift(
      `${locale.base}/${locale.language}/${name}.plain.html`,
      `${locale.base}/${LANGUAGES[0]}/${name}.plain.html`,
    );
  }
  const resp = await fetchFirst([...new Set(urls)]);
  if (!resp) return null;
  return new DOMParser().parseFromString(await resp.text(), 'text/html');
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
export function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = getLocale().language;
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Whether the page currently being viewed is itself a global fragment
 * (the nav or footer document). Those pages carry the fragment content in
 * <main>; injecting the global header/footer chrome as well would render the
 * fragment twice when it is opened standalone. Real content pages are unaffected.
 * @returns {boolean}
 */
function isFragmentPage() {
  return /(^|\/)(nav|footer)$/.test(window.location.pathname.replace(/\.html?$/, ''));
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const fragmentPage = isFragmentPage();
  if (!fragmentPage) loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  if (!fragmentPage) loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
