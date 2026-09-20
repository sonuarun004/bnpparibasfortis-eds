// Content-first header. Reads a flat nav fragment (content/nav.plain.html) and
// builds a two-row header: a utility bar (logo, audience, search/contact,
// language) and a main navigation bar with click-triggered megamenu panels.

const DESKTOP = window.matchMedia('(min-width: 900px)');

/**
 * Fetch the nav fragment (metadata-independent dual-fetch).
 * @returns {Promise<Document|null>}
 */
async function fetchNavDocument() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  const html = await resp.text();
  return new DOMParser().parseFromString(html, 'text/html');
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
        const inner = document.createElement('div');
        inner.className = 'nav-panel-inner';
        columns.forEach(({ heading, list }) => {
          const col = document.createElement('div');
          col.className = 'nav-col';
          const h = document.createElement('p');
          h.className = 'nav-col-heading';
          h.textContent = heading;
          col.append(h, list.cloneNode(true));
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
          btn.className = i === links.length - 1 ? 'nav-cta nav-cta-primary' : 'nav-cta nav-cta-outline';
          li.append(btn);
          toolsList.append(li);
        });
      } else {
        links.forEach((a) => {
          const li = document.createElement('li');
          li.className = 'nav-menu-item';
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
  if (logoP) {
    const clone = logoP.cloneNode(true);
    // The fragment uses relative image paths (images/...) that resolve against
    // the fragment's /content location, not the current page URL.
    clone.querySelectorAll('img[src]').forEach((img) => {
      const raw = img.getAttribute('src');
      if (raw && !/^(https?:)?\/\//.test(raw) && !raw.startsWith('/')) {
        img.setAttribute('src', `/content/${raw}`);
      }
    });
    brand.append(clone);
  }

  const audience = document.createElement('ul');
  audience.className = 'nav-audience';
  if (lists[0]) audience.innerHTML = lists[0].innerHTML;

  // Utility tools list (e.g. Zoeken, Contacteer ons). The search entry is
  // pulled out and re-rendered as an icon button on the far right.
  const toolLinks = lists[1] ? [...lists[1].querySelectorAll('a')] : [];
  const searchLink = toolLinks.find((a) => /\/search\b/.test(a.getAttribute('href') || ''));

  const tools = document.createElement('ul');
  tools.className = 'nav-utility-tools';
  toolLinks.forEach((a) => {
    if (a === searchLink) return;
    const li = document.createElement('li');
    li.append(a.cloneNode(true));
    tools.append(li);
  });

  // Language selector: current locale (first link) shown with a chevron; the
  // remaining locales drop down on click.
  const langLinks = lists[2] ? [...lists[2].querySelectorAll('a')] : [];
  const lang = document.createElement('div');
  lang.className = 'nav-lang';
  if (langLinks.length) {
    const current = langLinks[0];
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
      li.append(a.cloneNode(true));
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
    search.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="2"/><line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  const left = document.createElement('div');
  left.className = 'nav-utility-left';
  left.append(brand, audience);

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
  hamburger.innerHTML = '<span class="nav-hamburger-icon"></span>';

  let mainNav = null;
  if (mainSection) {
    mainNav = buildMainNav(mainSection);
    hamburger.addEventListener('click', () => {
      const open = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!open));
      mainNav.classList.toggle('nav-main-open', !open);
    });
    const uRight = nav.querySelector('.nav-utility-right');
    if (uRight) uRight.append(hamburger);
    nav.append(mainNav);
  }

  block.append(nav);

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAllMenus(nav);
  });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') closeAllMenus(nav);
  });

  DESKTOP.addEventListener('change', () => {
    closeAllMenus(nav);
    hamburger.setAttribute('aria-expanded', 'false');
    if (mainNav) mainNav.classList.remove('nav-main-open');
  });
}
