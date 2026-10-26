// Everything that talks to Google Sheets lives here. To support another data
// source later (a CSV URL, Airtable, ...), add a sibling module that returns the
// same shape: { headers: string[], rows: string[][] }.

import { UserError } from './util.js';

const PUBLISHED_PREFIX = '2PACX-';
const TIMEOUT_MS = 15000;

const SHARE_HINTS = [
  'Share the sheet as “Anyone with the link → Viewer”, or publish it with File → Share → Publish to web.',
  'Check that the Sheet ID and the tab are correct.',
];

/** Accepts a bare ID or a pasted sheet URL. Returns null if it can't find an ID. */
export function parseSheetId(input) {
  const raw = String(input ?? '').trim();
  const gid = (raw.match(/[#&?]gid=(\d+)/) || [])[1] || '';
  let m = raw.match(/\/spreadsheets\/d\/e\/([\w-]+)/);
  if (m) return { id: m[1], published: true, gid };
  m = raw.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (m) return { id: m[1], published: m[1].startsWith(PUBLISHED_PREFIX), gid };
  if (/^[\w-]{15,}$/.test(raw)) return { id: raw, published: raw.startsWith(PUBLISHED_PREFIX), gid: '' };
  return null;
}

/** Trim, name blank/duplicate headers, drop empty rows. */
export function normalizeTable(rawHeaders, rawRows) {
  const seen = new Map();
  const headers = rawHeaders.map((h, i) => {
    const name = String(h ?? '').trim() || `Column ${i + 1}`;
    const key = name.toLowerCase();
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    return count > 1 ? `${name} (${count})` : name;
  });
  const rows = rawRows
    .map((r) => headers.map((_, i) => String(r[i] ?? '').trim()))
    .filter((r) => r.some(Boolean));
  return { headers, rows };
}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- gviz (regular sheet IDs) -------------------------------------------------

function gvizUrl(id, selector, tqx, forceRefresh = false) {
  const params = new URLSearchParams({ tqx, headers: '1' });
  if (selector) params.set(/^\d+$/.test(selector) ? 'gid' : 'sheet', selector);
  if (forceRefresh) {
    params.set('t', Date.now().toString());
  }
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${params}`;
}

function parseGvizText(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Not a gviz response');
  return JSON.parse(text.slice(start, end + 1));
}

function tableFromGviz(data) {
  if (data.status === 'error') {
    const e = (data.errors && data.errors[0]) || {};
    throw new UserError('Google Sheets couldn’t read that tab.', [
      e.detailed_message || e.message || 'Unknown error.',
      'Check that the tab name or gid is correct.',
    ]);
  }
  const { cols = [], rows = [] } = data.table || {};
  const cell = (c) => (c ? String(c.f ?? c.v ?? '') : '');
  const body = rows.map((r) => (r.c || []).map(cell));
  const labels = cols.map((c) => c.label || '');
  if (labels.every((l) => !l.trim())) {
    // Google didn't detect a header row; treat the first row as headers.
    const [first = [], ...rest] = body;
    return normalizeTable(first, rest);
  }
  return normalizeTable(labels, body);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Script-tag loading isn't subject to CORS, so it works as a fallback.
function jsonp(makeUrl) {
  return new Promise((resolve, reject) => {
    const name = `__gsgrid_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const cleanup = () => { clearTimeout(timer); delete window[name]; script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, TIMEOUT_MS);
    window[name] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('script error')); };
    script.src = makeUrl(name);
    document.head.append(script);
  });
}

async function loadGviz(id, selector, forceRefresh = false) {
  try {
    return tableFromGviz(parseGvizText(await fetchText(gvizUrl(id, selector, 'out:json', forceRefresh))));
  } catch (err) {
    if (err instanceof UserError) throw err;
  }
  try {
    return tableFromGviz(await jsonp((cb) => gvizUrl(id, selector, `out:json;responseHandler=${cb}`, forceRefresh)));
  } catch (err) {
    if (err instanceof UserError) throw err;
    throw new UserError('Couldn’t load the sheet.', SHARE_HINTS);
  }
}

// ---- published-to-web CSV (2PACX-… IDs) ---------------------------------------

async function loadPublishedCsv(id, selector, forceRefresh = false) {
  if (selector && !/^\d+$/.test(selector)) {
    throw new UserError('Published sheets can only be picked by gid.', [
      'Use the number after gid= in the tab’s URL instead of the tab name.',
    ]);
  }
  const url = new URL(`https://docs.google.com/spreadsheets/d/e/${id}/pub`);
  if (forceRefresh) {
    url.searchParams.set('t', Date.now().toString());
  }
  url.searchParams.set('output', 'csv');
  if (selector) url.searchParams.set('gid', selector);
  try {
    const [headers = [], ...rows] = parseCsv(await fetchText(url.href));
    return normalizeTable(headers, rows);
  } catch {
    throw new UserError('Couldn’t load the published sheet.', [
      'Check that the sheet is still published (File → Share → Publish to web) and the ID is correct.',
    ]);
  }
}

// ---- public API ---------------------------------------------------------------

function readCache(key, seconds) {
  if (!seconds) return null;
  try {
    const hit = JSON.parse(sessionStorage.getItem(key));
    if (hit && Date.now() - hit.t < seconds * 1000) return hit.table;
  } catch { /* storage unavailable or corrupt */ }
  return null;
}

function writeCache(key, table) {
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), table })); } catch { /* ignore */ }
}

/**
 * Load one tab of a sheet.
 * @param {{uid: string, sheet?: string, cacheSeconds?: number}} opts
 * @returns {Promise<{headers: string[], rows: string[][]}>}
 */
export async function loadSheet({ uid, sheet = '', cacheSeconds = 60, forceRefresh = false } = {}) {
  const parsed = parseSheetId(uid);
  if (!parsed) {
    throw new UserError('That doesn’t look like a Google Sheets ID.', [
      'Use the long ID from the sheet’s URL, between /d/ and /edit, or paste the whole URL.',
    ]);
  }
  const selector = String(sheet || parsed.gid || '').trim();
  const key = `gsgrid:${parsed.id}:${selector}`;
  const cached = readCache(key, cacheSeconds);
  if (cached) return cached;
  const table = parsed.published
    ? await loadPublishedCsv(parsed.id, selector, forceRefresh)
    : await loadGviz(parsed.id, selector, forceRefresh);
  writeCache(key, table);
  return table;
}
