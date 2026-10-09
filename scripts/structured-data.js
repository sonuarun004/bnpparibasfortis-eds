/*
 * schema.org structured data, as on bnpparibasfortis.be.
 * - The bank (BankOrCreditUnion) is in head.html, so it is in every page's HTML.
 * - Authors can add page data via the JSON-LD page property, which is also
 *   rendered into the HTML.
 * - Anything a page doesn't provide that way is filled in here after load:
 *   the WebPage, and FAQPage data from FAQ blocks (see blocks/accordion-faq).
 */

import { getMetadata } from './aem.js';

const JSON_LD_ID = 'page-structured-data';

// scripts this module and the FAQ block generate (not part of the page HTML)
const GENERATED = ['page-structured-data', 'faq-structured-data'];

/**
 * Whether the page HTML already has structured data of a schema.org type,
 * e.g. from the JSON-LD page property.
 * @param {string} type e.g. 'FAQPage'
 * @returns {boolean}
 */
export function hasStructuredData(type) {
  return [...document.querySelectorAll('script[type="application/ld+json"]')]
    .filter((script) => !GENERATED.includes(script.id))
    .some((script) => {
      try {
        const data = JSON.parse(script.textContent);
        const items = [data, ...(data['@graph'] || [])];
        return items.some((item) => [].concat(item['@type']).includes(type));
      } catch (e) {
        return false;
      }
    });
}

/**
 * Add WebPage structured data, unless the page HTML already has it. Uses the
 * source site's WebPage properties; its publish dates are only known to the
 * author, so they come with the JSON-LD page property.
 * @param {string} language the page's language code, e.g. 'nl'
 */
export default function addStructuredData(language) {
  if (hasStructuredData('WebPage')) return;
  const url = document.querySelector('link[rel="canonical"]')?.href
    || window.location.href.split('#')[0];
  const page = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: getMetadata('og:title') || document.title,
  };
  const description = getMetadata('description');
  if (description) page.description = description;
  page.url = url;
  page.inLanguage = `${language}-BE`;

  document.getElementById(JSON_LD_ID)?.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = JSON_LD_ID;
  script.textContent = JSON.stringify(page);
  document.head.append(script);
}
