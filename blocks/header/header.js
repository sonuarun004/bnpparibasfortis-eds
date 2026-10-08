// Content-first header. Reads a flat nav fragment (content/nav.plain.html) and
// builds a two-row header: a utility bar (logo, audience, search/contact,
// language) and a main navigation bar with click-triggered megamenu panels.

import {
  LANGUAGES, getLocale, localeUrl, fetchLocaleFragment, resolveSourceLinks,
} from '../../scripts/scripts.js';

// matches the source site, which switches to its compact mobile header below 1024px
const DESKTOP = window.matchMedia('(min-width: 1024px)');

// a menu column's "see all" link (the source's "viewMore" links), in NL/FR/EN
const SEE_ALL = /^(al onze|alle|toutes nos|tous nos|tout notre|all our|all)\s/i;

/**
 * Create a decorative icon (an SVG from /icons, painted with currentColor
 * through a CSS mask so it follows the text colour).
 * @param {string} name Icon name, e.g. 'lock'
 * @returns {Element}
 */
function buildIcon(name) {
  const icon = document.createElement('span');
  icon.className = `nav-icon nav-icon-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

/**
 * Mark the audience link for the current section as active. Pages outside
 * every audience (e.g. "over ons" content) fall back to the first audience,
 * as on the source site.
 * @param {Element} list The audience <ul>
 */
function markActiveAudience(list) {
  const links = [...list.querySelectorAll('a')];
  if (!links.length) return;
  const path = window.location.pathname;
  const active = links.find((a) => {
    const href = new URL(a.href, window.location.href).pathname.replace(/\/$/, '');
    return href && path.startsWith(href);
  }) || links[0];
  active.classList.add('active');
  active.setAttribute('aria-current', 'page');
}

const SKIP_LINK_LABELS = {
  nl: 'Ga direct naar hoofdinhoud',
  fr: 'Aller directement au contenu principal',
  en: 'Skip to main content',
};

// label of the mobile sub-menu's back button (the source uses "Retour" in NL)
const BACK_LABELS = {
  nl: 'Retour',
  fr: 'Retour',
  en: 'Back',
};

/**
 * Build the "skip to main content" link (first focusable element on the page).
 * Gives <main> an id and makes it focusable so the link moves focus there.
 * @returns {Element|null}
 */
function buildSkipLink() {
  const main = document.querySelector('main');
  if (!main) return null;
  if (!main.id) main.id = 'main';
  main.setAttribute('tabindex', '-1');
  const link = document.createElement('a');
  link.className = 'skip-link';
  link.href = `#${main.id}`;
  link.textContent = SKIP_LINK_LABELS[getLocale().language] || SKIP_LINK_LABELS.en;
  return link;
}

/**
 * Fetch the nav fragment: the page locale's own nav (e.g. /be/fr/nav), falling
 * back to the default locale's nav (/be/nl/nav).
 * @returns {Promise<Document|null>}
 */
function fetchNavDocument() {
  return fetchLocaleFragment('nav');
}

/**
 * Read the top-level section divs from a fetched fragment. Locally (aem up)
 * the fragment keeps its <main> wrapper; when published to DA/EDS it is served
 * as bare top-level <div>s (DOMParser puts them under <body>). Support both.
 * @param {Document} doc
 * @returns {Element[]}
 */
function readSections(doc) {
  const scoped = [...doc.querySelectorAll('main > div')];
  if (scoped.length) return scoped;
  return [...doc.body.children].filter((el) => el.tagName === 'DIV');
}

/**
 * Collect the heading/list groups that make up one megamenu panel.
 * Starting after an <h2> menu label, gather each <h3>+<ul> pair until the
 * next <h2>.
 * @param {Element} h2 The menu label heading
 * @returns {Array<{heading: string, list: Element}>}
 */
function collectPanelColumns(h2) {
  const columns = [];
  let node = h2.nextElementSibling;
  while (node && node.tagName !== 'H2') {
    if (node.tagName === 'H3') {
      const heading = node.textContent.trim();
      const list = node.nextElementSibling;
      if (list && list.tagName === 'UL') {
        columns.push({ heading, list });
      }
    }
    node = node.nextElementSibling;
  }
  return columns;
}

/**
 * Close every open megamenu.
 * @param {Element} navBar
 */
function closeAllMenus(navBar) {
  navBar.querySelectorAll('.nav-menu[aria-expanded="true"]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
    const panel = btn.nextElementSibling;
    if (panel && panel.classList.contains('nav-panel')) panel.hidden = true;
  });
  navBar.querySelectorAll('.nav-lang-toggle[aria-expanded="true"]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
    const menu = btn.nextElementSibling;
    if (menu && menu.classList.contains('nav-lang-menu')) menu.hidden = true;
  });
  navBar.querySelectorAll('.nav-audience-toggle[aria-expanded="true"]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Build the main navigation bar from the second section of the fragment.
 * @param {Element} section The main-nav source section
 * @returns {Element}
 */
function buildMainNav(section) {
  const navBar = document.createElement('nav');
  navBar.className = 'nav-main';
  navBar.setAttribute('aria-label', 'Hoofdnavigatie');

  const menuList = document.createElement('ul');
  menuList.className = 'nav-menu-list';

  const toolsList = document.createElement('ul');
  toolsList.className = 'nav-cta-list';

  // Mark the H3/UL elements that belong to a menu panel so the main loop does
  // not also render them as top-level items.
  const consumed = new Set();
  [...section.children].forEach((el) => {
    if (el.tagName === 'H2') {
      collectPanelColumns(el).forEach(({ list }) => {
        consumed.add(list);
        const heading = list.previousElementSibling;
        if (heading && heading.tagName === 'H3') consumed.add(heading);
      });
    }
  });

  [...section.children].forEach((el) => {
    if (consumed.has(el)) return;
    if (el.tagName === 'H3') return;
    if (el.tagName === 'H2') {
      const link = el.querySelector('a');
      // Some authoring pipelines emit the label as escaped anchor text, e.g.
      // `<a href="/nl/public/private-banking">Private Banking</a>`. Recover both
      // the clean label and its href from that text when there is no real <a>.
      const rawText = el.textContent.trim();
      const escapedAnchor = link ? null : rawText.match(/<a\b[^>]*\bhref="([^"]*)"[^>]*>(.*?)<\/a>/i);
      let linkHref = null;
      let rawLabel = rawText;
      if (link) {
        linkHref = link.getAttribute('href');
        rawLabel = link.textContent.trim();
      } else if (escapedAnchor) {
        [, linkHref, rawLabel] = escapedAnchor;
      }
      const label = rawLabel.replace(/<\/?a\b[^>]*>/gi, '').trim();
      // Treat href="#" (or empty) as a non-navigating megamenu trigger.
      const href = linkHref && linkHref !== '#' ? linkHref : '#';
      const columns = collectPanelColumns(el);
      const li = document.createElement('li');
      li.className = 'nav-menu-item';

      if (columns.length === 0) {
        // plain link (e.g. Private Banking)
        const a = document.createElement('a');
        a.href = href;
        a.textContent = label;
        a.className = 'nav-link';
        li.classList.add('nav-menu-item-featured');
        li.append(a);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nav-menu';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-haspopup', 'true');
        btn.textContent = label;

        const panel = document.createElement('div');
        panel.className = 'nav-panel';
        panel.hidden = true;

        // mobile only: the sub-menu covers the menu, with a back button and title
        const head = document.createElement('div');
        head.className = 'nav-panel-head';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'nav-panel-back';
        back.textContent = BACK_LABELS[getLocale().language] || BACK_LABELS.en;
        back.addEventListener('click', (e) => {
          e.stopPropagation();
          btn.setAttribute('aria-expanded', 'false');
          panel.hidden = true;
          btn.focus();
        });
        const title = document.createElement('p');
        title.className = 'nav-panel-title';
        title.textContent = label;
        head.append(back, title);
        panel.append(head);

        const inner = document.createElement('div');
        inner.className = 'nav-panel-inner';
        columns.forEach(({ heading, list }) => {
          const col = document.createElement('div');
          col.className = 'nav-col';
          const h = document.createElement('p');
          h.className = 'nav-col-heading';
          h.textContent = heading;
          const links = list.cloneNode(true);
          // The column's "see all" link (green, with a chevron): a bold link,
          // or one worded like "Al onze oplossingen" / "Alle sectoren"
          links.querySelectorAll('li').forEach((item) => {
            const strong = item.querySelector('strong');
            const a = item.querySelector('a');
            if (!a) return;
            if (strong) strong.replaceWith(...strong.childNodes);
            if (strong || SEE_ALL.test(a.textContent.trim())) a.classList.add('nav-col-more');
          });
          col.append(h, links);
          inner.append(col);
        });
        panel.append(inner);

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = btn.getAttribute('aria-expanded') === 'true';
          closeAllMenus(navBar);
          if (!open) {
            btn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
          }
        });
        li.append(btn, panel);
      }
      menuList.append(li);
    } else if (el.tagName === 'UL') {
      // The UL groups after the menus: the Private Banking link and the CTA
      // group (Open een rekening, Aanmelden).
      const links = [...el.querySelectorAll('a')];
      const isCta = links.some((a) => /logon|zichtrekening-vergelijken/.test(a.getAttribute('href') || ''));
      if (isCta) {
        links.forEach((a, i) => {
          const li = document.createElement('li');
          const btn = document.createElement('a');
          btn.href = a.getAttribute('href');
          btn.textContent = a.textContent.trim();
          const primary = i === links.length - 1;
          btn.className = primary ? 'nav-cta nav-cta-primary' : 'nav-cta nav-cta-outline';
          if (primary) btn.prepend(buildIcon('lock'));
          li.append(btn);
          toolsList.append(li);
        });
      } else {
        links.forEach((a) => {
          const li = document.createElement('li');
          li.className = 'nav-menu-item nav-menu-item-featured';
          const link = document.createElement('a');
          link.href = a.getAttribute('href');
          link.textContent = a.textContent.trim();
          link.className = 'nav-link';
          li.append(link);
          menuList.append(li);
        });
      }
    }
  });

  navBar.append(menuList, toolsList);
  return navBar;
}

/**
 * Build the utility (top) bar from the first section of the fragment.
 * @param {Element} section
 * @returns {Element}
 */
function buildUtilityBar(section) {
  const bar = document.createElement('div');
  bar.className = 'nav-utility';

  const lists = [...section.querySelectorAll('ul')];
  const logoP = section.querySelector('p');

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  // Logo lives in the code repo at /icons/bnppf-logo.svg. Content-bus ingestion
  // strips <img> from the nav fragment on publish, so the fragment can't be
  // relied on to carry the logo image. Instead we always render the logo here
  // from the repo asset. The logo links to the current locale's home page;
  // outside a locale it uses the fragment's brand link.
  const locale = getLocale();
  const brandLink = logoP ? logoP.querySelector('a') : null;
  const link = document.createElement('a');
  if (locale.matched) link.href = `${locale.base}/${locale.language}/`;
  else link.href = brandLink ? brandLink.getAttribute('href') : '/';
  // the mobile header shows only the square logo mark, as on the source
  const picture = document.createElement('picture');
  const desktopLogo = document.createElement('source');
  desktopLogo.media = '(min-width: 1024px)';
  desktopLogo.srcset = '/icons/bnppf-logo.svg';
  desktopLogo.width = 155;
  desktopLogo.height = 32;
  const logo = document.createElement('img');
  logo.src = '/icons/bnppf-logo-mark.svg';
  logo.alt = 'BNP Paribas Fortis';
  logo.className = 'nav-logo';
  logo.width = 24;
  logo.height = 24;
  picture.append(desktopLogo, logo);
  link.append(picture);
  brand.append(link);

  const audience = document.createElement('ul');
  audience.className = 'nav-audience';
  audience.id = 'nav-audience';
  if (lists[0]) audience.innerHTML = lists[0].innerHTML;
  markActiveAudience(audience);

  // mobile only: the audiences collapse into a dropdown named after the active one
  const audienceWrap = document.createElement('div');
  audienceWrap.className = 'nav-audience-wrap';
  const activeAudience = audience.querySelector('a.active');
  if (activeAudience) {
    const audienceToggle = document.createElement('button');
    audienceToggle.type = 'button';
    audienceToggle.className = 'nav-audience-toggle';
    audienceToggle.setAttribute('aria-expanded', 'false');
    audienceToggle.setAttribute('aria-controls', audience.id);
    audienceToggle.textContent = activeAudience.textContent.trim();
    audienceToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = audienceToggle.getAttribute('aria-expanded') === 'true';
      audienceToggle.setAttribute('aria-expanded', String(!open));
    });
    audienceWrap.append(audienceToggle);
  }
  audienceWrap.append(audience);

  // Utility tools list (e.g. Zoeken, Contacteer ons). The search entry is
  // pulled out and re-rendered as an icon button on the far right.
  const toolLinks = lists[1] ? [...lists[1].querySelectorAll('a')] : [];
  const searchLink = toolLinks.find((a) => /\/search\b/.test(a.getAttribute('href') || ''));

  const tools = document.createElement('ul');
  tools.className = 'nav-utility-tools';
  toolLinks.forEach((a) => {
    if (a === searchLink) return;
    const li = document.createElement('li');
    const item = a.cloneNode(true);
    if (/contact/.test(item.getAttribute('href') || '')) item.prepend(buildIcon('ask-outline'));
    li.append(item);
    tools.append(li);
  });

  // Language selector. The fragment lists the languages (link text = language
  // code, e.g. NL / FR / EN). Each entry links to the current page in that
  // language (same path, language segment swapped); the toggle shows the
  // language of the page being viewed.
  const langLinks = lists[2] ? [...lists[2].querySelectorAll('a')] : [];
  const lang = document.createElement('div');
  lang.className = 'nav-lang';
  if (langLinks.length) {
    const codeOf = (a) => a.textContent.trim().toLowerCase();
    const current = langLinks.find((a) => codeOf(a) === locale.language) || langLinks[0];
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-lang-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-haspopup', 'true');
    toggle.textContent = current.textContent.trim();

    const menu = document.createElement('ul');
    menu.className = 'nav-lang-menu';
    menu.hidden = true;
    langLinks.forEach((a) => {
      const li = document.createElement('li');
      const item = a.cloneNode(true);
      const code = codeOf(a);
      if (LANGUAGES.includes(code)) {
        item.href = localeUrl(code, locale);
        item.hreflang = code;
        item.lang = code;
      }
      if (a === current) item.setAttribute('aria-current', 'true');
      li.append(item);
      menu.append(li);
    });

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.hidden = open;
    });
    lang.append(toggle, menu);
  }

  // Search icon button linking to the search page.
  let search = null;
  if (searchLink) {
    search = document.createElement('a');
    search.className = 'nav-search';
    search.href = searchLink.getAttribute('href');
    search.setAttribute('aria-label', searchLink.textContent.trim() || 'Zoeken');
    search.append(buildIcon('search'));
  }

  const left = document.createElement('div');
  left.className = 'nav-utility-left';
  left.append(brand, audienceWrap);

  const right = document.createElement('div');
  right.className = 'nav-utility-right';
  right.append(tools, lang);
  if (search) right.append(search);

  bar.append(left, right);
  return bar;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const doc = await fetchNavDocument();
  block.textContent = '';
  if (!doc) return;

  const sections = readSections(doc);
  const utilitySection = sections[0];
  const mainSection = sections[1];

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.className = 'nav';

  if (utilitySection) nav.append(buildUtilityBar(utilitySection));

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.append(buildIcon('menu'), buildIcon('close'));

  let mainNav = null;
  const setDrawer = (open) => {
    hamburger.setAttribute('aria-expanded', String(open));
    if (!mainNav) return;
    mainNav.classList.toggle('nav-main-open', open);
    // the page behind the full-screen menu doesn't scroll
    document.body.style.overflowY = open && !DESKTOP.matches ? 'hidden' : '';
  };
  if (mainSection) {
    mainNav = buildMainNav(mainSection);
    mainNav.id = 'nav-main';
    hamburger.setAttribute('aria-controls', mainNav.id);
    hamburger.addEventListener('click', () => {
      closeAllMenus(nav);
      setDrawer(hamburger.getAttribute('aria-expanded') !== 'true');
    });
    const uRight = nav.querySelector('.nav-utility-right');
    if (uRight) uRight.append(hamburger);

    // mobile only: the menu repeats the contact link and the language links
    const contact = nav.querySelector('.nav-utility-tools a');
    if (contact) {
      const li = document.createElement('li');
      li.className = 'nav-menu-item nav-menu-item-contact';
      li.append(contact.cloneNode(true));
      mainNav.querySelector('.nav-menu-list').append(li);
    }
    const langLinks = [...nav.querySelectorAll('.nav-lang-menu a')];
    if (langLinks.length) {
      const langs = document.createElement('ul');
      langs.className = 'nav-drawer-lang';
      langLinks.forEach((a) => {
        const li = document.createElement('li');
        li.append(a.cloneNode(true));
        langs.append(li);
      });
      mainNav.append(langs);
    }
    nav.append(mainNav);
  }

  const skipLink = buildSkipLink();
  if (skipLink) block.append(skipLink);
  block.append(nav);
  resolveSourceLinks(nav);

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAllMenus(nav);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    // Escape closes an open sub-menu first, then the mobile menu itself
    const subMenuOpen = nav.querySelector('[aria-expanded="true"]:not(.nav-hamburger)');
    closeAllMenus(nav);
    if (!subMenuOpen && hamburger.getAttribute('aria-expanded') === 'true') {
      setDrawer(false);
      hamburger.focus();
    }
  });

  // desktop: past 60px of scrolling only the main menu row stays pinned
  const headerEl = block.closest('header');
  if (headerEl) {
    const onScroll = () => headerEl.classList.toggle('header-scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  DESKTOP.addEventListener('change', () => {
    closeAllMenus(nav);
    setDrawer(false);
  });
}
