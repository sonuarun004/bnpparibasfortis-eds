/*
 * schema.org structured data, as on bnpparibasfortis.be, built in the browser
 * from the page's own HTML (the metadata AEM renders from the page properties).
 * A property is only included when its value exists in the page.
 * - The bank (BankOrCreditUnion) is global, in head.html.
 * - WebPage: from the page's <meta>, <link rel="canonical"> and <html lang>.
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
 * WebPage properties and the page HTML each one is read from.
 * @returns {Object<string, string>}
 */
function webPageProperties() {
  const { lang } = document.documentElement;
  return {
    name: getMetadata('og:title') || document.title,
    description: getMetadata('description'),
    url: document.querySelector('link[rel="canonical"]')?.href,
    datePublished: getMetadata('published-time'),
    dateModified: getMetadata('modified-time'),
    inLanguage: lang && `${lang}-BE`,
  };
}

/**
 * Add the page's WebPage structured data, with only the properties whose
 * value exists in the page.
 */
export default function addStructuredData() {
  if (hasStructuredData('WebPage')) return;
  const page = { '@context': 'https://schema.org', '@type': 'WebPage' };
  Object.entries(webPageProperties()).forEach(([property, value]) => {
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
