/**
 * loads and decorates the columns-feature block
 * Renders feature rows as an image paired side-by-side with text.
 * Consecutive rows alternate the image between the left and right side.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  block.classList.add(`columns-feature-${rows.length}-rows`);

  rows.forEach((row, index) => {
    // flag the image column so CSS can size/order it
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          picWrapper.classList.add('columns-feature-img-col');
        }
      }
    });

    // alternate image/text side on desktop for every other row
    if (index % 2 === 1) {
      row.classList.add('columns-feature-reverse');
    }
  });
}
