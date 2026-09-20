/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: bnpparibasfortis.be site-wide cleanup.
 *
 * Removes non-authorable site chrome so only the page-level authorable content
 * (the main content section #sectionkh3l66y3 / .iw_columns.adb_maincontent)
 * survives into the import.
 *
 * All selectors verified against migration-work/cleaned.html:
 *   - header.public-header + wrapper section #sectionkh3l66xk (line 8 / 4): global header, mega-menu nav, search
 *   - footer + wrapper section #sectionkh3l66y7 (line 979 / 975): global footer
 *   - .wcm-overlay (line 864): logout/session-timeout/help modals (inside #sectionl9xup273)
 *   - .wcm-co-browse (line 1087): screen-share widget (inside #sectionlapiaan1)
 *   - .ccb / #cookies_entry / .cookies_overlay / .cookies_overlay_shade (lines 1142, 1144, 1181, 1183): cookie banner + choice modal
 *   - #sectionm2j6nrpo (line 1075): empty placeholder component section
 */

const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Cookie banner, modals and widgets: non-authorable overlays. Removed early
    // so they never interfere with block matching.
    WebImporter.DOMUtils.remove(element, [
      '.ccb',
      '#cookies_entry',
      '.cookies_overlay',
      '.cookies_overlay_shade',
      '.wcm-overlay',
      '.wcm-co-browse',
    ]);
  }

  if (hookName === TransformHook.afterTransform) {
    // Global site chrome (header, nav, footer) and their empty wrapper sections,
    // plus the empty placeholder component section.
    WebImporter.DOMUtils.remove(element, [
      'header',
      'footer',
      '#sectionkh3l66xk',
      '#sectionkh3l66y7',
      '#sectionl9xup273',
      '#sectionlapiaan1',
      '#sectionm2j6nrpo',
    ]);
  }
}
