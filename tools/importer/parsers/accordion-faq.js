/* eslint-disable */
/* global WebImporter */
/**
 * Parser for accordion-faq.
 * Base block: accordion (container block)
 * Source: https://www.bnpparibasfortis.be/nl/public/over-ons/wie-zijn-we/ons-engagement/sponsoring
 * Selector: .accordion-item (each item = one Q&A pair)
 *
 * Model (blocks/accordion-faq/_accordion-faq.json -> accordion-faq-item): summary, text.
 * Each block instance is a single accordion item = one row with 2 cells:
 *   cell 1: question summary (field:summary)
 *   cell 2: answer body      (field:text)
 * Field hints required (container block).
 */
export default function parse(element, { document }) {
  // Question / summary (validated: .accordion-title span inside the header button)
  const summaryEl = element.querySelector(
    '.accordion-title, .accordion-header button, .accordion-header',
  );
  const summaryText = summaryEl ? summaryEl.textContent.trim() : '';

  // Answer body (validated: .collapse contains the answer paragraphs)
  const body = element.querySelector('.collapse, .accordion-body');
  const bodyNodes = body
    ? Array.from(body.childNodes).filter(
        (n) => n.nodeType !== 3 || n.textContent.trim() !== '',
      )
    : [];

  // Empty-block guard
  if (!summaryText && bodyNodes.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // Summary cell with field hint
  const summaryFrag = document.createDocumentFragment();
  summaryFrag.appendChild(document.createComment(' field:summary '));
  if (summaryText) summaryFrag.appendChild(document.createTextNode(summaryText));

  // Text cell (answer body) with field hint
  const textFrag = document.createDocumentFragment();
  textFrag.appendChild(document.createComment(' field:text '));
  if (bodyNodes.length) {
    bodyNodes.forEach((n) => textFrag.appendChild(n));
  } else if (body) {
    textFrag.appendChild(body);
  }

  const cells = [[summaryFrag, textFrag]];

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-faq', cells });
  element.replaceWith(block);
}
