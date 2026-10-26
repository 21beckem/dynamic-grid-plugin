// Turns a param value (column name, plain text, or a {Column} template) into a
// function that reads one row.

import { UserError } from './util.js';

// Header names tried, in order, when a param is left out.
const AUTO = {
  title: ['title', 'name', 'heading', 'label'],
  description: ['description', 'desc', 'summary', 'about', 'details', 'blurb', 'text'],
  image: ['image', 'image url', 'img', 'photo', 'picture', 'thumbnail', 'thumb'],
  link: ['link', 'url', 'href', 'website', 'site', 'page'],
};

const NONE = { kind: 'none', get: () => '' };
const TOKEN = /\{\{([^{}]+)\}\}/g;

function column(index, header) {
  return { kind: 'column', header, get: (row) => row[index] ?? '' };
}

function template(text, headers, lowered) {
  const parts = [];
  const unknown = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1].trim();
    const index = lowered.indexOf(name.toLowerCase());
    if (index < 0) unknown.push(name);
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ index });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (unknown.length) {
    throw new UserError(
      `Unknown column${unknown.length > 1 ? 's' : ''} in “${text}”: ${unknown.join(', ')}.`,
      [`Columns in this tab: ${headers.join(', ')}.`]
    );
  }
  return {
    kind: 'template',
    get(row) {
      const refs = parts.filter((p) => typeof p !== 'string');
      if (refs.every((p) => !row[p.index])) return ''; // all referenced cells empty
      return parts.map((p) => (typeof p === 'string' ? p : row[p.index] ?? '')).join('').trim();
    },
  };
}

/**
 * @param {string|undefined} spec   raw param value
 * @param {string[]} headers        column headers of the loaded tab
 * @param {string} [role]           'title' | 'description' | 'image' | 'link' (enables auto-detect)
 */
export function compileField(spec, headers, role) {
  const lowered = headers.map((h) => h.toLowerCase());
  const text = String(spec ?? '').trim();

  if (!text) {
    for (const name of AUTO[role] || []) {
      const i = lowered.indexOf(name);
      if (i >= 0) return column(i, headers[i]);
    }
    return role === 'title' && headers.length ? column(0, headers[0]) : NONE;
  }
  const exact = lowered.indexOf(text.toLowerCase());
  if (exact >= 0) return column(exact, headers[exact]);
  if (/\{[^{}]+\}/.test(text)) return template(text, headers, lowered);
  return { kind: 'literal', get: () => text };
}
