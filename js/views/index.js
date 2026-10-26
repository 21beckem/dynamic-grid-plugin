// View registry. To add a view:
//   1. create js/views/<name>.js exporting { name, render(container, items, ctx) }
//   2. import it here and add it to `views`
// The builder's "View" dropdown and the URL validation pick it up automatically.

import grid from './grid.js';
import carousel from './carousel.js';

export const views = { grid, carousel };
export const viewNames = Object.keys(views);
