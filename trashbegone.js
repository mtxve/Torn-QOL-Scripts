// ==UserScript==
// @name         Torn City: Trash Begone!
// @namespace    https://github.com/asemov/Torn-QOL-Scripts
// @version      1.0
// @description  Hides the trash icon on your items page, so Tactical_Santa doesn't accidentally trash something again.
// @author       Asemov/mtxve
// @updateURL    https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/trashbegone.js
// @downloadURL  https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/trashbegone.js
// @match        https://www.torn.com/item.php*
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const style = document.createElement('style');
  style.setAttribute('data-trash-begone', '1');
  style.textContent = `
    /* Hide the per-item left-side Trash/Dump action */
    li.left.dump,
    .dump.left,
    ul.action li.left.dump,
    ul.options li.left.dump {
      display: none !important;
    }
  `;

  const inject = () => {
    if (!document.head) return;
    if (!document.head.querySelector('style[data-trash-begone="1"]')) {
      document.head.appendChild(style);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();

