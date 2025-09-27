// ==UserScript==
// @name         Torn City Real Attack Percentages
// @author       Asemov/mtxve
// @namespace    https://github.com/mtxve
// @version      1.0
// @updateURL    https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/TCRAP/tcrap.js
// @downloadURL  https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/TCRAP/tcrap.js
// @description  Reveal actual Defence Settings Percentages
// @match        https://www.torn.com/preferences.php*
// ==/UserScript==

(() => {
  const CSS = `
    /* Absolutely position the number inside the row so it doesn't push content to a new line */
    #attack-preferences .tcv-right {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      margin: 0;
      display: flex;
      align-items: center;
      pointer-events: none; /* purely display */
    }
    #attack-preferences .tcv-badge {
      pointer-events: none;
      font: 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Arial,sans-serif;
      color: #ddd;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 10px;
      padding: 2px 8px;
      white-space: nowrap;
    }
  `;

  let mounted = false;
  let sliderObservers = [];
  let rootObserver = null;

  const $ = sel => document.querySelector(sel);
  const rootEl = () => $('#attack-preferences.prefs-cont.attack-pref');
  const visible = el => el && el.offsetParent !== null;

  function injectCSS() {
    if ($('#tcv-style')) return;
    const s = document.createElement('style');
    s.id = 'tcv-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function getSliders(root) {
    return [...root.querySelectorAll('.attack-pref-block.defending .range-slider.attacking-slider.primary')];
  }

  function getWeight(slider) {
    const v = slider.getAttribute('value') ?? slider.dataset.value ?? slider.getAttribute('aria-valuenow');
    if (v != null) {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return Math.max(0, n);
    }
    const track = slider.querySelector('.range-slider-track');
    if (track?.style?.width?.endsWith('%')) {
      const n = parseFloat(track.style.width);
      if (!Number.isNaN(n)) return Math.max(0, n);
    }
    return 0;
  }

  function ensureUI(slider) {
    const li = slider.closest('li');
    if (!li) return null;

    if (li.style.position !== 'relative') li.style.position = 'relative';

    let right = li.querySelector(':scope > .tcv-right');
    if (!right) {
      right = document.createElement('div');
      right.className = 'tcv-right';

      const badge = document.createElement('span');
      badge.className = 'tcv-badge';
      right.appendChild(badge);
      li.appendChild(right);

      right._badge = badge;
    }
    return right;
  }

  const fmt = p =>
    (p > 0 && p < 1) ? p.toFixed(2)
      : (p < 10 ? p.toFixed(2)
      : (p < 100 ? p.toFixed(1) : p.toFixed(0)));

  function render(root) {
    const sliders = getSliders(root);
    const weights = sliders.map(getWeight);
    const total = weights.reduce((a, b) => a + b, 0);

    if (total <= 0.0001) {
      sliders.forEach(s => {
        const ui = ensureUI(s);
        if (!ui) return;
        ui._badge.textContent = '0%';
      });
      return;
    }

    sliders.forEach((s, i) => {
      const pct = (weights[i] / total) * 100;
      const ui = ensureUI(s);
      if (!ui) return;
      ui._badge.textContent = `${fmt(pct)}%`;
    });
  }

  function detachSliderObservers() {
    sliderObservers.forEach(o => o.disconnect());
    sliderObservers = [];
  }

  function mount() {
    if (mounted) return;
    const root = rootEl();
    if (!root || !visible(root)) return;

    injectCSS();
    render(root);

    detachSliderObservers();
    getSliders(root).forEach(slider => {
      const mo = new MutationObserver(() => render(root));
      mo.observe(slider, { attributes: true, attributeFilter: ['value', 'aria-valuenow', 'style'] });
      ['input', 'change', 'pointerup', 'mouseup', 'touchend', 'keydown'].forEach(e =>
        slider.addEventListener(e, () => render(root), { passive: true })
      );
      sliderObservers.push(mo);
    });

    if (!rootObserver) {
      rootObserver = new MutationObserver(() => {
        detachSliderObservers();
        getSliders(root).length ? mount() : render(root);
      });
      rootObserver.observe(root, { childList: true, subtree: true });
    }

    mounted = true;
  }

  function unmount() {
    if (!mounted) return;
    detachSliderObservers();
    if (rootObserver) rootObserver.disconnect();
    rootObserver = null;
    mounted = false;
  }

  window.addEventListener('hashchange', () => {
    const root = rootEl();
    if (root && visible(root)) mount(); else unmount();
  }, { passive: true });

  const bootMO = new MutationObserver(() => {
    const root = rootEl();
    if (root && visible(root)) mount();
  });
  bootMO.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'complete' || document.readyState === 'interactive') mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
