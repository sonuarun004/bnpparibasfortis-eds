import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Finds the first cards-partner block in a run of consecutive
 * cards-partner wrappers, so a run authored as many single-card blocks can be
 * merged into one grid.
 * @param {Element} wrapper The current block's wrapper (.cards-partner-wrapper)
 * @returns {Element} The first wrapper in the consecutive run
 */
function firstWrapperInRun(wrapper) {
  let first = wrapper;
  while (
    first.previousElementSibling
    && first.previousElementSibling.classList.contains('cards-partner-wrapper')
  ) {
    first = first.previousElementSibling;
  }
  return first;
}

/**
 * loads and decorates the cards-partner block
 * Renders a responsive grid of partnership cards (image + title + description).
 * When the content is authored as several consecutive single-card blocks, the
 * cards are consolidated into the first block's list so they share one grid.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-partner-card-image';
      else div.className = 'cards-partner-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  block.textContent = '';
  block.append(ul);

  // Consolidate consecutive single-card blocks into one shared grid. Blocks
  // load in DOM order, so the first block in the run is already decorated by
  // the time later ones run — move their cards into its list and drop the
  // now-empty wrappers, leaving a single grid container.
  const wrapper = block.parentElement;
  if (wrapper && wrapper.classList.contains('cards-partner-wrapper')) {
    const firstWrapper = firstWrapperInRun(wrapper);
    if (firstWrapper !== wrapper) {
      const targetList = firstWrapper.querySelector('.cards-partner ul');
      if (targetList) {
        while (ul.firstElementChild) targetList.append(ul.firstElementChild);
        wrapper.remove();
      }
    }
  }
}
