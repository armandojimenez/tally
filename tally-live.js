// tally-live.js — the live Tally counter on the landing page.
//
// A faithful HTML recreation of the app's counting surface (the same
// recreation the store screenshots shipped), wired for real input:
//   • tap anywhere on the surface → the count fires on pointer-down
//   • iPhone: a native, invisible <input type="checkbox" switch> overlay
//     rides the surface — Safari 17.4+ plays the real Taptic click when a
//     tap toggles it (the durable, user-gesture form of the technique the
//     ios-haptics package uses; no library needed)
//   • Android: navigator.vibrate, scaled by the chosen click intensity
//   • everywhere: a short synthesized click per theme, WebAudio, muteable
//   • intensity is DRAWN, not faked: iOS has exactly one Taptic pattern for a
//     switch toggle, so the Light/Medium/Heavy pills answer with a sonar pulse
//   • the themes band carries a second live surface, so a skin lands in place
//
// Every visual token is verbatim from the recreated design system
// (tally-screenshots/src/lib/appui.js ← design/Tally.dc.html THEMES).
// No analytics, no network: this file talks to nothing.

(function () {
  'use strict';

  var S = (window.TALLY_STRINGS && window.TALLY_STRINGS.phone) || {};
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── the eight skins (appui.js THEMES, verbatim) ──────────────────────────
  var UI_FONT = "'Space Grotesk', system-ui, sans-serif";
  var MONO_FONT = "'Space Mono', ui-monospace, monospace";
  // Port of the app's ScriptRules (lib/l10n/script_rules.dart): cursive and
  // complex-shaping scripts take no tracking at all; CJK never opens up.
  // build.mjs stamps data-track on <html> for the affected locales.
  var TRACK = document.documentElement.getAttribute('data-track') || '';
  function ls(v) { return TRACK === 'none' ? '0' : TRACK === 'cjk' && parseFloat(v) > 0 ? '0' : v; }
  var THEMES = {
    modern: { layout: 'center', button: 'none', deco: 'none', statusDark: true, screenBg: '#F4F3EF',
      bg: '#F4F3EF', num: '#16151A', numFont: "'Space Grotesk'", numWeight: '700', numSize: 170, numSpacing: '-5px', numShadow: 'none',
      chrome: '#16151A', home: 'rgba(0,0,0,0.28)', ctrlBg: 'rgba(0,0,0,0.05)', ctrlFg: '#16151A',
      accent: '#FF5B2E', click: { f: 1700, type: 'triangle' } },
    mono: { layout: 'center', button: 'none', deco: 'none', statusDark: true, screenBg: '#FCFCFB',
      bg: '#FCFCFB', num: '#101010', numFont: "'Space Grotesk'", numWeight: '300', numSize: 200, numSpacing: '-8px', numShadow: 'none',
      chrome: '#101010', home: 'rgba(0,0,0,0.25)', ctrlBg: 'transparent', ctrlFg: '#101010', ctrlBorder: '1.5px solid rgba(0,0,0,0.14)',
      accent: '#101010', click: { f: 1300, type: 'sine' } },
    gradient: { layout: 'center', button: 'glass', deco: 'none', statusDark: false, screenBg: '#7C3AED',
      bg: 'linear-gradient(160deg, #7C3AED 0%, #DB2777 45%, #F97316 100%)', num: '#ffffff', numFont: "'Space Grotesk'", numWeight: '700', numSize: 170, numSpacing: '-5px', numShadow: '0 8px 30px rgba(0,0,0,0.28)',
      chrome: '#ffffff', home: 'rgba(255,255,255,0.85)', ctrlBg: 'rgba(255,255,255,0.18)', ctrlFg: '#ffffff',
      btnBg: 'rgba(255,255,255,0.14)', btnSize: 300, btnRadius: '50%', btnBorder: '1.5px solid rgba(255,255,255,0.4)', btnShadow: '0 20px 60px -20px rgba(0,0,0,0.4), inset 0 2px 20px rgba(255,255,255,0.25)',
      accent: '#ffffff', click: { f: 2000, type: 'triangle' } },
    cute: { layout: 'center', button: 'blob', deco: 'none', statusDark: true, screenBg: '#FFE3F1',
      bg: 'linear-gradient(165deg, #FFE3F1 0%, #EDE7FF 100%)', num: '#ffffff', numFont: "'Baloo 2'", numWeight: '800', numSize: 150, numSpacing: '0px', numShadow: '0 6px 0 rgba(214,102,163,0.35)',
      chrome: '#B5679B', home: 'rgba(181,103,155,0.4)', ctrlBg: 'rgba(255,255,255,0.6)', ctrlFg: '#B5679B',
      btnBg: 'linear-gradient(160deg, #FF9DC8, #FF6FAE)', btnSize: 270, btnRadius: '46% 54% 52% 48% / 54% 46% 54% 46%', btnShadow: '0 18px 40px -10px rgba(255,111,174,0.6)',
      accent: '#FF6FAE', click: { f: 2300, type: 'sine' } },
    retro: { layout: 'device', button: 'plunger', deco: 'sun', statusDark: true, screenBg: '#EFE2C6',
      bg: '#EFE2C6', num: '#3A2A18', numFont: "'Space Mono'", numWeight: '700', numSize: 76, numSpacing: '2px', numShadow: 'none',
      chrome: '#7A5A34', home: 'rgba(122,90,52,0.4)', ctrlBg: 'rgba(122,90,52,0.12)', ctrlFg: '#5B4226',
      devBg: '#241a10', devRadius: '16px', devShadow: 'inset 0 3px 10px rgba(0,0,0,0.7), 0 2px 0 rgba(255,255,255,0.5)', devLabel: '#C89B54',
      btnBg: 'radial-gradient(circle at 38% 32%, #F2C14E, #D9932A 70%, #B4711C)', btnSize: 190, btnRadius: '50%', btnBorder: '7px solid #A9691A', btnShadow: '0 14px 0 #8a5312, 0 18px 24px rgba(0,0,0,0.3)',
      accent: '#C1440E', click: { f: 480, type: 'square' } },
    pixel: { layout: 'device', button: 'chunk', deco: 'scan', statusDark: false, screenBg: '#12131E',
      bg: '#12131E', num: '#8BF13C', numFont: "'Press Start 2P'", numWeight: '400', numSize: 52, numSpacing: '0px', numShadow: '3px 3px 0 #2a6b0f',
      chrome: '#8BF13C', home: 'rgba(139,241,60,0.5)', ctrlBg: 'transparent', ctrlFg: '#8BF13C', ctrlBorder: '3px solid #8BF13C',
      devBg: '#0a0b12', devRadius: '2px', devShadow: 'inset 0 0 0 3px #2a6b0f, inset 0 0 24px rgba(139,241,60,0.15)', devLabel: '#4b9a1e',
      btnBg: '#E23C6B', btnSize: 190, btnRadius: '4px', btnBorder: '5px solid #7c1b39', btnShadow: '10px 10px 0 rgba(0,0,0,0.55)',
      accent: '#8BF13C', click: { f: 660, type: 'square' } },
    gaming: { layout: 'center', button: 'neon', deco: 'grid', statusDark: false, screenBg: '#07060F',
      bg: 'radial-gradient(circle at 50% 30%, #14163A 0%, #07060F 70%)', num: '#00F0FF', numFont: "'Orbitron'", numWeight: '900', numSize: 140, numSpacing: '2px', numShadow: '0 0 12px rgba(0,240,255,0.9), 0 0 40px rgba(0,240,255,0.5)',
      chrome: '#00F0FF', home: 'rgba(0,240,255,0.6)', ctrlBg: 'rgba(0,240,255,0.08)', ctrlFg: '#00F0FF', ctrlBorder: '1.5px solid rgba(0,240,255,0.5)',
      btnBg: 'rgba(255,43,214,0.06)', btnSize: 290, btnRadius: '28px', btnBorder: '2px solid #FF2BD6', btnShadow: '0 0 30px rgba(255,43,214,0.6), inset 0 0 30px rgba(255,43,214,0.25)',
      accent: '#00F0FF', click: { f: 1150, type: 'sawtooth' } },
    art: { layout: 'center', button: 'none', deco: 'art', statusDark: true, screenBg: '#EDE9E0',
      bg: '#EDE9E0', num: '#16151A', numFont: "'Anton'", numWeight: '400', numSize: 250, numSpacing: '-4px', numShadow: 'none',
      chrome: '#16151A', home: 'rgba(0,0,0,0.28)', ctrlBg: '#16151A', ctrlFg: '#EDE9E0',
      accent: '#FF3B14', click: { f: 900, type: 'triangle' } },
  };
  var HINTS = { modern: 'Tap anywhere', gradient: 'Tap to count', cute: 'boop!', gaming: 'PRESS' };
  try { HINTS = Object.assign(HINTS, JSON.parse(document.getElementById('live-phone').dataset.hint || '{}')); } catch (e) {}

  // ── tiny DOM helper (same idiom as the recreation engine) ────────────────
  function el(tag, style, children) {
    var node = document.createElement(tag);
    if (style) for (var k in style) node.style[k] = style[k];
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        node.append(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }
  function svgEl(markup) {
    var t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstChild;
  }

  // Chrome icons — verbatim path data from the design board.
  var menuIcon = function (c) { return svgEl('<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16"/></svg>'); };
  var editIcon = function (c) { return svgEl('<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16l-3.5.5L4 13z"/></svg>'); };
  var undoIcon = function (c) { return svgEl('<svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8.5h9"/></svg>'); };
  var resetIcon = function (c) { return svgEl('<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3"/></svg>'); };
  function statusBarSvg(color) {
    return svgEl('<svg width="78" height="14" viewBox="0 0 78 14" fill="' + color + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="0" y="9" width="3.4" height="5" rx="1"/><rect x="5.4" y="6.5" width="3.4" height="7.5" rx="1"/><rect x="10.8" y="4" width="3.4" height="10" rx="1"/><rect x="16.2" y="1.5" width="3.4" height="12.5" rx="1"/>' +
      '<path d="M33 4.6a10.4 10.4 0 0 1 13.2 0l-1.9 2.2a7.4 7.4 0 0 0-9.4 0L33 4.6Z"/><path d="M35.6 7.6a6.4 6.4 0 0 1 8 0l-1.9 2.2a3.4 3.4 0 0 0-4.2 0l-1.9-2.2Z"/><circle cx="39.6" cy="11.8" r="1.9"/>' +
      '<rect x="55" y="1.5" width="20" height="11" rx="3.5" fill="none" stroke="' + color + '" stroke-opacity="0.45"/><rect x="57" y="3.5" width="16" height="7" rx="1.8"/><path d="M76.5 5.2v3.6c1-.3 1.5-1 1.5-1.8s-.5-1.5-1.5-1.8Z" fill-opacity="0.5"/></svg>');
  }

  // ── feedback: sound + haptics ────────────────────────────────────────────
  var audio = { ctx: null, muted: false };
  // Light / Medium / Heavy. Android really does differ (navigator.vibrate,
  // 6/12/26ms) and so does the click's gain — but iOS cannot: a switch toggle
  // plays exactly ONE Taptic pattern, and every web-haptics library rides that
  // same switch, so no library can grade it. Rather than fake three identical
  // buzzes, the intensity is drawn: a sonar pulse whose reach, ring count,
  // weight and decay carry the difference on every device.
  var LEVEL = {
    gain: [0.05, 0.1, 0.17],
    vibrate: [6, 12, 26],
    sonar: [
      { rings: 1, reach: 124, dur: 620, w: 2, o: 0.62, core: 1.35 },
      { rings: 2, reach: 208, dur: 740, w: 3, o: 0.75, core: 1.75 },
      { rings: 3, reach: 320, dur: 900, w: 4.5, o: 0.9, core: 2.3 },
    ],
  };
  var level = 1; // Light / Medium / Heavy — Medium by default, like the app
  function clickSound(spec, gainMul) {
    if (audio.muted) return;
    try {
      if (!audio.ctx) audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      var ctx = audio.ctx;
      if (ctx.state === 'suspended') ctx.resume();
      var t = ctx.currentTime;
      var g = ctx.createGain();
      var gain = LEVEL.gain[level] * (gainMul || 1);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      g.connect(ctx.destination);
      var osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.f, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(120, spec.f * 0.55), t + 0.045);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 0.05);
      // the 'tick' transient
      var len = Math.floor(ctx.sampleRate * 0.012);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2800;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(gain * 0.8, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
      src.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
      src.start(t);
    } catch (e) { /* audio is a garnish; never let it break counting */ }
  }
  function buzz() {
    if (navigator.vibrate) { try { navigator.vibrate(LEVEL.vibrate[level]); } catch (e) {} }
  }
  // The intensity you can see: rings leave the core and die at a distance the
  // chosen level sets. Heavy overruns the scope on purpose.
  var sonarScope = document.querySelector('[data-sonar]');
  function sonarPulse() {
    if (!sonarScope) return;
    var s = LEVEL.sonar[level];
    var mkRing = function () {
      var ring = el('span', {
        width: s.reach + 'px', height: s.reach + 'px',
        marginLeft: -s.reach / 2 + 'px', marginTop: -s.reach / 2 + 'px',
        borderWidth: s.w + 'px',
      });
      ring.className = 'sonar__ring';
      sonarScope.append(ring);
      return ring;
    };
    if (REDUCED) {
      // Motion off, meaning intact: the scope holds ONE still ring at the
      // chosen level's reach, so the picker still says what it picked.
      sonarScope.querySelectorAll('.sonar__ring').forEach(function (r) { r.remove(); });
      mkRing().style.opacity = String(s.o * 0.8);
      return;
    }
    var mk = function (i) {
      var ring = mkRing();
      // Two animations, on purpose: one easing cannot serve both properties.
      // Sharing the ease-out curve fades the ring to nothing by the time it is
      // a third of the way out — the reach stops reading, which is the whole
      // point of the pulse. The travel keeps the ease; the fade runs linear.
      ring.animate(
        [{ transform: 'scale(0.06)' }, { transform: 'scale(1)' }],
        { duration: s.dur, delay: i * 110, easing: 'cubic-bezier(0.16, 0.7, 0.3, 1)', fill: 'backwards' }
      );
      ring.animate(
        [{ opacity: s.o, offset: 0 }, { opacity: s.o * 0.9, offset: 0.45 }, { opacity: 0, offset: 1 }],
        { duration: s.dur, delay: i * 110, fill: 'backwards' }
      ).onfinish = function () { ring.remove(); };
    };
    for (var i = 0; i < s.rings; i++) mk(i);
    var core = sonarScope.querySelector('.sonar__core');
    if (core) core.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(' + s.core + ')' }, { transform: 'scale(1)' }],
      { duration: Math.round(s.dur * 0.55), easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }
    );
  }
  // iOS Taptic overlay. The thing the finger touches is a LABEL, never the
  // switch itself: a native switch owns its drag gesture on iOS regardless of
  // touch-action, so a full-size switch under the thumb ate every page scroll
  // that started on it. The label is an ordinary element — swipes scroll —
  // and a tap on it toggles the 1px switch parked inside (pointer-events:
  // none, so it can never capture a gesture) through label activation, which
  // is still a genuine user gesture, so Safari still plays the Taptic.
  function hapticOverlay() {
    var label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    var ls_ = label.style;
    ls_.position = 'absolute'; ls_.inset = '0'; ls_.width = '100%'; ls_.height = '100%';
    ls_.opacity = '0'; ls_.margin = '0'; ls_.cursor = 'pointer'; ls_.zIndex = '9';
    ls_.touchAction = 'pan-y'; ls_.webkitTapHighlightColor = 'transparent';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    var st = input.style;
    st.position = 'absolute'; st.width = '1px'; st.height = '1px'; st.opacity = '0';
    st.margin = '0'; st.pointerEvents = 'none'; st.appearance = 'none'; st.webkitAppearance = 'none';
    // Focus stays off the hidden control: cancel the compatibility mousedown
    // (never pointerdown — iOS reads that as a canceled touchstart and stops
    // scrolling), and blur as the fallback for label-forwarded focus.
    label.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    input.addEventListener('focus', function () { input.blur(); });
    label.appendChild(input);
    return label;
  }

  // Small controls get the same Taptic treatment as the surface: an invisible
  // switch riding the button, toggled by the user's own tap. Touch devices
  // only — a mouse gets the button's hover/active states instead, and cannot
  // feel a haptic anyway. The button's own click handler still does the work
  // (the switch forwards it), so keyboard and desktop paths are unchanged.
  var COARSE = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function addTapHaptic(btn) {
    if (!COARSE || !btn) return;
    var parent = btn.parentNode;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    var sw = hapticOverlay();
    sw.style.zIndex = '3';
    function place() {
      sw.style.inset = 'auto';
      sw.style.left = btn.offsetLeft + 'px';
      sw.style.top = btn.offsetTop + 'px';
      sw.style.width = btn.offsetWidth + 'px';
      sw.style.height = btn.offsetHeight + 'px';
    }
    place();
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(btn);
    // A label click re-dispatches on the inner switch and bubbles back up;
    // forward only the original label hit or the button would fire twice.
    sw.addEventListener('click', function (ev) { if (ev.target !== sw) return; btn.click(); });
    parent.appendChild(sw);
  }

  // ── the phone ────────────────────────────────────────────────────────────
  var mount = document.getElementById('live-phone');
  if (!mount) return;
  var state = { count: 0, theme: 'modern' };
  var refs = {};            // the hero phone
  var stageMount = document.querySelector('[data-stage]');
  var stage = stageMount ? {} : null;  // the themes-band preview screen

  var digitScale = function (count) {
    var d = String(count).length;
    return d >= 6 ? 0.5 : d >= 5 ? 0.62 : d >= 4 ? 0.78 : 1;
  };

  // deco layers (verbatim recipes) — the hero phone and the stage wear the same
  function addDeco(v, root) {
    if (v.deco === 'scan') root.append(el('div', { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1', background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 2px, transparent 4px)', opacity: '0.5' }));
    if (v.deco === 'grid') root.append(
      el('div', { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1', background: 'linear-gradient(rgba(0,240,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,43,214,0.07) 1px, transparent 1px)', backgroundSize: '34px 34px' }),
      el('div', { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1', background: 'radial-gradient(circle at 50% 42%, rgba(0,240,255,0.14), transparent 60%)' })
    );
    if (v.deco === 'sun') root.append(el('div', { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1', background: 'repeating-conic-gradient(from 0deg at 50% 40%, rgba(193,68,14,0.06) 0deg 12deg, transparent 12deg 24deg)' }));
    if (v.deco === 'art') root.append(el('div', { position: 'absolute', left: '0', right: '0', bottom: '0', height: '40%', background: '#FF3B14', zIndex: '1' }));
  }

  // The counting surface itself — number, button face, hint, tap layer and the
  // Taptic overlay. Both live surfaces build from this one recipe: the hero
  // wears it inside the full phone, the themes stage crops the screen to it.
  function paintSurface(v, target) {
    var surface = el('div', { position: 'relative', zIndex: '4', flex: '1', minHeight: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' });
    target.surface = surface;

    if (v.button !== 'none') {
      var face = el('div', { width: v.btnSize + 'px', height: v.btnSize + 'px', background: v.btnBg, borderRadius: v.btnRadius, boxShadow: v.btnShadow || 'none', border: v.btnBorder || 'none', transition: REDUCED ? 'none' : 'transform 0.09s ease' });
      target.face = face;
      surface.append(el('div', { position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }, face));
    } else { target.face = null; }

    var num = el('span', {
      fontFamily: v.numFont + ', ' + UI_FONT, fontWeight: v.numWeight, fontSize: v.numSize + 'px',
      color: v.num, letterSpacing: v.numSpacing, textShadow: v.numShadow, lineHeight: '1', display: 'inline-block',
      fontVariantNumeric: 'tabular-nums',
    }, String(state.count));
    target.num = num;

    var hintText = HINTS[state.theme] || '';
    var hint = hintText
      ? el('div', { fontFamily: UI_FONT, fontSize: '15px', fontWeight: '600', color: v.chrome, opacity: '0.5', marginTop: '14px', letterSpacing: ls('0.3px'), textAlign: 'center' }, hintText)
      : null;

    if (v.layout === 'device') {
      var winLabel = state.theme === 'retro' ? (S.push || 'push') : (S.score || 'score');
      surface.append(
        el('div', { position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', width: '74%', padding: '18px 20px', borderRadius: v.devRadius, background: v.devBg, boxShadow: v.devShadow || 'none', textAlign: 'center', zIndex: '2' }, [
          el('div', { fontFamily: MONO_FONT, fontSize: '10px', letterSpacing: ls('3px'), color: v.devLabel, textTransform: 'uppercase', marginBottom: '8px' }, winLabel),
          el('div', {}, num),
        ])
      );
    } else {
      var stack = el('div', { position: 'relative', zIndex: '2', display: 'flex', flexDirection: 'column', alignItems: 'center' }, [num]);
      if (hint) stack.append(hint);
      surface.append(stack);
    }

    // Taptic overlay + a keyboard-reachable tap layer
    var tapBtn = document.createElement('button');
    tapBtn.type = 'button';
    tapBtn.setAttribute('aria-label', (S.tapLabel || 'Add one') + '. ' + (S.countLabel || 'Current count') + ' ' + state.count);
    Object.assign(tapBtn.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', background: 'transparent', border: '0', padding: '0', zIndex: '8', touchAction: 'pan-y', webkitTapHighlightColor: 'transparent', cursor: 'pointer', borderRadius: '0' });
    target.tapBtn = tapBtn;
    surface.append(tapBtn, hapticOverlay());
    return surface;
  }

  // The themes-band stage: the same screen, cropped to the part that counts, so
  // picking a skin pays off under the reader's thumb instead of up at the hero.
  function buildStage() {
    if (!stage) return;
    var v = THEMES[state.theme];
    stageMount.textContent = '';
    var logical = el('div', {
      position: 'absolute', left: '0', top: '0', width: '440px', height: '420px',
      transform: 'scale(var(--ts, 0.55))', transformOrigin: 'top left', overflow: 'hidden',
      webkitUserSelect: 'none', userSelect: 'none', webkitTapHighlightColor: 'transparent',
    });
    var root = el('div', { position: 'absolute', inset: '0', background: v.bg, backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' });
    addDeco(v, root);
    root.append(paintSurface(v, stage));
    logical.append(root);
    stageMount.append(logical);
    stageMount.style.background = v.screenBg;
    if (!REDUCED) logical.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }

  function buildPhone() {
    var v = THEMES[state.theme];
    mount.textContent = '';

    var frame = el('div', null); frame.className = 'phone__frame';
    var screen = el('div', null); screen.className = 'phone__screen';
    screen.style.background = v.screenBg;
    var logical = el('div', null); logical.className = 'phone__logical';
    logical.style.webkitTouchCallout = 'none';

    var root = el('div', { position: 'absolute', inset: '0', background: v.bg, backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' });
    addDeco(v, root);

    // iOS status bar, 11:11
    var sColor = v.statusDark ? '#0A0A0A' : '#FFFFFF';
    var sBar = el('div', { position: 'absolute', top: '0', left: '0', right: '0', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 40px 0 46px', zIndex: '30', pointerEvents: 'none' });
    sBar.append(el('div', { fontFamily: UI_FONT, fontWeight: '600', fontSize: '17px', letterSpacing: '0.2px', color: sColor }, '11:11'), statusBarSvg(sColor));
    root.append(sBar);

    // top bar: menu · name · edit
    var bar = el('div', { position: 'relative', zIndex: '5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', height: '50px', marginTop: '58px' });
    bar.append(
      el('div', { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, menuIcon(v.chrome)),
      el('div', { fontFamily: UI_FONT, fontSize: '15px', fontWeight: '600', color: v.chrome, letterSpacing: ls('0.2px'), opacity: '0.85' }, S.counterName || 'Reps'),
      el('div', { width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }, editIcon(v.chrome))
    );
    root.append(bar);

    root.append(paintSurface(v, refs));

    // Undo · Reset — real controls
    var pill = function (label, icon, handler, key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'live-pill';
      Object.assign(b.style, {
        height: '46px', padding: '0 20px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '7px',
        background: v.ctrlBg, color: v.ctrlFg, fontFamily: UI_FONT, fontSize: '15px', fontWeight: '600',
        border: v.ctrlBorder || 'none', flexShrink: '0', cursor: 'pointer', touchAction: 'manipulation', webkitTapHighlightColor: 'transparent',
      });
      b.append(icon === 'undo' ? undoIcon(v.ctrlFg) : resetIcon(v.ctrlFg), document.createTextNode(label));
      b.addEventListener('click', handler);
      b.setAttribute('data-live', key);
      return b;
    };
    var controls = el('div', { position: 'relative', zIndex: '6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', paddingBottom: '40px', height: '104px', flexShrink: '0' }, [
      pill(S.undo || 'Undo', 'undo', onUndo, 'undo'),
      pill(S.reset || 'Reset', 'reset', onReset, 'reset'),
    ]);
    root.append(controls);

    // home indicator
    root.append(el('div', { position: 'absolute', left: '50%', bottom: '9px', transform: 'translateX(-50%)', width: '134px', height: '5px', borderRadius: '3px', background: v.home, zIndex: '20' }));

    logical.append(root);
    screen.append(logical);
    frame.append(screen);
    mount.append(frame);

    // sound toggle, floating on the bezel corner
    var snd = document.createElement('button');
    snd.type = 'button';
    snd.className = 'sound-chip';
    snd.setAttribute('aria-pressed', String(!audio.muted));
    snd.setAttribute('aria-label', audio.muted ? (S.soundOff || 'Click sound off') : (S.soundOn || 'Click sound on'));
    Object.assign(snd.style, {
      position: 'absolute', right: '-8px', bottom: '34px', width: '44px', height: '44px', borderRadius: '50%',
      border: '0', background: '#16151A', color: '#FBFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 12px 26px -10px rgba(22,21,26,0.5)', cursor: 'pointer', zIndex: '12',
    });
    refs.sound = snd;
    drawSoundIcon();
    snd.addEventListener('click', function () {
      audio.muted = !audio.muted;
      snd.setAttribute('aria-pressed', String(!audio.muted));
      snd.setAttribute('aria-label', audio.muted ? (S.soundOff || 'Click sound off') : (S.soundOn || 'Click sound on'));
      drawSoundIcon();
      if (!audio.muted) clickSound(THEMES[state.theme].click, 1);
    });
    mount.append(snd);

    applyDigitScale(refs, false);
  }

  function drawSoundIcon() {
    refs.sound.textContent = '';
    var on = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="currentColor" stroke="none"/><path d="M15 9a4.2 4.2 0 0 1 0 6"/><path d="M17.6 6.4a8 8 0 0 1 0 11.2"/></svg>';
    var off = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="currentColor" stroke="none"/><path d="M15 9.5l6 5M21 9.5l-6 5"/></svg>';
    refs.sound.append(svgEl(audio.muted ? off : on));
  }

  function applyDigitScale(target, pop) {
    var base = digitScale(state.count);
    if (REDUCED || !pop) {
      target.num.style.transform = base === 1 ? 'none' : 'scale(' + base + ')';
      return;
    }
    target.num.animate(
      [{ transform: 'scale(' + base * 1.09 + ')' }, { transform: base === 1 ? 'scale(1)' : 'scale(' + base + ')' }],
      { duration: 190, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' }
    );
    target.num.style.transform = base === 1 ? 'none' : 'scale(' + base + ')';
  }

  var announceTimer = null;
  function paintCount(target, pop) {
    if (!target || !target.num) return;
    target.num.textContent = String(state.count);
    applyDigitScale(target, pop);
    target.tapBtn.setAttribute('aria-label', (S.tapLabel || 'Add one') + '. ' + (S.countLabel || 'Current count') + ' ' + state.count);
  }
  function render(pop) {
    // one count, two windows onto it — the hero phone and the themes stage
    paintCount(refs, pop);
    paintCount(stage, pop);
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = setTimeout(function () { live.textContent = (S.countLabel || 'Current count') + ' ' + state.count; }, 420);
  }

  // tap effects, in the app's own visual language
  function spawnEffects(target, xPct, yPct, text) {
    if (REDUCED) return;
    var v = THEMES[state.theme];
    var mk = function (size, borderW, opacity) {
      var d = el('div', {
        position: 'absolute', left: xPct + '%', top: yPct + '%', width: size + 'px', height: size + 'px',
        marginLeft: -size / 2 + 'px', marginTop: -size / 2 + 'px', borderRadius: '50%',
        border: borderW + 'px solid ' + v.accent, opacity: String(opacity), zIndex: '3', pointerEvents: 'none',
      });
      target.surface.append(d);
      d.animate([{ transform: 'scale(0.35)', opacity: opacity }, { transform: 'scale(1)', opacity: 0 }], { duration: 480, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }).onfinish = function () { d.remove(); };
    };
    mk(268, 3, 0.34); mk(172, 4, 0.5);
    var dot = el('div', { position: 'absolute', left: xPct + '%', top: yPct + '%', width: '62px', height: '62px', marginLeft: '-31px', marginTop: '-31px', borderRadius: '50%', background: v.accent, opacity: '0.34', zIndex: '3', pointerEvents: 'none' });
    target.surface.append(dot);
    dot.animate([{ opacity: 0.34 }, { opacity: 0 }], { duration: 340 }).onfinish = function () { dot.remove(); };
    // sparks
    for (var i = 0; i < 3; i++) {
      var sz = 10 + Math.round(Math.random() * 10);
      var sp = el('div', { position: 'absolute', left: xPct + '%', top: yPct + '%', width: sz + 'px', height: sz + 'px', borderRadius: '2px', background: v.accent, zIndex: '3', pointerEvents: 'none', transform: 'rotate(45deg)' });
      target.surface.append(sp);
      var a = (i / 3) * Math.PI * 2 + Math.random();
      sp.animate(
        [{ transform: 'translate(0,0) rotate(45deg)', opacity: 0.9 }, { transform: 'translate(' + Math.cos(a) * 74 + 'px,' + (Math.sin(a) * 74 - 30) + 'px) rotate(140deg)', opacity: 0 }],
        { duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' }
      ).onfinish = function () { this.effect.target.remove(); };
    }
    // the floating chip (+1 / −1)
    var chip = el('div', {
      position: 'absolute', left: xPct + '%', top: yPct + '%', zIndex: '5', pointerEvents: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '76px', height: '48px', padding: '0 18px',
      borderRadius: '999px', background: '#16151A', color: '#fff', fontFamily: UI_FONT, fontWeight: '700', fontSize: '26px',
      letterSpacing: '-1px', boxShadow: '0 18px 40px -12px rgba(0,0,0,0.35)', whiteSpace: 'nowrap',
      transform: 'translate(-50%, -130%) rotate(-6deg)',
    }, text);
    target.surface.append(chip);
    chip.animate(
      [{ transform: 'translate(-50%, -130%) rotate(-6deg)', opacity: 1 }, { transform: 'translate(-50%, -210%) rotate(-4deg)', opacity: 0 }],
      { duration: 620, easing: 'cubic-bezier(0.2, 0.6, 0.3, 1)' }
    ).onfinish = function () { chip.remove(); };
  }

  function pressFace(target, down) {
    if (!target.face || REDUCED) return;
    target.face.style.transform = down ? (state.theme === 'cute' ? 'scale(1.06, 0.9)' : 'scale(0.95)') : 'none';
  }

  function addOne(target, xPct, yPct) {
    state.count += 1;
    render(true);
    spawnEffects(target, xPct, yPct, '+1');
    clickSound(THEMES[state.theme].click, 1);
    buzz();
  }
  function onUndo(ev) {
    ev.stopPropagation();
    if (state.count > 0) {
      state.count -= 1;
      render(true);
      spawnEffects(refs, 50, 42, '−1');
      clickSound(THEMES[state.theme].click, 0.7);
      buzz();
    }
  }
  function onReset(ev) {
    ev.stopPropagation();
    state.count = 0;
    render(true);
    clickSound(THEMES[state.theme].click, 0.7);
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  var live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  Object.assign(live.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' });
  document.body.append(live);

  buildPhone();
  buildStage();
  render(false);

  // A mouse counts on pointer-down, like the app. A FINGER counts on lift:
  // the page underneath scrolls, so a touch is only a tap once it ends
  // without moving — counting at down showed a 1→0 flicker on every scroll
  // (count, then the pointercancel revert). Committing at up keeps scrolls
  // off the number entirely, and lines the count up with the iOS Taptic,
  // which the switch overlay plays at lift anyway.
  // Listeners ride the container, never the rebuilt children: a theme change
  // replaces the whole tree, and target.* is read fresh on every event.
  function wireTaps(container, target) {
    var touchPointer = null;
    var touchX = 0;
    var touchY = 0;
    function onSurface(ev) {
      var r = target.surface.getBoundingClientRect();
      if (ev.clientY < r.top || ev.clientY > r.bottom || ev.clientX < r.left || ev.clientX > r.right) return null;
      return r;
    }
    container.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('[data-live], .sound-chip')) return;
      var r = onSurface(ev);
      if (!r) return;
      pressFace(target, true);
      if (ev.pointerType === 'mouse') {
        addOne(target, ((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100);
        return;
      }
      touchPointer = ev.pointerId;
      touchX = ev.clientX;
      touchY = ev.clientY;
    });
    container.addEventListener('pointerup', function (ev) {
      pressFace(target, false);
      if (touchPointer === null || ev.pointerId !== touchPointer) return;
      touchPointer = null;
      if (Math.hypot(ev.clientX - touchX, ev.clientY - touchY) > 12) return;
      var r = onSurface(ev);
      if (r) addOne(target, ((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100);
    });
    container.addEventListener('pointerleave', function () { pressFace(target, false); });
    container.addEventListener('pointercancel', function () { touchPointer = null; pressFace(target, false); });
    // keyboard activation of the tap layer (click with no pointer coords)
    container.addEventListener('click', function (ev) {
      if (ev.target === target.tapBtn && ev.detail === 0) addOne(target, 50, 46);
    });
  }
  wireTaps(mount, refs);
  if (stage) wireTaps(stageMount, stage);

  // fit each surface to its container
  if ('ResizeObserver' in window) {
    new ResizeObserver(function (entries) {
      var w = entries[0].contentRect.width;
      // cap: never above the design scale; never wider than the column
      if (w > 0) mount.style.setProperty('--s', Math.min(0.82, w / 492).toFixed(4));
    }).observe(mount.parentElement);
    if (stage) new ResizeObserver(function (entries) {
      var w = entries[0].contentRect.width;
      if (w > 0) stageMount.style.setProperty('--ts', (w / 440).toFixed(4));
    }).observe(stageMount);
  }

  // ── theme minis ──────────────────────────────────────────────────────────
  var minis = document.querySelectorAll('[data-minis] .mini');
  function markMini() {
    minis.forEach(function (m) {
      var on = m.dataset.theme === state.theme;
      m.classList.toggle('is-on', on);
      m.setAttribute('aria-pressed', String(on));
    });
  }
  minis.forEach(function (m) {
    m.addEventListener('click', function () {
      state.theme = m.dataset.theme;
      buildPhone();
      // The stage stands right next to the tiles, so the skin lands where the
      // reader is looking — picking a theme no longer yanks them to the hero.
      buildStage();
      render(false);
      markMini();
      clickSound(THEMES[state.theme].click, 1);
      buzz();
    });
  });
  markMini();

  // ── intensity panel (Light / Medium / Heavy) ─────────────────────────────
  var ipanel = document.querySelector('[data-intensity]');
  if (ipanel) {
    ipanel.querySelectorAll('.intensity__opt').forEach(function (b) {
      b.addEventListener('click', function () {
        level = Number(b.dataset.level);
        ipanel.querySelectorAll('.intensity__opt').forEach(function (x) {
          x.classList.toggle('is-on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        clickSound(THEMES[state.theme].click, 1);
        buzz();
        sonarPulse();
      });
      // No Taptic overlay here on purpose: iOS plays one fixed pattern for a
      // switch toggle, so all three levels felt identical on an iPhone. The
      // pulse shows what the phone cannot say; Android still buzzes for real.
    });
    if (REDUCED) sonarPulse(); // the still ring for the default level
  }

  // ── multi cards: tap a plus to count that row ────────────────────────────
  document.querySelectorAll('[data-multi] .mcard').forEach(function (card) {
    var num = card.querySelector('[data-mcount]');
    var plus = card.querySelector('.mcard__plus');
    plus.addEventListener('click', function () {
      num.textContent = String(Number(num.textContent) + 1);
      if (!REDUCED) {
        num.classList.remove('pop');
        void num.offsetWidth;
        num.classList.add('pop');
      }
      clickSound(THEMES.modern.click, 0.9);
      buzz();
    });
    addTapHaptic(plus);
  });

  // ── customize sheet: live recolor ────────────────────────────────────────
  var cz = document.querySelector('[data-customize]');
  if (cz) {
    var target = { btn: cz.querySelector('[data-cz-btn]'), num: cz.querySelector('[data-cz-num]'), bg: cz.querySelector('[data-cz-preview]') };
    function applySwatch(sw, silent) {
      var kind = sw.dataset.sw;
      if (kind === 'num') target.num.style.color = sw.dataset.hex;
      else target[kind].style.background = sw.dataset.hex;
      cz.querySelectorAll('.cz__sw[data-sw="' + kind + '"]').forEach(function (x) {
        x.classList.toggle('is-on', x === sw);
        x.setAttribute('aria-pressed', String(x === sw));
      });
      if (silent) return;
      if (!REDUCED) {
        target.num.classList.remove('pop');
        void target.num.offsetWidth;
        target.num.classList.add('pop');
      }
      clickSound(THEMES.modern.click, 0.9);
      buzz();
    }
    cz.querySelectorAll('.cz__sw').forEach(function (sw) {
      sw.addEventListener('click', function () { applySwatch(sw, false); });
    });
    var czReset = cz.querySelector('[data-cz-reset]');
    if (czReset) {
      czReset.addEventListener('click', function () {
        var defaults = { btn: '#E23C6B', num: '#00F0FF', bg: '#0B1020' };
        for (var kind in defaults) {
          var sw = cz.querySelector('.cz__sw[data-sw="' + kind + '"][data-hex="' + defaults[kind] + '"]');
          if (sw) applySwatch(sw, true);
        }
        if (!REDUCED) {
          target.num.classList.remove('pop');
          void target.num.offsetWidth;
          target.num.classList.add('pop');
        }
        clickSound(THEMES.modern.click, 0.7);
      });
    }
  }
})();
