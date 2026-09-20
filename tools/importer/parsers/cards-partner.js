/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-partner.
 * Base block: cards (container block)
 * Source: https://www.bnpparibasfortis.be/nl/public/over-ons/wie-zijn-we/ons-engagement/sponsoring
 * Selector: .multi-pp-block (each article = one card)
 *
 * Model (blocks/cards-partner/_cards-partner.json -> card): image, text.
 * Each block instance is a single card = one row with 2 cells:
 *   cell 1: image  (field:image)
 *   cell 2: heading + description paragraphs (field:text)
 * Field hints required (container block). imageAlt collapses into <img alt> (no hint).
 */
export default function parse(element, { document }) {
  // Image (validated: direct <img> child of .multi-pp-block)
  const image = element.querySelector('img');

  // Heading (validated: h3.multi-pp-title)
  const heading = element.querySelector('.multi-pp-title, h3, h2, h4');

  // Description paragraphs (validated: <p> children; filter out empties)
  const paragraphs = Array.from(element.querySelectorAll('p')).filter(
    (p) => p.textContent.trim() !== '' || p.querySelector('img, a'),
  );

  // Empty-block guard
  if (!image && !heading && paragraphs.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Image cell with field hint
  let imageCell = '';
  if (image) {
    const imgFrag = document.createDocumentFragment();
    imgFrag.appendChild(document.createComment(' field:image '));
    imgFrag.appendChild(image);
    imageCell = imgFrag;
  }

  // Text cell (heading + description) with field hint
  const textFrag = document.createDocumentFragment();
  textFrag.appendChild(document.createComment(' field:text '));
  if (heading) textFrag.appendChild(heading);
  paragraphs.forEach((p) => textFrag.appendChild(p));

  const cells = [[imageCell, textFrag]];

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-partner', cells });
  element.replaceWith(block);
}
