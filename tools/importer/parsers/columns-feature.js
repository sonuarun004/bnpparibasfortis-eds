/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-feature.
 * Base block: columns
 * Source: https://www.bnpparibasfortis.be/nl/public/over-ons/wie-zijn-we/ons-engagement/sponsoring
 * Selector: .rich-text-section (each section = one alternating image/text feature row)
 *
 * Columns block: NO field hints (per hinting.md — Columns blocks use default content only).
 * Each block instance is one feature row with 2 cells (image cell, text cell).
 * The .rich-text-wrapper.row.left / .row.right controls which side the image sits on:
 *   - left  -> [image, text]
 *   - right -> [text, image]
 */
export default function parse(element, { document }) {
  // Image (validated: .rich-text-img img in source)
  const image = element.querySelector('.rich-text-img img, img');

  // Text content: heading + non-empty paragraphs (validated: .rich-text-content-inner > h2.rich-text-title + p)
  const heading = element.querySelector('.rich-text-title, h2, h1, h3');
  const paragraphs = Array.from(
    element.querySelectorAll('.rich-text-content-inner > p, .rich-text-content-inner p'),
  ).filter((p) => p.textContent.trim() !== '' || p.querySelector('img, a'));

  // Empty-block guard
  if (!image && !heading && paragraphs.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const imageCell = image ? [image] : '';
  const textCell = [];
  if (heading) textCell.push(heading);
  textCell.push(...paragraphs);

  // Determine image side from the wrapper's alternating class
  const wrapper = element.querySelector('.rich-text-wrapper');
  const imageOnRight = wrapper && wrapper.classList.contains('right');

  const cells = [];
  cells.push(imageOnRight ? [textCell, imageCell] : [imageCell, textCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-feature', cells });
  element.replaceWith(block);
}
