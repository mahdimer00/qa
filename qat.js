// ==UserScript==
// @name         RoadToQatar CAT3 Direct Cart + Checkout Autofill (no submit)
// @namespace    https://official-tickets.roadtoqatar.qa/
// @version      1.6.2
// @description  Add CAT3 tickets to cart, jump to checkout, and auto-fill required fields without submitting.
// @author       Codex
// @match        https://official-tickets.roadtoqatar.qa/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  /* ---------- Config for cart flow ---------- */
  const CONFIG = {
    sessionId: 2742971,
    eventName: 'Qatar Football Festival - WL',
    eventUrl: 'https://official-tickets.roadtoqatar.qa/qatar-football-festival/select/2742971?viewCode=Vista_Principal',
    checkoutUrl: 'https://official-tickets.roadtoqatar.qa/qatar-football-festival/checkout',
    homeUrl: 'https://official-tickets.roadtoqatar.qa/qatar-football-festival',
    cartApiUrl: 'https://official-tickets.roadtoqatar.qa/channels-api/v1/checkout/seats-auto',
    channelId: 4627,
    category: 'CAT3',
    rateId: 84666,
    priceTypeId: 365688,
    packId: null,
    price: 200,
    quantity: 4
  };

  const AUTO_START_PATH = '/qatar-football-festival/events';
  const CHECKOUT_PATH = '/qatar-football-festival/checkout';
  const state = { busy: false, autofillDone: false };

  /* ---------- Shared helpers ---------- */
  const log = (...args) => console.log('[CAT3]', ...args);
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const uuidv4 = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  const randomTraceId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);

  /* ---------- Cart/session helpers ---------- */
  function getStoredHeaders() {
    const headers = { obSessionToken: null, obChannelId: null, obLanguage: null, obAppTraceId: null, obClient: 'channels' };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        const lower = key.toLowerCase();
        if (lower.includes('ob-session-token') || lower === 'sessionid') headers.obSessionToken = value;
        if (lower.includes('channel')) headers.obChannelId = value;
        if (lower.includes('lang')) headers.obLanguage = value;
      }
    } catch (err) { log('LocalStorage read error:', err); }

    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        if (!value) continue;
        if (key.toLowerCase().includes('trackinginfo')) {
          try {
            const tracking = JSON.parse(value);
            if (tracking.channel?.id) headers.obChannelId = tracking.channel.id.toString();
            if (tracking.global?.lang) headers.obLanguage = tracking.global.lang;
          } catch (err) { log('Tracking parse error:', err); }
        }
      }
    } catch (err) { log('SessionStorage read error:', err); }

    return headers;
  }

  function injectSessionToken(token) {
    try {
      localStorage.setItem('ob-session-token', token);
      localStorage.setItem('sessionId', token);
      log('Injected session token', token);
      return true;
    } catch (err) { log('Token injection failed:', err); return false; }
  }

  const ensureHeaders = (h) => ({
    obSessionToken: h.obSessionToken || uuidv4(),
    obChannelId: h.obChannelId || CONFIG.channelId.toString(),
    obLanguage: h.obLanguage || 'en-GB',
    obAppTraceId: h.obAppTraceId || randomTraceId(),
    obClient: h.obClient || 'channels'
  });

  const toFetchHeaders = (h) => ({
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'ob-app-trace-id': h.obAppTraceId,
    'ob-channel-id': h.obChannelId,
    'ob-client': h.obClient,
    'ob-language': h.obLanguage,
    'ob-session-token': h.obSessionToken
  });

  async function addToCart(headers) {
    const payload = { sessionId: CONFIG.sessionId, quantity: CONFIG.quantity, rateId: CONFIG.rateId, priceTypeId: CONFIG.priceTypeId, packId: CONFIG.packId };
    log('Posting to cart', payload);
    const resp = await fetch(CONFIG.cartApiUrl, { method: 'POST', headers, body: JSON.stringify(payload), credentials: 'include' });
    const text = await resp.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (err) { log('Response parse error:', err); }
    return { ok: resp.ok, status: resp.status, data, text };
  }

  /* ---------- Cart flow ---------- */
  async function runCartFlow() {
    if (state.busy) return log('Already running');
    state.busy = true;
    try {
      await delay(1000);
      let stored = ensureHeaders(getStoredHeaders());
      if (!getStoredHeaders().obSessionToken) injectSessionToken(stored.obSessionToken);
      const result = await addToCart(toFetchHeaders(stored));
      if (result.ok) {
        log('Tickets added', result.data);
        alert('CAT3 tickets added to cart. Redirecting to checkout...');
        window.location.href = CONFIG.checkoutUrl;
      } else {
        log('Cart add failed', result.status, result.text);
        alert(`Add to cart failed (status ${result.status}). Check console for details.`);
      }
    } catch (err) {
      console.error('[CAT3] Fatal error', err);
      alert('Unexpected error. See console for details.');
    } finally { state.busy = false; }
  }

  function injectUI() {
    if (document.getElementById('cat3-direct-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'cat3-direct-btn';
    btn.textContent = 'Add CAT3 Direct';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', right: '20px', padding: '10px 14px',
      background: '#0052cc', color: '#fff', border: 'none', borderRadius: '6px',
      boxShadow: '0 4px 10px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: '99999'
    });
    btn.addEventListener('click', runCartFlow);
    document.body.appendChild(btn);
  }

  function registerMenu() {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Add CAT3 to cart (direct)', runCartFlow);
    }
  }

  /* ---------- Checkout autofill (no submit) ---------- */
  const cities = ['Doha', 'Riyadh', 'Dubai', 'Cairo', 'Istanbul', 'Casablanca', 'Muscat', 'Amman'];
  const randDigits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  const randPassport = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  async function waitFor(sel, timeout = 15000) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const el = document.querySelector(sel);
      if (el) return el;
      await delay(200);
    }
    throw new Error(`Timeout waiting for ${sel}`);
  }

  async function pickRandomMatOption(selectId) {
    const select = await waitFor(`#${selectId}`);
    select.click();
    await delay(250);
    const options = Array.from(document.querySelectorAll('mat-option'));
    if (options.length) options[Math.floor(Math.random() * options.length)].click();
    else select.click(); // close if none
  }

  async function ensureChecked(inputId, fallbackXPath) {
    const xpathNode = (path) =>
      document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    let input = document.querySelector(`#${inputId}`) || (fallbackXPath ? xpathNode(fallbackXPath) : null);
    if (!input) throw new Error(`Checkbox ${inputId} not found`);
    const label = input.closest('.mdc-form-field')?.querySelector('label');

    if (!input.checked && label) { label.click(); await delay(80); }
    if (!input.checked) { input.click(); await delay(80); }
    if (!input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await delay(20);
    }
  }

  async function runAutofill() {
    if (state.autofillDone) return;
    state.autofillDone = true;
    try {
      await waitFor('[data-testid=\"phone\"]');

      const phone = document.querySelector('[data-testid=\"phone\"]');
      phone.value = randDigits(9);
      phone.dispatchEvent(new Event('input', { bubbles: true }));

      await pickRandomMatOption('phone_prefix'); // country code
      await pickRandomMatOption('gender');

      const cityEl = document.querySelector('[data-testid=\"city\"]');
      cityEl.value = cities[Math.floor(Math.random() * cities.length)];
      cityEl.dispatchEvent(new Event('input', { bubbles: true }));

      await pickRandomMatOption('nationality');

      const idEl = document.querySelector('[data-testid=\"identification_id\"]');
      idEl.value = randPassport();
      idEl.dispatchEvent(new Event('input', { bubbles: true }));

      await ensureChecked('mat-mdc-checkbox-0-input'); // accept all
      await ensureChecked(
        'mat-mdc-checkbox-1-input',
        '/html/body/app-root/ob-sidebar/mat-sidenav-container/mat-sidenav-content/main/ob-page-full-checkout/div/div[1]/form/ob-payment-checkout/section[2]/ob-channels-checkout-agreements/section/ob-checkout-agreements/div/mat-checkbox[2]/div/div/input'
      ); // general T&C
      await ensureChecked('mat-mdc-checkbox-3-input'); // channel terms

      // optional marketing: uncomment to opt in
      // await ensureChecked('mat-mdc-checkbox-2-input');

      log('Checkout autofill complete (no submit).');
    } catch (err) {
      console.error('[CAT3] Autofill error', err);
    }
  }

  /* ---------- Init ---------- */
  function ready(fn) {
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  ready(() => {
    registerMenu();
    injectUI();
    log('CAT3 direct cart helper ready.');

    if (location.pathname.startsWith(AUTO_START_PATH)) {
      log('Events page detected, auto-starting cart flow...');
      setTimeout(runCartFlow, 1500);
    }

    const maybeAutofill = () => {
      if (location.pathname.startsWith(CHECKOUT_PATH)) {
        state.autofillDone = false; // allow rerun on soft nav
        setTimeout(runAutofill, 600);
      }
    };

    window.addEventListener('load', maybeAutofill, { once: true });
    document.addEventListener('pjax:end', maybeAutofill);
    window.addEventListener('popstate', maybeAutofill);
  });
})();
