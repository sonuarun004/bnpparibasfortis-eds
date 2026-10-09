/*
 * schema.org structured data for every page, as on bnpparibasfortis.be:
 * the bank (organization) and the page itself (WebPage). FAQ blocks add
 * their own FAQPage data (see blocks/accordion-faq).
 */

import { getMetadata } from './aem.js';

const JSON_LD_ID = 'page-structured-data';

/**
 * The bank, as described on the source site.
 * @param {string} origin
 * @returns {object}
 */
function organization(origin) {
  return {
    '@type': 'BankOrCreditUnion',
    '@id': `${origin}/#organization`,
    name: 'BNP Paribas Fortis',
    alternateName: ['BNPPF', 'Fortis'],
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/icons/bnppf-logo-mark.svg`,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Montagne du Parc 3',
      addressLocality: 'Bruxelles',
      postalCode: '1000',
      addressCountry: 'BE',
    },
    sameAs: [
      'https://www.linkedin.com/company/bnpparibasfortis',
      'https://www.youtube.com/user/bnppfbelgique',
    ],
  };
}

/**
 * Add the organization and WebPage structured data to the document head.
 * @param {string} language the page's language code, e.g. 'nl'
 */
export default function addStructuredData(language) {
  const { origin } = window.location;
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const page = {
    '@type': 'WebPage',
    '@id': `${canonical || window.location.href.split('#')[0]}#webpage`,
    name: getMetadata('og:title') || document.title,
    url: canonical || window.location.href.split('#')[0],
    inLanguage: `${language}-BE`,
    publisher: { '@id': `${origin}/#organization` },
  };
  const description = getMetadata('description');
  if (description) page.description = description;

  document.getElementById(JSON_LD_ID)?.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = JSON_LD_ID;
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [organization(origin), page],
  });
  document.head.append(script);
}
