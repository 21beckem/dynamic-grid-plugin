// Small shared helpers. Nothing here touches the DOM at import time,
// so this module is safe to load from the embed, the builder, or Node tests.

/** An error whose text is meant to be shown to whoever owns the embed. */
export class UserError extends Error {
  constructor(headline, details = []) {
    super(headline);
    this.headline = headline;
    this.details = details;
  }
}

/**
 * Create an element. `text` sets textContent, `on*` keys add listeners,
 * `class` sets className. Null/false attributes and children are skipped.
 * Strings are always inserted as text, never as HTML.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child);
  }
  return node;
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns a normalized URL if `value` is safe for href/src, otherwise ''.
 * Sheet cells are untrusted, so anything that isn't an allowed protocol
 * (javascript:, data:, etc.) is dropped.
 */
export function safeUrl(value, protocols = ['http:', 'https:', 'mailto:', 'tel:']) {
  let text = String(value ?? '').trim();
  if (!text) return '';
  // "example.com/page" -> "https://example.com/page"
  if (!HAS_SCHEME.test(text) && /^[\w-]+(\.[\w-]+)+([/?#:]|$)/.test(text)) text = 'https://' + text;
  try {
    const url = new URL(text);
    return protocols.includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

/** Safe image URL; turns Google Drive share links into embeddable thumbnails. */
export function normalizeImageUrl(value) {
  const url = safeUrl(value, ['http:', 'https:']);
  if (!url) return '';
  const drive =
    url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ||
    url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
  return drive ? `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1200` : url;
}

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
