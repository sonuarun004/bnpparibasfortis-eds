// Global footer. Renders three regions: link columns, a legal/cardstop band,
// and copyright. Works two ways:
//   1. As a Universal-Editor-authored `footer` BLOCK — the block DOM delivered
//      by AEM is decorated in place (author-editable in UE).
//   2. As a content-first FRAGMENT — when no block is present, the flat
//      `footer.plain.html` fragment is fetched and decorated (legacy path).
// Brand imagery (Card Stop icon, logo) is served from the code repo /icons/
// so it survives publishing and needs no authoring.

const CARDSTOP_ICON = '/icons/stopcard.png';
const COPYRIGHT_LOGO = '/icons/bnppf-logo.svg';

/**
 * Fetch the footer fragment (metadata-independent dual-fetch). Legacy path.
 * @returns {Promise<Document|null>}
 */
async function fetchFooterDocument() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  const html = await resp.text();
  return new DOMParser().parseFromString(html, 'text/html');
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
 * Build the Card Stop icon element (from the repo asset).
 * @returns {Element}
 */
function buildCardstopIcon() {
  const icon = document.createElement('img');
  icon.src = CARDSTOP_ICON;
  icon.alt = 'Card Stop';
  icon.className = 'footer-cardstop-icon';
  icon.width = 102;
  icon.height = 102;
  return icon;
}

/**
 * Assemble the footer inner regions from already-extracted parts.
 * @param {object} parts
 * @param {Array<{heading: string, links: Element|null}>} parts.columns
 * @param {Element|null} parts.cardstopText  paragraph(s) wrapper for label+phone
 * @param {Element|null} parts.legalLinks    <ul> of legal links
 * @param {Element|null} parts.copyright     copyright content wrapper
 * @returns {Element}
 */
function buildFooterInner({
  columns, cardstopText, legalLinks, copyright,
}) {
  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  // Region 1: link columns
  if (columns.length) {
    const region = document.createElement('div');
    region.className = 'footer-columns';
    columns.forEach(({ heading, links }) => {
      const col = document.createElement('div');
      col.className = 'footer-col';
      if (heading) {
        const h = document.createElement('p');
        h.className = 'footer-col-heading';
        h.textContent = heading;
        col.append(h);
      }
      if (links) col.append(links);
      region.append(col);
    });
    inner.append(region);
  }

  // Region 2: legal band (cardstop icon + text + legal links)
  if (cardstopText || legalLinks) {
    const region = document.createElement('div');
    region.className = 'footer-legal';

    const cardstop = document.createElement('div');
    cardstop.className = 'footer-cardstop';
    cardstop.append(buildCardstopIcon());
    if (cardstopText) {
      const textWrap = document.createElement('div');
      textWrap.className = 'footer-cardstop-text';
      textWrap.append(cardstopText);
      cardstop.append(textWrap);
    }

    const linksWrap = document.createElement('div');
    linksWrap.className = 'footer-legal-links';
    if (legalLinks) linksWrap.append(legalLinks);

    region.append(cardstop, linksWrap);
    inner.append(region);
  }

  // Region 3: copyright (brand logo + text)
  if (copyright) {
    const region = document.createElement('div');
    region.className = 'footer-copyright';

    const brand = document.createElement('div');
    brand.className = 'footer-copyright-brand';
    const logo = document.createElement('img');
    logo.src = COPYRIGHT_LOGO;
    logo.alt = 'BNP Paribas Fortis';
    logo.width = 164;
    logo.height = 34;
    brand.append(logo);

    const text = document.createElement('div');
    text.className = 'footer-copyright-text';
    text.append(copyright);

    region.append(brand, text);
    inner.append(region);
  }

  return inner;
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

  const legalSection = sections[1];
  let cardstopText = null;
  let legalLinks = null;
  if (legalSection) {
    const textWrap = document.createElement('div');
    [...legalSection.children].forEach((el) => {
      if (el.tagName === 'P' && !(el.querySelector('img') && !el.textContent.trim())) {
        textWrap.append(el.cloneNode(true));
      }
    });
    if (textWrap.childElementCount) cardstopText = textWrap;
    const ul = legalSection.querySelector('ul');
    if (ul) legalLinks = ul.cloneNode(true);
  }

  const copyrightSection = sections[2];
  let copyright = null;
  if (copyrightSection) {
    const wrap = document.createElement('div');
    [...copyrightSection.children].forEach((el) => {
      if (!(el.tagName === 'P' && el.querySelector('img') && !el.textContent.trim())) {
        wrap.append(el.cloneNode(true));
      }
    });
    if (wrap.childElementCount) copyright = wrap;
  }

  return {
    columns, cardstopText, legalLinks, copyright,
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
  let cardstopText = null;
  let legalLinks = null;
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
      // Card Stop label + phone.
      const wrap = document.createElement('div');
      [...cell.children].forEach((el) => wrap.append(el.cloneNode(true)));
      cardstopText = wrap;
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
    columns, cardstopText, legalLinks, copyright,
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
    block.append(buildFooterInner(parts));
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
  block.append(buildFooterInner(parts));
}
