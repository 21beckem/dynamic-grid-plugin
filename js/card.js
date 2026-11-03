// One card, shared by every view so they all look and behave the same.

import { el, safeUrl, normalizeImageUrl } from './util.js';
import { applyStyles } from './styles.js';

function createMedia(item, styles) {
  const box = el('div', { class: 'card-media' });
  applyStyles(box, 'image', styles);
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
  applyStyles(img, 'imageContent', styles, 'image');
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
  const media = item.enableImage && ctx.hasImage ? createMedia(item, ctx.styles) : null;
  const title = item.title && el('h3', { class: 'card-title', text: item.title });
  const description = item.description && el('p', { class: 'card-desc', text: item.description });
  const body = item.title || item.description ? el('div', { class: 'card-body' }, title, description) : null;
  applyStyles(body, 'body', ctx.styles);
  applyStyles(title, 'title', ctx.styles);
  applyStyles(description, 'description', ctx.styles);

  const href = safeUrl(item.link);
  const card = !href
    ? el('article', { class: 'card' }, media, body)
    : el(
    'a',
    { class: 'card', href, target: item.linkTarget, rel: 'noopener noreferrer' },
    media,
    body,
    el('span', { class: 'sr-only', text: 'Opens in a new tab' })
  );
  applyStyles(card, 'card', ctx.styles);
  return card;
}
