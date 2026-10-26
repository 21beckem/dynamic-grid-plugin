import { createCard } from '../card.js';
import { el, prefersReducedMotion } from '../util.js';

const ICON = (path) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">` +
  `<path d="${path}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function navButton(direction, label) {
  const button = el('button', { class: `nav nav-${direction}`, type: 'button', 'aria-label': label });
  button.innerHTML = ICON(direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'); // constant markup
  return button;
}

export default {
  name: 'carousel',
  render(container, items, ctx) {
    const track = el(
      'div',
      { class: 'track', tabindex: '0', role: 'region', 'aria-label': 'Scrollable items' },
      items.map((item) => createCard(item, ctx))
    );
    const prev = navButton('prev', 'Previous items');
    const next = navButton('next', 'Next items');
    const wrap = el('div', { class: 'carousel' }, track, prev, next);
    container.replaceChildren(wrap);

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    const page = (direction) =>
      track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior });

    const update = () => {
      const max = maxScroll();
      wrap.classList.toggle('no-overflow', max <= 1);
      prev.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= max - 1;
    };

    prev.addEventListener('click', () => page(-1));
    next.addEventListener('click', () => page(1));
    track.addEventListener('scroll', update, { passive: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(track);
    else addEventListener('resize', update);
    requestAnimationFrame(update);

    if (ctx.autoplay > 0 && !prefersReducedMotion()) {
      let paused = false;
      const pause = () => { paused = true; };
      const resume = () => { paused = false; };
      wrap.addEventListener('pointerenter', pause);
      wrap.addEventListener('pointerleave', resume);
      wrap.addEventListener('focusin', pause);
      wrap.addEventListener('focusout', resume);
      setInterval(() => {
        if (paused || document.hidden || maxScroll() <= 1) return;
        if (track.scrollLeft >= maxScroll() - 1) track.scrollTo({ left: 0, behavior });
        else page(1);
      }, ctx.autoplay * 1000);
    }
  },
};
