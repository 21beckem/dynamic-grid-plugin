import { createCard } from '../card.js';
import { el } from '../util.js';

export default {
  name: 'grid',
  render(container, items, ctx) {
    container.replaceChildren(el('div', { class: 'grid' }, items.map((item) => createCard(item, ctx))));
  },
};
