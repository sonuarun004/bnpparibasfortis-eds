/*
 * Accordion Faq Block
 * Expandable question/answer pairs.
 * https://www.hlx.live/developer/block-collection/accordion
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

const JSON_LD_ID = 'faq-structured-data';

/**
 * Add (or refresh) schema.org FAQPage structured data for every FAQ item on
 * the page, so search engines can show the questions as rich results.
 * Re-running (e.g. while editing in Universal Editor) replaces the data.
 */
function updateStructuredData() {
  const mainEntity = [...document.querySelectorAll('.accordion-faq details')].map((item) => ({
    '@type': 'Question',
    name: item.querySelector('summary').textContent.trim(),
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.querySelector('.accordion-faq-item-body').textContent.replace(/\s+/g, ' ').trim(),
    },
  })).filter((q) => q.name && q.acceptedAnswer.text);
  document.getElementById(JSON_LD_ID)?.remove();
  if (!mainEntity.length) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = JSON_LD_ID;
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity });
  document.head.append(script);
}

export default function decorate(block) {
  [...block.children].forEach((row) => {
    // decorate accordion item label
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-faq-item-label';
    summary.append(...label.childNodes);
    // decorate accordion item body
    const body = row.children[1];
    body.className = 'accordion-faq-item-body';
    // decorate accordion item
    const details = document.createElement('details');
    moveInstrumentation(row, details);
    details.className = 'accordion-faq-item';
    details.append(summary, body);
    row.replaceWith(details);
  });
  updateStructuredData();
}
