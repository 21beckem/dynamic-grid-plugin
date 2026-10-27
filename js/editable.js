// Plain-text contenteditable controls with draggable column-token support.

import { el } from './util.js';

let lastFocusedEditor = null;
const dropTargets = new Set();
let activePointerDrop = null;
const TOKEN = /^\{\{([^{}]+)\}\}$/;

function isInside(editor, node) {
  return node === editor || editor.contains(node);
}

function hasMeaningfulContent(node) {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(node.nodeValue.trim());
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  if (node.dataset.columnToken || node.tagName === 'BR') return true;
  return [...node.childNodes].some(hasMeaningfulContent);
}

function hasContentAfter(node, editor) {
  let current = node;
  while (current && current !== editor) {
    for (let sibling = current.nextSibling; sibling; sibling = sibling.nextSibling) {
      if (hasMeaningfulContent(sibling)) return true;
    }
    current = current.parentNode;
  }
  return false;
}

function rangeAtInlineChipBoundary(editor, range, x, y) {
  for (const chip of editor.querySelectorAll('[data-column-token]')) {
    const rect = chip.getBoundingClientRect();
    const sameLine = y >= rect.top - 4 && y <= rect.bottom + 4;
    if (!sameLine) continue;
    const pointerInChip = x >= rect.left && x <= rect.right;
    const rangeInChip = range && chip.contains(range.startContainer);
    const lastContent = !hasContentAfter(chip, editor);
    const pointerAfterLastChip = lastContent && x >= rect.right && x <= editor.getBoundingClientRect().right;
    const pointerBeforeChip = x <= rect.left;
    if (!pointerInChip && !rangeInChip && !pointerAfterLastChip && !(pointerBeforeChip && !range)) continue;

    const boundary = document.createRange();
    const after = pointerAfterLastChip || (pointerInChip && x >= rect.left + rect.width / 2);
    if (after) boundary.setStartAfter(chip);
    else boundary.setStartBefore(chip);
    boundary.collapse(true);
    return boundary;
  }
  return range;
}

function rangeAtPoint(editor, x, y) {
  let range = null;
  if (typeof document.caretRangeFromPoint === 'function') {
    range = document.caretRangeFromPoint(x, y);
  } else if (typeof document.caretPositionFromPoint === 'function') {
    const position = document.caretPositionFromPoint(x, y);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }
  range = rangeAtInlineChipBoundary(editor, range, x, y);
  if (!range) {
    const rect = editor.getBoundingClientRect();
    const insideEditor = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (insideEditor && !editor.textContent) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
    }
  }
  if (!range || !isInside(editor, range.startContainer)) return null;
  range.collapse(true);
  return range;
}

function adjacentChip(range, direction) {
  const container = range.startContainer;
  if (container.nodeType !== Node.ELEMENT_NODE) return null;
  const index = direction === 'previous' ? range.startOffset - 1 : range.startOffset;
  const node = container.childNodes[index];
  return node?.dataset?.columnToken ? node : null;
}

function normalizeText(value, multiline) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  return multiline ? text : text.replace(/[\n\r]+/g, ' ');
}

function createInlineToken(token) {
  const match = token.match(TOKEN);
  const name = match ? match[1].trim() : token;
  return el('span', {
    class: 'inline-column-chip',
    text: name,
    contenteditable: 'false',
    'data-column-token': token,
    'aria-label': `Column ${name}`,
    title: token,
  });
}

function renderText(editor, value, multiline, tokenize, reservedTokens) {
  const text = normalizeText(value, multiline);
  if (!tokenize) {
    if (text) editor.append(document.createTextNode(text));
    return;
  }
  let last = 0;
  for (const match of text.matchAll(/\{\{[^{}]+\}\}/g)) {
    if (match.index > last) editor.append(document.createTextNode(text.slice(last, match.index)));
    const token = match[0];
    const name = token.slice(2, -2).trim();
    if (reservedTokens.has(name.toLowerCase())) editor.append(document.createTextNode(token));
    else editor.append(createInlineToken(token));
    last = match.index + token.length;
  }
  if (last < text.length) editor.append(document.createTextNode(text.slice(last)));
}

function serializeText(node, output) {
  if (node.nodeType === Node.TEXT_NODE) {
    output.push(node.nodeValue);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  if (node.dataset.columnToken) {
    output.push(node.dataset.columnToken);
    return;
  }
  if (node.tagName === 'BR') {
    output.push('\n');
    return;
  }
  const block = node.tagName === 'DIV' || node.tagName === 'P' || node.tagName === 'LI';
  if (block && output.length && !output.at(-1).endsWith('\n')) output.push('\n');
  for (const child of node.childNodes) serializeText(child, output);
  if (block && output.length && !output.at(-1).endsWith('\n')) output.push('\n');
}

function readText(editor, multiline) {
  const output = [];
  for (const child of editor.childNodes) serializeText(child, output);
  return normalizeText(output.join('').replace(/\n$/, ''), multiline);
}

function caretMetrics(editor, range) {
  const rect = range.getBoundingClientRect();
  const editorRect = editor.getBoundingClientRect();
  const style = getComputedStyle(editor);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 16;
  if (!rect.width && !rect.height) {
    const previousChip = adjacentChip(range, 'previous');
    const nextChip = adjacentChip(range, 'next');
    if (previousChip || nextChip) {
      const chipRect = (previousChip || nextChip).getBoundingClientRect();
      return {
        left: (previousChip ? chipRect.right : chipRect.left) - editorRect.left + editor.scrollLeft,
        top: chipRect.top - editorRect.top + editor.scrollTop,
        height: Math.max(chipRect.height, lineHeight),
      };
    }
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    return {
      left: paddingLeft + borderLeft,
      top: paddingTop + borderTop,
      height: lineHeight,
    };
  }
  return {
    left: rect.left - editorRect.left + editor.scrollLeft,
    top: rect.top - editorRect.top + editor.scrollTop,
    height: Math.max(rect.height, lineHeight),
  };
}

function createDropCaret() {
  return el('span', {
    class: 'editable-drop-caret',
    'aria-hidden': 'true',
    hidden: true,
  });
}

/**
 * Create a plain-text contenteditable control.
 *
 * The returned object deliberately matches the builder's existing control
 * interface, so the rest of the form does not need to know how it is edited.
 */
export function createEditableControl(option, {
  onChange = () => {},
  multiline = false,
  allowColumns = true,
  placeholder = option.placeholder || '',
  reservedTokens = [],
} = {}) {
  const editor = el('div', {
    id: `opt-${option.key}`,
    class: `editable ${multiline ? 'editable-multiline' : 'editable-singleline'}`,
    contenteditable: 'true',
    role: 'textbox',
    'aria-label': option.label,
    'aria-multiline': String(multiline),
    spellcheck: 'false',
    'data-placeholder': placeholder,
  });
  const caret = createDropCaret();
  const shell = el('div', {
    class: 'editable-shell',
    'data-column-target': String(allowColumns),
  }, editor, caret);

  let savedRange = null;
  const reserved = new Set(reservedTokens.map((token) => token.toLowerCase()));

  const saveSelection = () => {
    const selection = getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (isInside(editor, range.startContainer) && isInside(editor, range.endContainer)) {
      savedRange = range.cloneRange();
    }
  };

  const hideCaret = () => {
    caret.hidden = true;
    shell.classList.remove('is-drag-over');
  };

  const showCaret = (range) => {
    const metrics = caretMetrics(editor, range);
    caret.style.left = `${metrics.left}px`;
    caret.style.top = `${metrics.top}px`;
    caret.style.height = `${metrics.height}px`;
    caret.hidden = false;
    shell.classList.add('is-drag-over');
  };

  const insertNode = (node, range = savedRange) => {
    editor.focus();
    const target = range && isInside(editor, range.startContainer) && isInside(editor, range.endContainer)
      ? range.cloneRange()
      : (() => {
          const end = document.createRange();
          end.selectNodeContents(editor);
          end.collapse(false);
          return end;
        })();
    target.deleteContents();
    target.insertNode(node);
    target.setStartAfter(node);
    target.collapse(true);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(target);
    savedRange = target.cloneRange();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const insertText = (value, range = savedRange) => {
    const text = normalizeText(value, multiline);
    if (text) insertNode(document.createTextNode(text), range);
  };

  const insertToken = (token, range = savedRange) => {
    if (TOKEN.test(token)) insertNode(createInlineToken(token), range);
    else insertText(token, range);
  };

  const setValue = (value) => {
    editor.replaceChildren();
    renderText(editor, value, multiline, allowColumns, reserved);
    savedRange = null;
    hideCaret();
  };

  if (allowColumns) {
    dropTargets.add({
      editor,
      shell,
      rangeAt: (x, y) => rangeAtPoint(editor, x, y),
      showCaret,
      hideCaret,
      insertToken,
    });
  }

  editor.addEventListener('focus', () => {
    lastFocusedEditor = { insert: insertToken };
    saveSelection();
  });
  editor.addEventListener('keyup', saveSelection);
  editor.addEventListener('mouseup', saveSelection);
  editor.addEventListener('input', () => {
    saveSelection();
    onChange();
  });
  document.addEventListener('selectionchange', saveSelection);

  editor.addEventListener('paste', (event) => {
    event.preventDefault();
    insertText(event.clipboardData?.getData('text/plain') || '');
  });

  return {
    node: shell,
    get: () => readText(editor, multiline),
    set: setValue,
    onChange,
  };
}

/** Insert a token using the most recently focused editable control. */
export function insertIntoLastFocusedEditor(token) {
  lastFocusedEditor?.insert(token);
}

function targetAtPoint(x, y) {
  for (const target of dropTargets) {
    const rect = target.shell.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    const range = target.rangeAt(x, y);
    if (range) return { target, range };
  }
  return null;
}

function clearPointerDrop() {
  activePointerDrop?.target.hideCaret();
  activePointerDrop = null;
}

export function updateColumnDragAtPoint(x, y) {
  const hit = targetAtPoint(x, y);
  if (!hit) {
    clearPointerDrop();
    return;
  }
  if (activePointerDrop?.target !== hit.target) clearPointerDrop();
  hit.target.showCaret(hit.range);
  activePointerDrop = hit;
}

export function dropColumnDragAtPoint(x, y, token) {
  const hit = targetAtPoint(x, y) || activePointerDrop;
  if (hit) hit.target.insertToken(token, hit.range);
  clearPointerDrop();
}
