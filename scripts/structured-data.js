/*
 * schema.org structured data, as on bnpparibasfortis.be, built from what is
 * authored in AEM. A property is only included when its authored value exists.
 * - The bank (BankOrCreditUnion) is global, in head.html.
 * - WebPage: from the page properties AEM delivers with every page.
 * - FAQPage: from the page's FAQ blocks (see blocks/accordion-faq).
 */

import { getMetadata } from './aem.js';

const JSON_LD_ID = 'page-structured-data';

// scripts this module and the FAQ block generate (not part of the page HTML)
const GENERATED = ['page-structured-data', 'faq-structured-data'];

/**
 * Whether the page HTML already has structured data of a schema.org type
 * (e.g. added through bulk metadata), so it isn't added twice.
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
 * WebPage properties and the authored value each one comes from.
 * @param {string} language the page's language code, e.g. 'nl'
 * @returns {Object<string, string>}
 */
function webPageProperties(language) {
  return {
    name: getMetadata('og:title') || document.title,
    description: getMetadata('description'),
    url: document.querySelector('link[rel="canonical"]')?.href,
    datePublished: getMetadata('published-time'),
    dateModified: getMetadata('modified-time'),
    inLanguage: language && `${language}-BE`,
  };
}

/**
 * Add the page's WebPage structured data, with only the properties whose
 * authored value exists.
 * @param {string} language the page's language code, e.g. 'nl'
 */
export default function addStructuredData(language) {
  if (hasStructuredData('WebPage')) return;
  const page = { '@context': 'https://schema.org', '@type': 'WebPage' };
  Object.entries(webPageProperties(language)).forEach(([property, value]) => {
    if (value) page[property] = value;
  });
  if (!page.name) return;

  document.getElementById(JSON_LD_ID)?.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = JSON_LD_ID;
  script.textContent = JSON.stringify(page);
  document.head.append(script);
}
