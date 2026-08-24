// behavior.js — the reusable BEHAVIOR layer for a P5 landing page.
//
// This is mechanism, not design. The frontend-design output authors index.html + the CSS fresh and
// unique; it just wires to the DOM contract below, and this file makes the three moving parts work
// the same on every landing (so they're tested once, not re-derived per app):
//
//   1. Bilingual toggle  — buttons `.lang-toggle__btn[data-lang="en|es"]` set <html lang>; the CSS
//      shows/hides the paired `.lang-en` / `.lang-es` elements off that attribute (the 3-line rule is
//      documented in references/sections.md). Choice persists in localStorage `<slug>-lang`, with a
//      `?lang=` URL override and a browser-language fallback.
//   2. Contact copy      — any `[data-copy-email]` click copies the address and shows the snackbar.
//   3. Snackbar          — a single `.snackbar` element; `showSnackbar(text)` flashes `.snackbar--show`.
//
// Config via <html> data attributes:  data-app-slug="unworried"  data-langs="en,es"  (both optional).

(function () {
  'use strict';
  var docEl = document.documentElement;
  var SLUG = (docEl.dataset.appSlug || 'app').replace(/[^a-z0-9-]/gi, '') || 'app';
  var LANGS = (docEl.dataset.langs || 'en,es').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (LANGS.length === 0) LANGS = ['en'];
  var DEFAULT_LANG = LANGS[0];
  var STORE_KEY = SLUG + '-lang';

  function supported(l) { return LANGS.indexOf(l) !== -1; }

  function resolveLang() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get('lang');
      if (fromUrl && supported(fromUrl)) return fromUrl;
    } catch (e) {}
    try {
      var saved = window.localStorage.getItem(STORE_KEY);
      if (saved && supported(saved)) return saved;
    } catch (e) {}
    var nav = (navigator.language || 'en').slice(0, 2);
    if (supported(nav)) return nav;
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (!supported(lang)) return;
    docEl.lang = lang;                                  // the CSS keys element visibility off this
    try { window.localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url);
    } catch (e) {}
    var btns = document.querySelectorAll('.lang-toggle__btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-lang') === lang);
      btns[i].setAttribute('aria-pressed', String(btns[i].getAttribute('data-lang') === lang));
    }
  }

  // ── snackbar ──────────────────────────────────────────────────────────────────
  var snackTimer = null;
  function showSnackbar(text) {
    var el = document.querySelector('.snackbar');
    if (!el) return;
    el.textContent = text;
    el.classList.add('snackbar--show');
    if (snackTimer) clearTimeout(snackTimer);
    snackTimer = setTimeout(function () { el.classList.remove('snackbar--show'); }, 2400);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {       // fallback for older / insecure contexts
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function copiedMessage(email) {
    // Locale-pages builds inject the app's own toast (TALLY_STRINGS.copied),
    // already in the page's language; the en/es echo is the classic-mode fallback.
    var injected = window.TALLY_STRINGS && window.TALLY_STRINGS.copied;
    if (injected) return injected;
    return (docEl.lang === 'es') ? ('Copiado ' + email) : ('Copied ' + email);
  }

  // ── wire up ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // The bilingual toggle only exists in paired-classes mode. Locale-pages
    // builds (one page per locale, no toggle buttons) must never run it: it
    // would rewrite <html lang> to the visitor's browser language on a page
    // whose lang is a build-time fact.
    if (document.querySelector('.lang-toggle__btn')) setLang(resolveLang());

    document.querySelectorAll('.lang-toggle__btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });

    document.querySelectorAll('[data-copy-email]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        var email = el.getAttribute('data-copy-email');
        if (!email) return;
        copyText(email).then(function () { showSnackbar(copiedMessage(email)); })
          .catch(function () { showSnackbar(email); });   // at minimum surface the address
      });
    });

    // Optional nav scroll-state (harmless if the CSS doesn't use it). Match the sticky header by an
    // explicit [data-nav] hook first, then a .nav class, then a bare <nav> — so it targets the header,
    // not an inner <nav> links list.
    var nav = document.querySelector('[data-nav]') || document.querySelector('.nav') || document.querySelector('nav');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 50); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    // Smooth in-page anchor scrolling. Keyboard focus must still land on the
    // target (a skip link that only scrolls leaves the next Tab in the header).
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var id = a.getAttribute('href');
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (target) {
          ev.preventDefault();
          if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        }
      });
    });
  });
})();
