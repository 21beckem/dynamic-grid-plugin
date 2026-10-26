// One card, shared by every view so they all look and behave the same.

import { el, safeUrl, normalizeImageUrl } from './util.js';

function createMedia(item) {
  const box = el('div', { class: 'card-media' });
  const src = normalizeImageUrl(item.image);
  if (!src) {
    box.classList.add('is-empty');
    return box;
  }
  const img = el('img', {
    src,
    alt: item.title || '',
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  });
  img.addEventListener('error', () => {
    img.remove();
    box.classList.add('is-empty');
  });
  box.append(img);
  return box;
}

/**
 * @param {{title:string, description:string, image:string, link:string}} item
 * @param {{hasImage:boolean}} ctx
 */
export function createCard(item, ctx) {
  const media = ctx.hasImage ? createMedia(item) : null;
  const body =
    item.title || item.description
      ? el(
          'div',
          { class: 'card-body' },
          item.title && el('h3', { class: 'card-title', text: item.title }),
          item.description && el('p', { class: 'card-desc', text: item.description })
        )
      : null;

  const href = safeUrl(item.link);
  if (!href) return el('article', { class: 'card' }, media, body);
  return el(
    'a',
    { class: 'card', href, target: '_blank', rel: 'noopener noreferrer' },
    media,
    body,
    el('span', { class: 'sr-only', text: 'Opens in a new tab' })
  );
}
