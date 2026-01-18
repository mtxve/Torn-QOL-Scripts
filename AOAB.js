// ==UserScript==
// @name         Always On Attack Button
// @namespace    https://torn.com/
// @version      1.0
// @description  Always enable the profile Attack button UI.
// @author       Asemov/mtxve
// @updateURL    https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/AOAB.js
// @downloadURL  https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/AOAB.js
// @match        https://www.torn.com/profiles.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.self !== window.top) return;

  const ATTACK_BUTTON_SELECTOR = 'a.profile-button.profile-button-attack';
  const DISABLED_CLASS = 'disabled';
  const ENABLED_CLASS = 'active';
  const DISABLED_ICON_CLASS = 'disabled___xBFso';
  const CLICK_GUARD_ATTR = 'data-tna-force-attack';

  const prepButton = (btn) => {
    if (!btn || !(btn instanceof HTMLElement)) return false;
    btn.classList.remove(DISABLED_CLASS);
    btn.classList.add(ENABLED_CLASS);
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('tabindex');
    btn.querySelector('svg')?.classList.remove(DISABLED_ICON_CLASS);

    if (btn.getAttribute(CLICK_GUARD_ATTR) !== '1') {
      btn.setAttribute(CLICK_GUARD_ATTR, '1');
      btn.addEventListener('click', (event) => {
        if (!event.isTrusted) return;
        if (event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const href = btn.getAttribute('href');
        if (!href) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.location.assign(href);
      }, true);
    }
    return true;
  };

  const tryEnable = () => {
    const btn = document.querySelector(ATTACK_BUTTON_SELECTOR);
    return prepButton(btn);
  };

  if (!tryEnable()) {
    let tries = 0;
    const maxTries = 50;
    const interval = setInterval(() => {
      tries += 1;
      if (tryEnable() || tries >= maxTries) {
        clearInterval(interval);
      }
    }, 100);
  }
})();
