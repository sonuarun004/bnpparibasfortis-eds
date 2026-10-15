// Global footer. Renders three regions: link columns, a legal/cardstop band,
// and copyright. Works two ways:
//   1. As a Universal-Editor-authored `footer` BLOCK — the block DOM delivered
//      by AEM is decorated in place (author-editable in UE).
//   2. As a content-first FRAGMENT — when no block is present, the flat
//      `footer.plain.html` fragment is fetched and decorated (legacy path).
// The emergency numbers (Card Stop, Fraud Stop, ...) use the images authored
// with them (from the DAM); the repo Card Stop icon is only a fallback.

import { fetchLocaleFragment, localizeSourceLinks } from '../../scripts/scripts.js';

const CARDSTOP_ICON = '/icons/stopcard.png';
const COPYRIGHT_LOGO = '/icons/bnppf-logo.svg';

// below this width the link columns collapse into an accordion (as on the source)
const COLUMNS_DESKTOP = window.matchMedia('(min-width: 768px)');

/**
 * Fetch the footer fragment: the page locale's own footer (e.g. /be/fr/footer),
 * falling back to the default locale's footer (/be/nl/footer).
 * @returns {Promise<Document|null>}
 */
function fetchFooterDocument() {
  return fetchLocaleFragment('footer');
}

/**
 * Read the top-level section divs from a fetched fragment.
 * @param {Document} doc
 * @returns {Element[]}
 */
function fragmentSections(doc) {
  const scoped = [...doc.querySelectorAll('main > div')];
  if (scoped.length) return scoped;
  return [...doc.body.children].filter((el) => el.tagName === 'DIV');
}

/**
 * Build an emergency item's image: the authored image, or (for the first
 * item, Card Stop) the repo icon when none was authored or it didn't load.
 * @param {Element|null} image authored <img>
 * @param {boolean} fallback use the repo Card Stop icon if there's no image
 * @returns {Element|null}
 */
function buildEmergencyIcon(image, fallback) {
  const src = image && image.getAttribute('src');
  if (!src || src.startsWith('about:')) {
    if (!fallback) return null;
    const icon = document.createElement('img');
    icon.src = CARDSTOP_ICON;
    icon.alt = 'Card Stop';
    icon.className = 'footer-cardstop-icon';
    icon.width = 66;
    icon.height = 65;
    return icon;
  }
  const icon = document.createElement('img');
  icon.src = src;
  icon.alt = image.getAttribute('alt') || '';
  icon.className = 'footer-cardstop-icon';
  icon.loading = 'lazy';
  return icon;
}

/**
 * Split the emergency area into items. An image paragraph starts a new item;
 * the text paragraphs after it (label + tel: link) belong to it. A second
 * tel: paragraph without its own image also starts a new item.
 * @param {Element[]} elements the area's paragraphs, in order
 * @returns {Array<{image: Element|null, text: Element}>}
 */
function emergencyItems(elements) {
  const items = [];
  let current = null;
  elements.forEach((el) => {
    const img = el.querySelector('img');
    const imageOnly = img && !el.textContent.trim();
    if (imageOnly) {
      current = { image: img, text: document.createElement('div') };
      items.push(current);
      return;
    }
    if (el.tagName !== 'P' || !el.textContent.trim()) return;
    const hasTel = el.querySelector('a[href^="tel:"]');
    if (!current || (hasTel && current.text.querySelector('a[href^="tel:"]'))) {
      current = { image: null, text: document.createElement('div') };
      items.push(current);
    }
    current.text.append(el.cloneNode(true));
  });
  return items.filter((item) => item.text.childElementCount);
}

/**
 * Build the mobile Card Stop call button (the source shows a full-width red
 * "call" button instead of the large text on small screens).
 * @param {Element} cardstopText wrapper holding the label paragraph + tel link
 * @returns {Element|null}
 */
function buildCardstopButton(cardstopText) {
  const tel = cardstopText.querySelector('a[href^="tel:"]');
  if (!tel) return null;
  const label = cardstopText.textContent.replace(tel.textContent, '').replace(/\s+/g, ' ').trim();
  const btn = document.createElement('a');
  btn.className = 'footer-cardstop-btn';
  btn.href = tel.getAttribute('href');
  const icon = document.createElement('span');
  icon.className = 'footer-cardstop-btn-icon';
  icon.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  text.textContent = label || tel.textContent.trim();
  btn.append(icon, text);
  return btn;
}

/**
 * Make the column headings toggles for the mobile accordion. From 768px all
 * columns are open and the toggle does nothing.
 * @param {Element} region the .footer-columns element
 */
function setupColumnAccordion(region) {
  const toggles = [...region.querySelectorAll('.footer-col-toggle')];
  const sync = () => {
    toggles.forEach((btn) => {
      const list = btn.closest('.footer-col').querySelector('.footer-col-links');
      const open = COLUMNS_DESKTOP.matches || btn.dataset.open === 'true';
      btn.setAttribute('aria-expanded', String(open));
      if (list) list.hidden = !open;
    });
  };
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (COLUMNS_DESKTOP.matches) return;
      btn.dataset.open = String(btn.dataset.open !== 'true');
      sync();
    });
  });
  COLUMNS_DESKTOP.addEventListener('change', sync);
  sync();
}

/** Hosts whose links make a list the footer's social links. */
const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'x.com', 'twitter.com', 'tiktok.com'];

/**
 * Whether every link in a list points to a social network.
 * @param {Element|null} ul
 * @returns {boolean}
 */
function isSocialList(ul) {
  const links = ul ? [...ul.querySelectorAll('a[href]')] : [];
  return links.length > 0 && links.every((a) => {
    try {
      const host = new URL(a.getAttribute('href'), window.location.href).hostname.replace(/^www\./, '');
      return SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`));
    } catch (e) {
      return false;
    }
  });
}

/**
 * Build the social links list (external, opens in a new tab).
 * @param {Element} ul source list
 * @returns {Element}
 */
function buildSocial(ul) {
  const list = ul.cloneNode(true);
  list.className = 'footer-social';
  list.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  return list;
}

/**
 * Assemble the footer inner regions from already-extracted parts.
 * @param {object} parts
 * @param {Array<{heading: string, links: Element|null}>} parts.columns
 * @param {Array<{image: Element|null, text: Element}>} parts.emergency
 *   emergency numbers (Card Stop, Fraud Stop, ...): image + label/phone
 * @param {Element|null} parts.legalLinks    <ul> of legal links
 * @param {Element|null} parts.socialLinks   <ul> of social network links
 * @param {Element|null} parts.copyright     copyright content wrapper
 * @returns {Element[]} the main footer area and the copyright band
 */
function buildFooterInner({
  columns, emergency, legalLinks, socialLinks, copyright,
}) {
  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  // Region 1: link columns
  if (columns.length) {
    const region = document.createElement('div');
    region.className = 'footer-columns';
    columns.forEach(({ heading, links }, i) => {
      const col = document.createElement('div');
      col.className = 'footer-col';
      const listId = `footer-col-links-${i + 1}`;
      if (heading) {
        const h = document.createElement('p');
        h.className = 'footer-col-heading';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'footer-col-toggle';
        toggle.textContent = heading;
        if (links) toggle.setAttribute('aria-controls', listId);
        h.append(toggle);
        col.append(h);
      }
      if (links) {
        links.classList.add('footer-col-links');
        links.id = listId;
        col.append(links);
      }
      region.append(col);
    });
    setupColumnAccordion(region);
    inner.append(region);
  }

  // Region 2: legal band (emergency numbers + legal links)
  if (emergency.length || legalLinks) {
    const region = document.createElement('div');
    region.className = 'footer-legal';

    const numbers = document.createElement('div');
    numbers.className = 'footer-emergency';
    emergency.forEach(({ image, text }, i) => {
      const item = document.createElement('div');
      item.className = 'footer-cardstop';
      const icon = buildEmergencyIcon(image, i === 0);
      if (icon) item.append(icon);
      const textWrap = document.createElement('div');
      textWrap.className = 'footer-cardstop-text';
      textWrap.append(text);
      item.append(textWrap);
      const btn = buildCardstopButton(text);
      if (btn) item.append(btn);
      numbers.append(item);
    });

    const linksWrap = document.createElement('div');
    linksWrap.className = 'footer-legal-links';
    if (legalLinks) {
      // two columns, filled top-to-bottom (rows = half the links, rounded up)
      linksWrap.style.setProperty('--legal-rows', Math.ceil(legalLinks.children.length / 2));
      linksWrap.append(legalLinks);
    }

    region.append(numbers, linksWrap);
    inner.append(region);
  }

  // Region 3: copyright bar (brand logo, social links, copyright text) —
  // a full-width white band, so it sits outside .footer-inner
  const bands = [inner];
  if (copyright || socialLinks) {
    const band = document.createElement('div');
    band.className = 'footer-copyright-band';
    const region = document.createElement('div');
    region.className = 'footer-copyright';
    band.append(region);

    const brand = document.createElement('div');
    brand.className = 'footer-copyright-brand';
    const logo = document.createElement('img');
    logo.src = COPYRIGHT_LOGO;
    logo.alt = 'BNP Paribas Fortis';
    logo.width = 164;
    logo.height = 34;
    brand.append(logo);
    region.append(brand);

    if (socialLinks) region.append(buildSocial(socialLinks));

    if (copyright) {
      const text = document.createElement('div');
      text.className = 'footer-copyright-text';
      text.append(copyright);
      region.append(text);
    }
    bands.push(band);
  }

  return bands;
}

/**
 * Extract footer parts from the FRAGMENT sections (legacy path).
 * @param {Element[]} sections
 * @returns {object}
 */
function partsFromFragment(sections) {
  const columns = [];
  const linkSection = sections[0];
  if (linkSection) {
    [...linkSection.children].forEach((el) => {
      if (el.tagName === 'H2') {
        const list = el.nextElementSibling;
        columns.push({
          heading: el.textContent.trim(),
          links: list && list.tagName === 'UL' ? list.cloneNode(true) : null,
        });
      }
    });
  }

  // A list of social network links may sit in the legal or copyright section.
  const socialLinks = sections.slice(1)
    .flatMap((s) => [...s.querySelectorAll(':scope > ul')])
    .find(isSocialList) || null;

  const legalSection = sections[1];
  let emergency = [];
  let legalLinks = null;
  if (legalSection) {
    emergency = emergencyItems([...legalSection.children].filter((el) => el.tagName === 'P'));
    const ul = [...legalSection.querySelectorAll(':scope > ul')].find((u) => u !== socialLinks);
    if (ul) legalLinks = ul.cloneNode(true);
  }

  const copyrightSection = sections[2];
  let copyright = null;
  if (copyrightSection) {
    const wrap = document.createElement('div');
    [...copyrightSection.children].forEach((el) => {
      if (el === socialLinks) return;
      if (!(el.tagName === 'P' && el.querySelector('img') && !el.textContent.trim())) {
        wrap.append(el.cloneNode(true));
      }
    });
    if (wrap.childElementCount) copyright = wrap;
  }

  return {
    columns, emergency, legalLinks, socialLinks, copyright,
  };
}

/**
 * Extract footer parts from the delivered BLOCK DOM (Universal Editor path).
 * Block rows: each footer-column item is a row with 2 cells (heading, links);
 * the container fields (cardstop, legal, copyright) are single-cell rows.
 * We classify each row by its content signature so ordering is not assumed.
 * @param {Element} block
 * @returns {object}
 */
function partsFromBlock(block) {
  const columns = [];
  let emergency = [];
  let legalLinks = null;
  let socialLinks = null;
  let copyright = null;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length >= 2) {
      // Two-cell row → a link column (heading + links).
      const heading = cells[0].textContent.trim();
      const links = cells[1].querySelector('ul');
      columns.push({ heading, links: links ? links.cloneNode(true) : null });
      return;
    }
    const cell = cells[0];
    if (!cell) return;
    const ul = cell.querySelector('ul');
    const hasTel = cell.querySelector('a[href^="tel:"]');
    const text = cell.textContent.trim();

    if (hasTel) {
      // Emergency numbers: image(s) + label + phone.
      emergency = emergencyItems([...cell.children]);
    } else if (ul && isSocialList(ul)) {
      // Social network links.
      socialLinks = ul;
    } else if (ul) {
      // Legal links list.
      legalLinks = ul.cloneNode(true);
    } else if (text) {
      // Copyright.
      const wrap = document.createElement('div');
      [...cell.children].forEach((el) => wrap.append(el.cloneNode(true)));
      copyright = wrap;
    }
  });

  return {
    columns, emergency, legalLinks, socialLinks, copyright,
  };
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // Path 1: a Universal-Editor-authored footer block was delivered into the DOM.
  // `loadFooter` scaffolds an empty block (one blank row), so only take this
  // path when the block actually carries authored content (text or links).
  const hasAuthoredContent = block.textContent.trim() !== ''
    || block.querySelector('a, ul, img');
  if (hasAuthoredContent) {
    const parts = partsFromBlock(block);
    block.textContent = '';
    block.append(...buildFooterInner(parts));
    localizeSourceLinks(block);
    return;
  }

  // Path 2: no authored content in this block — fetch the footer fragment.
  const doc = await fetchFooterDocument();
  block.textContent = '';
  if (!doc) return;
  // The fragment may itself contain an authored Footer BLOCK (block-form
  // content) or the legacy flat sections. Prefer the block when present.
  const embedded = doc.querySelector('.footer.block, .footer');
  const parts = embedded
    ? partsFromBlock(embedded)
    : partsFromFragment(fragmentSections(doc));
  block.append(...buildFooterInner(parts));
  localizeSourceLinks(block);
}
