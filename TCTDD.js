// ==UserScript==
// @name         Torn City Travel Destination Disabler
// @namespace    https://github.com/mtxve/Torn-QOL-Scripts
// @version      1.2
// @description  Disable the damn locations you don't want to accidentally travel to.
// @author       Asemov/mtxve
// @updateURL    https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/TCTDD.js
// @downloadURL  https://raw.githubusercontent.com/mtxve/Torn-QOL-Scripts/refs/heads/main/TCTDD.js
// @match        https://www.torn.com/page.php?sid=travel*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const STORAGE_KEY = "tc_travel_disabled_destinations_v1";
  const ROOT = "#travel-root";
  const MAP_INPUT = 'input[name="destination"][type="radio"]';
  const MAP_LABEL = 'label[class*="destinationLabel"]';
  const COMPACT_BUTTON = 'button[class*="expandButton"]';

  const STYLE_ID = "tc-travel-destination-toggle-style";
  const TOGGLE_CLASS = "tc-dest-toggle";
  const DISABLED_CLASS = "tc-dest-disabled";
  const ROW_CLASS = "tc-dest-row";
  const DEST_ATTR = "data-tc-destination-id";

  let disabled = loadDisabled();
  let observer = null;
  let queued = 0;

  function loadDisabled() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return new Set(Array.isArray(data) ? data.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function saveDisabled() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(disabled)));
  }

  function isDisabled(id) {
    return disabled.has(String(id));
  }

  function setDisabled(id, off) {
    const key = String(id);
    if (off) disabled.add(key);
    else disabled.delete(key);
    saveDisabled();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      ${ROOT} fieldset { position: relative; }
      ${ROOT} .${TOGGLE_CLASS} {
        width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,.65); border: 1px solid rgba(255,255,255,.45);
        border-radius: 3px; box-sizing: border-box; cursor: pointer; user-select: none;
      }
      ${ROOT} .${TOGGLE_CLASS}--map {
        position: absolute; z-index: 50; transform: translate(12px, -8px);
      }
      ${ROOT} .${TOGGLE_CLASS}--compact {
        position: relative; z-index: 2; margin: 0 8px 0 2px; flex-shrink: 0;
      }
      ${ROOT} .${TOGGLE_CLASS}[data-off="1"] { background: rgba(90,0,0,.7); }
      ${ROOT} .${TOGGLE_CLASS} input { width: 11px; height: 11px; margin: 0; cursor: pointer; }
      ${ROOT} .${DISABLED_CLASS} { opacity: .35; filter: grayscale(1); }
      ${ROOT} label.${DISABLED_CLASS}[class*="destinationLabel"] { pointer-events: none; }
      ${ROOT} .${ROW_CLASS} { position: relative; }
      ${ROOT} .${ROW_CLASS}[data-off="1"] button[class*="expandButton"] { cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }

  function queueRender() {
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      render();
    });
  }

  function parseTravelModel() {
    const raw = document.querySelector(ROOT)?.getAttribute("data-model") || "";
    if (!raw) return { byId: new Map(), byKey: new Map(), byCountry: new Map() };

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        parsed = JSON.parse(raw.replace(/&quot;/g, '"'));
      } catch {
        parsed = null;
      }
    }

    const byId = new Map();
    const byKey = new Map();
    const byCountry = new Map();

    const norm = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = (country, city) => `${norm(country)}|${norm(city)}`;

    const destinations = Array.isArray(parsed?.destinations) ? parsed.destinations : [];
    for (const d of destinations) {
      if (!d || d.id == null) continue;
      const id = String(d.id);
      const countryKey = norm(d.country);
      byId.set(id, d);
      byKey.set(key(d.country, d.city), id);
      if (!countryKey) continue;
      if (!byCountry.has(countryKey)) byCountry.set(countryKey, id);
      else if (byCountry.get(countryKey) !== id) byCountry.set(countryKey, null);
    }

    return { byId, byKey, byCountry, norm, key };
  }

  function buildToggle(id, mode, name) {
    const el = document.createElement("label");
    el.className = `${TOGGLE_CLASS} ${TOGGLE_CLASS}--${mode}`;
    el.setAttribute(DEST_ATTR, String(id));

    const box = document.createElement("input");
    box.type = "checkbox";
    box.setAttribute("aria-label", `Enable ${name}`);
    box.addEventListener("click", (e) => e.stopPropagation());
    box.addEventListener("change", () => {
      setDisabled(id, !box.checked);
      queueRender();
    });

    el.addEventListener("click", (e) => e.stopPropagation());
    el.appendChild(box);
    return el;
  }

  function applyToggleState(toggle, id, name) {
    const off = isDisabled(id);
    const box = toggle.querySelector("input");
    if (box) box.checked = !off;
    toggle.setAttribute("data-off", off ? "1" : "0");
    toggle.title = `${name} ${off ? "(disabled)" : "(enabled)"}`;
  }

  function renderMap(lookup) {
    const inputs = Array.from(document.querySelectorAll(`${ROOT} ${MAP_INPUT}`));
    const idsByFieldset = new Map();

    for (const input of inputs) {
      const label = input.closest("label");
      const fieldset = input.closest("fieldset");
      if (!label || !fieldset || !input.value) continue;

      const id = String(input.value);
      const country = (input.getAttribute("aria-label") || "").split(" - ")[0]
        || lookup.byId.get(id)?.country
        || `Destination ${id}`;

      if (!idsByFieldset.has(fieldset)) idsByFieldset.set(fieldset, new Set());
      idsByFieldset.get(fieldset).add(id);

      let toggle = fieldset.querySelector(`.${TOGGLE_CLASS}--map[${DEST_ATTR}="${id}"]`);
      if (!toggle) {
        toggle = buildToggle(id, "map", country);
        fieldset.appendChild(toggle);
      }

      toggle.style.top = input.style.top || label.style.top || "0px";
      toggle.style.left = input.style.left || label.style.left || "0px";
      applyToggleState(toggle, id, country);

      const off = isDisabled(id);
      label.classList.toggle(DISABLED_CLASS, off);
      input.disabled = off;
      input.setAttribute("aria-disabled", String(off));
      if (off && input.checked) {
        input.checked = false;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    for (const [fieldset, validIds] of idsByFieldset.entries()) {
      const toggles = fieldset.querySelectorAll(`.${TOGGLE_CLASS}--map[${DEST_ATTR}]`);
      for (const toggle of toggles) {
        const id = toggle.getAttribute(DEST_ATTR);
        if (!id || !validIds.has(id)) toggle.remove();
      }
    }
  }

  function resolveCompactId(button, lookup) {
    const row = button.closest(`.${ROW_CLASS}`) || button.closest(`${ROOT} div[class*="destination"]`);
    const cached = row?.getAttribute(DEST_ATTR) || button.getAttribute(DEST_ATTR);
    if (cached) return cached;

    const panelId = row?.querySelector('[id^="travel-country-"]')?.id?.replace("travel-country-", "");
    if (panelId) return panelId;

    const rawName = (button.querySelector('[class*="flagAndName"] [class*="name"]')?.textContent || "")
      .replace(/\s+/g, " ")
      .trim();

    let country = "";
    let city = "";
    if (rawName.includes(" - ")) {
      const parts = rawName.split(" - ");
      country = parts[0] || "";
      city = parts.slice(1).join(" - ");
    } else {
      country = (button.querySelector('[class*="country"]')?.textContent || "").trim();
    }

    return lookup.byKey.get(lookup.key(country, city))
      || lookup.byCountry.get(lookup.norm(country))
      || null;
  }

  function renderCompact(lookup) {
    const buttons = Array.from(document.querySelectorAll(`${ROOT} ${COMPACT_BUTTON}`));

    for (const button of buttons) {
      const row = button.closest(`${ROOT} div[class*="destination"]`);
      if (!row) continue;
      row.classList.add(ROW_CLASS);

      const cell = button.querySelector('[class*="flagAndName"]');
      if (!cell) continue;

      const id = resolveCompactId(button, lookup);
      if (!id) continue;

      const name = lookup.byId.get(String(id))?.country || `Destination ${id}`;
      row.setAttribute(DEST_ATTR, String(id));
      button.setAttribute(DEST_ATTR, String(id));

      for (const stale of cell.querySelectorAll(`.${TOGGLE_CLASS}--compact`)) {
        if (stale.getAttribute(DEST_ATTR) !== String(id)) stale.remove();
      }

      let toggle = cell.querySelector(`.${TOGGLE_CLASS}--compact[${DEST_ATTR}="${id}"]`);
      if (!toggle) {
        toggle = buildToggle(id, "compact", name);
        cell.prepend(toggle);
      }

      const off = isDisabled(id);
      row.classList.toggle(DISABLED_CLASS, off);
      row.setAttribute("data-off", off ? "1" : "0");
      button.disabled = off;
      button.setAttribute("aria-disabled", String(off));
      applyToggleState(toggle, id, name);

      const panel = row.querySelector(`[id="travel-country-${id}"]`) || row.querySelector('[id^="travel-country-"]');
      if (panel) {
        for (const actionButton of panel.querySelectorAll("button")) {
          if (!actionButton.closest(`.${TOGGLE_CLASS}`)) actionButton.disabled = off;
        }
      }
    }
  }

  function targetDestinationId(target) {
    if (!(target instanceof Element)) return null;
    if (target.closest(`.${TOGGLE_CLASS}`)) return null;

    const directInput = target.closest(`${ROOT} ${MAP_INPUT}`);
    if (directInput?.value) return directInput.value;

    const mapLabel = target.closest(`${ROOT} ${MAP_LABEL}`);
    if (mapLabel) {
      const input = mapLabel.querySelector(MAP_INPUT);
      if (input?.value) return input.value;
    }

    const row = target.closest(`${ROOT} .${ROW_CLASS}`);
    if (row?.getAttribute(DEST_ATTR)) return row.getAttribute(DEST_ATTR);

    const panel = target.closest(`${ROOT} [id^="travel-country-"]`);
    if (panel?.id) return panel.id.replace("travel-country-", "");

    const compactButton = target.closest(`${ROOT} ${COMPACT_BUTTON}`);
    if (compactButton?.getAttribute(DEST_ATTR)) return compactButton.getAttribute(DEST_ATTR);

    return null;
  }

  function blockIfDisabled(event) {
    const id = targetDestinationId(event.target);
    if (!id || !isDisabled(id)) return;
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function onKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    blockIfDisabled(event);
  }

  function render() {
    const lookup = parseTravelModel();
    renderMap(lookup);
    renderCompact(lookup);
  }

  function start() {
    const root = document.querySelector(ROOT);
    if (!root) {
      setTimeout(start, 300);
      return;
    }

    injectStyles();
    render();

    if (!observer) {
      observer = new MutationObserver(queueRender);
      observer.observe(root, { childList: true, subtree: true });
    }
  }

  document.addEventListener("click", blockIfDisabled, true);
  document.addEventListener("change", blockIfDisabled, true);
  document.addEventListener("keydown", onKeydown, true);
  window.addEventListener("hashchange", queueRender, { passive: true });
  window.addEventListener("resize", queueRender, { passive: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
