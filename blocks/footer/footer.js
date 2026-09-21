// Content-first footer. Reads a flat footer fragment (content/footer.plain.html)
// and renders three regions: link columns, a legal/cardstop band, and copyright.

/**
 * Fetch the footer fragment (metadata-independent dual-fetch).
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
 * Read the top-level section divs from a fetched fragment. Locally (aem up)
 * the fragment keeps its <main> wrapper; when published to DA/EDS it is served
 * as bare top-level <div>s (under <body>). Support both.
 * @param {Document} doc
 * @returns {Element[]}
 */
function readSections(doc) {
  const scoped = [...doc.querySelectorAll('main > div')];
  if (scoped.length) return scoped;
  return [...doc.body.children].filter((el) => el.tagName === 'DIV');
}

/**
 * Rewrite relative image paths (images/...) to the fragment's /content location.
 * @param {Element} root
 */
function resolveImagePaths(root) {
  root.querySelectorAll('img[src]').forEach((img) => {
    const raw = img.getAttribute('src');
    if (raw && !/^(https?:)?\/\//.test(raw) && !raw.startsWith('/')) {
      img.setAttribute('src', `/content/${raw}`);
    }
  });
}

/**
 * Build the link-columns region: each <h2>+<ul> pair becomes a column.
 * @param {Element} section
 * @returns {Element}
 */
function buildLinkColumns(section) {
  const region = document.createElement('div');
  region.className = 'footer-columns';
  [...section.children].forEach((el) => {
    if (el.tagName === 'H2') {
      const col = document.createElement('div');
      col.className = 'footer-col';
      const heading = document.createElement('p');
      heading.className = 'footer-col-heading';
      heading.textContent = el.textContent.trim();
      col.append(heading);
      const list = el.nextElementSibling;
      if (list && list.tagName === 'UL') col.append(list.cloneNode(true));
      region.append(col);
    }
  });
  return region;
}

/**
 * Build the legal band: cardstop (image + text + phone) and legal link row.
 * @param {Element} section
 * @returns {Element}
 */
function buildLegalBand(section) {
  const region = document.createElement('div');
  region.className = 'footer-legal';

  const cardstop = document.createElement('div');
  cardstop.className = 'footer-cardstop';

  // Card Stop icon lives in the code repo at /icons/stopcard.png. Content-bus
  // ingestion strips <img> from the fragment on publish, so render it here from
  // the repo asset rather than relying on the fragment carrying the image.
  const icon = document.createElement('img');
  icon.src = '/icons/stopcard.png';
  icon.alt = 'Card Stop';
  icon.className = 'footer-cardstop-icon';
  icon.width = 102;
  icon.height = 102;
  cardstop.append(icon);

  // Text block: the label + phone paragraphs (skip the image-only paragraph).
  const textWrap = document.createElement('div');
  textWrap.className = 'footer-cardstop-text';
  [...section.children].forEach((el) => {
    if (el.tagName !== 'P') return;
    if (el.querySelector('img') && !el.textContent.trim()) return; // image-only <p>
    textWrap.append(el.cloneNode(true));
  });
  cardstop.append(textWrap);

  const legalLinks = section.querySelector('ul');
  const linksWrap = document.createElement('div');
  linksWrap.className = 'footer-legal-links';
  if (legalLinks) linksWrap.append(legalLinks.cloneNode(true));

  region.append(cardstop, linksWrap);
  return region;
}

/**
 * Build the copyright region.
 * @param {Element} section
 * @returns {Element}
 */
function buildCopyright(section) {
  const region = document.createElement('div');
  region.className = 'footer-copyright';

  // Brand logo on the left, from the code repo (/icons/bnppf-logo.svg) so it
  // survives content-bus publishing, mirroring the header logo.
  const brand = document.createElement('div');
  brand.className = 'footer-copyright-brand';
  const logo = document.createElement('img');
  logo.src = '/icons/bnppf-logo.svg';
  logo.alt = 'BNP Paribas Fortis';
  logo.width = 164;
  logo.height = 34;
  brand.append(logo);

  // Copyright text on the right, from the fragment.
  const text = document.createElement('div');
  text.className = 'footer-copyright-text';
  [...section.children].forEach((el) => text.append(el.cloneNode(true)));
  resolveImagePaths(text);

  region.append(brand, text);
  return region;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const doc = await fetchFooterDocument();
  block.textContent = '';
  if (!doc) return;

  const sections = readSections(doc);
  const footer = document.createElement('div');
  footer.className = 'footer-inner';

  if (sections[0]) footer.append(buildLinkColumns(sections[0]));
  if (sections[1]) footer.append(buildLegalBand(sections[1]));
  if (sections[2]) footer.append(buildCopyright(sections[2]));

  block.append(footer);
}
