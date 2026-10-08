export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
    // image + text rows get the source's media layout; remember which side
    // the image is on (it decides the direction of the grey offset panel)
    const imgCol = row.querySelector(':scope > .columns-img-col');
    if (imgCol && row.children.length === 2) {
      block.classList.add('columns-media');
      row.classList.add(imgCol === row.firstElementChild ? 'columns-img-left' : 'columns-img-right');
    }
  });
}
