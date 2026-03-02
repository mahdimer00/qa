// ==UserScript==
// @name        CAT 3
// @namespace   https://official-tickets.roadtoqatar.qa/
// @version     1.6.8
// @description 409 → retry/random | 403 → wait random → reload → auto-continue
// @author      Codex
// @match       https://official-tickets.roadtoqatar.qa/*
// @grant       GM_registerMenuCommand
// @run-at      document-idle
// ==/UserScript==

(() => {
  'use strict';

  const CONFIG = {
    checkoutUrl: 'https://official-tickets.roadtoqatar.qa/qatar-football-festival/checkout',
    cartApiUrl:  'https://official-tickets.roadtoqatar.qa/channels-api/v1/checkout/seats-auto',
    channelId:   4627,
    rateId:      84666,
    priceTypeId: 365688,
    quantity:    4
  };

  const AUTO_START_PATH = '/qatar-football-festival/events';
  const CHECKOUT_PATH   = '/qatar-football-festival/checkout';

  const state = { busy: false, autofillDone: false };

  const log = (...args) => console.log('[CAT3]', ...args);
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const uuidv4 = () => crypto.randomUUID();

  function playSuccessSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  function getStoredHeaders() {
    const h = { obSessionToken:null, obChannelId:null, obLanguage:null, obClient:'channels' };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i).toLowerCase();
        const v = localStorage.getItem(localStorage.key(i));
        if (k.includes('ob-session-token') || k === 'sessionid') h.obSessionToken = v;
        if (k.includes('channel')) h.obChannelId = v;
        if (k.includes('lang')) h.obLanguage = v;
      }
    } catch {}
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        if (sessionStorage.key(i).toLowerCase().includes('trackinginfo')) {
          const t = JSON.parse(sessionStorage.getItem(sessionStorage.key(i)));
          if (t?.channel?.id)    h.obChannelId = String(t.channel.id);
          if (t?.global?.lang)   h.obLanguage = t.global.lang;
        }
      }
    } catch {}
    return h;
  }

  function ensureHeaders(h) {
    return {
      obSessionToken: h.obSessionToken || uuidv4(),
      obChannelId:    h.obChannelId    || String(CONFIG.channelId),
      obLanguage:     h.obLanguage     || 'en-GB',
      obClient:       'channels'
    };
  }

  function toFetchHeaders(h) {
    return {
      accept: 'application/json, text/plain, */*',
      'content-type': 'application/json',
      'ob-channel-id':   h.obChannelId,
      'ob-client':       h.obClient,
      'ob-language':     h.obLanguage,
      'ob-session-token': h.obSessionToken
    };
  }

  async function addToCart(headers) {
    const payload = {
      sessionId: 2742971,
      quantity: CONFIG.quantity,
      rateId: CONFIG.rateId,
      priceTypeId: CONFIG.priceTypeId,
      packId: null
    };

    const res = await fetch(CONFIG.cartApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include'
    });

    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }

  async function tryAddToCart() {
    if (state.busy) return;
    state.busy = true;
    log('Attempting add to cart...');

    try {
      const stored = ensureHeaders(getStoredHeaders());
      const result = await addToCart(toFetchHeaders(stored));

      if (result.ok) {
        log('SUCCESS → redirecting');
        playSuccessSound();
        location.href = CONFIG.checkoutUrl;
        return;
      }

      log(`Failed ${result.status}`, result.data?.code || '');

      if (result.status === 403) {
        const wait = 8000 + Math.random() * 7000; // 8–15s
        log(`403 → waiting ${Math.round(wait/1000)}s → reload`);
        await delay(wait);
        log('Reloading...');
        location.reload(); // page reloads → init() runs again → auto-restart
        return;
      }

      if (result.status === 409 && result.data?.code === 'ORDER_SEAT_NOT_AVAILABLE') {
        const wait = 8000 + Math.random() * 7000; // 8–15s
        log(`409 → retry in ${Math.round(wait/1000)}s`);
        setTimeout(tryAddToCart, wait);
        return;
      }

      log('Unexpected error');
    } catch (err) {
      log('Fatal', err.message);
    } finally {
      state.busy = false;
    }
  }

  async function runAutofill() {
    if (state.autofillDone) return;
    state.autofillDone = true;
    log('Autofill checkout...');

    try {
      await delay(800);
      const phone = document.querySelector('[data-testid="phone"]');
      if (phone) {
        phone.value = '5' + Math.floor(1000000 + Math.random()*9000000);
        phone.dispatchEvent(new Event('input', {bubbles:true}));
        log('Phone set');
      }
    } catch (e) {
      log('Autofill fail', e.message);
    }
  }

  function injectUI() {
    if (document.getElementById('cat3-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'cat3-btn';
    btn.textContent = 'CAT3 Auto-Retry';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 16px;background:#b71c1c;color:#fff;border:none;border-radius:6px;z-index:99999;cursor:pointer;font-weight:bold;';
    document.body.appendChild(btn);

    const logPanel = document.createElement('div');
    logPanel.id = 'cat3-log';
    logPanel.style.cssText = 'position:fixed;bottom:70px;right:20px;width:380px;max-height:260px;overflow-y:auto;background:#000;color:#0f0;padding:10px;border:1px solid #333;border-radius:6px;font-family:monospace;font-size:13px;white-space:pre-wrap;z-index:99998;display:none;';
    document.body.appendChild(logPanel);

    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      if (args[0] === '[CAT3]') {
        const div = document.createElement('div');
        div.textContent = new Date().toLocaleTimeString() + ' ' + args.slice(1).join(' ');
        logPanel.appendChild(div);
        logPanel.scrollTop = logPanel.scrollHeight;
      }
    };

    btn.onclick = () => {
      logPanel.style.display = logPanel.style.display === 'none' ? 'block' : 'none';
      tryAddToCart();
    };

    log('UI ready – click to start / toggle log');
  }

  function init() {
    injectUI();
    GM_registerMenuCommand?.('CAT3 Auto-Retry', tryAddToCart);

    if (location.pathname.startsWith(AUTO_START_PATH)) {
      log('Auto-start in 2s');
      setTimeout(tryAddToCart, 2000);
    }

    if (location.pathname.startsWith(CHECKOUT_PATH)) {
      runAutofill();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }

})();
