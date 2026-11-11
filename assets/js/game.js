/*!
 * RED vs BLACK · Card Challenge — game controller
 * Automatic, continuously running round engine with premium animations.
 *
 * Round timeline (T = interval):
 *   reveal (flip) -> 1.5s gap -> countdown T: result shown, card collected,
 *   deck shuffled (T-4.4s), card dealt (T-1.8s), countdown hits 0 -> reveal ...
 * All timing is based on absolute timestamps, so the countdown stays accurate
 * even when timers are throttled, the tab is hidden, or the page is reloaded.
 */
(function (root) {
  'use strict';

  var doc = root.document;
  var E = root.RVBEngine, Cards = root.RVBCards, SoundManager = root.RVBSoundManager;

  var IMG = 'assets/img/', AUD = 'assets/audio/';
  var DEFAULT_ASSETS = {
    img: {
      bg: IMG + 'bg-casino.jpg', filigree: IMG + 'card-filigree.jpg', damask: IMG + 'damask.jpg',
      cardback: IMG + 'card-back-overlay.svg', crown: IMG + 'crown.svg', heart: IMG + 'heart-glossy.svg', spade: IMG + 'spade-glossy.svg',
      'suit-heart': IMG + 'suit-heart.svg', 'suit-diamond': IMG + 'suit-diamond.svg', 'suit-spade': IMG + 'suit-spade.svg', 'suit-club': IMG + 'suit-club.svg',
      platform: IMG + 'platform.svg', chips: IMG + 'chips-left.svg', panel: IMG + 'panel-frame.svg', timer: IMG + 'timer-frame.svg', ornament: IMG + 'ornament.svg'
    },
    audio: {
      flip: AUD + 'flip.wav', deal: AUD + 'deal.wav', shuffle: AUD + 'shuffle.wav', tick: AUD + 'tick.wav',
      chimeRed: AUD + 'chime-red.wav', chimeBlack: AUD + 'chime-black.wav'
    }
  };
  var KEYS = { state: 'rvb.state.v1', settings: 'rvb.settings.v1', lock: 'rvb.lock.v1' };
  var TM = { FLIP: 900, GAP: 1500, COLLECT: 700, SHUFFLE_LEAD: 4400, SHUFFLE: 2400, DEAL_LEAD: 1800, DEAL: 800, LOCK_TTL: 4500, TICK: 100 };
  var DEFAULT_SETTINGS = { sound: true, music: false, sfxVol: 0.8, musicVol: 0.4, quality: 'high' };
  var QUALITY = ['low', 'medium', 'high'];
  var ICON_FS_IN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var ICON_FS_OUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

  var started = false, opts = {}, assets = null, dom = {}, state = null, settings = null, sound = null;
  var instanceId = 'i' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var isLeader = true, storageOK = true, lastBeat = 0, tickHandle = 0, idleTimer = 0, wakeLock = null;
  var cues = { key: '', collect: false, shuffle: false, deal: false, sec: -1 };
  var timers = [];
  var shown = { red: -1, black: -1, round: -1, hist: null, histTop: '', plaque: '', bar: '' };
  var saveSettingsTimer = 0;

  // ------------------------------------------------------------------ helpers
  function noop() {}
  function $(id) { return doc.getElementById(id); }
  function clamp01(v) { v = Number(v); return !(v > 0) ? 0 : v > 1 ? 1 : v; }
  function num01(v, d) { v = Number(v); return isFinite(v) && v >= 0 && v <= 1 ? v : d; }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function pct(a, t) { return t ? (a / t * 100).toFixed(1) + '%' : '0%'; }
  function setText(el, t) { if (el && el.textContent !== t) el.textContent = t; }
  function later(fn, ms) {
    var h = setTimeout(function () { var i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); fn(); }, ms);
    timers.push(h);
    return h;
  }
  function clearLater() { for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers.length = 0; }
  function anim(el, frames, o) {
    if (!el || typeof el.animate !== 'function') return null;
    try { return el.animate(frames, o); } catch (e) { return null; }
  }
  function cancelAnims(el) {
    if (el && typeof el.getAnimations === 'function') {
      el.getAnimations().forEach(function (a) { try { a.cancel(); } catch (e) { /* ignore */ } });
    }
  }
  function merge(base, extra) {
    var out = { img: {}, audio: {} }, k;
    for (k in base.img) out.img[k] = base.img[k];
    for (k in base.audio) out.audio[k] = base.audio[k];
    if (extra) {
      if (extra.img) for (k in extra.img) if (extra.img[k]) out.img[k] = extra.img[k];
      if (extra.audio) for (k in extra.audio) if (extra.audio[k]) out.audio[k] = extra.audio[k];
    }
    return out;
  }

  // ------------------------------------------------------------------ storage
  function testStorage() {
    try { var k = '__rvb_probe__'; root.localStorage.setItem(k, '1'); root.localStorage.removeItem(k); return true; } catch (e) { return false; }
  }
  function readJSON(key) {
    if (!storageOK) return null;
    try { var v = root.localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function writeJSON(key, val) {
    if (!storageOK) return;
    try { root.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota / privacy mode */ }
  }
  function readState() { return E.restoreState(readJSON(KEYS.state), Date.now()); }
  function saveState() { writeJSON(KEYS.state, state); }
  function loadSettings() {
    var s = readJSON(KEYS.settings) || {};
    return {
      sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
      music: false,
      sfxVol: num01(s.sfxVol, DEFAULT_SETTINGS.sfxVol),
      musicVol: num01(s.musicVol, DEFAULT_SETTINGS.musicVol),
      quality: QUALITY.indexOf(s.quality) >= 0 ? s.quality : DEFAULT_SETTINGS.quality
    };
  }
  function saveSettings() { writeJSON(KEYS.settings, settings); }
  function saveSettingsSoon() { clearTimeout(saveSettingsTimer); saveSettingsTimer = setTimeout(saveSettings, 300); }

  // ------------------------------------------------------------------ multi-tab leader election
  // Only one open instance (the leader) deals cards; others mirror its state.
  function heartbeat(now) {
    if (!storageOK) { isLeader = true; return; }
    var lock = readJSON(KEYS.lock);
    if (!lock || lock.id === instanceId || now - (lock.t || 0) > TM.LOCK_TTL) {
      var was = isLeader;
      writeJSON(KEYS.lock, { id: instanceId, t: now });
      isLeader = true;
      if (!was) {
        var latest = readState();
        if (latest) { state = latest; syncVisuals(); }
      }
    } else if (isLeader) {
      isLeader = false;
      updatePanelUI();
    }
  }
  function releaseLock() {
    if (!storageOK || !isLeader) return;
    try {
      var lock = readJSON(KEYS.lock);
      if (lock && lock.id === instanceId) root.localStorage.removeItem(KEYS.lock);
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ timeline
  function Tms() { return state.interval * 1000; }
  function holdMs() { return Math.max(2500, Math.min(6000, Tms() * 0.3)); }
  function nowFor() { return state.paused ? state.pausedAt : Date.now(); }
  function cueKey() { return state.gen + ':' + state.round; }
  function phaseAt(now) {
    if (now < state.cs) return 'gap';
    var e = now - state.cs, r = state.endsAt - now;
    if (e < holdMs()) return 'result';
    if (r > TM.SHUFFLE_LEAD) return 'idle';
    if (r > TM.DEAL_LEAD) return 'shuffle';
    return 'dealt';
  }
  function resetCues() { cues.key = cueKey(); cues.collect = cues.shuffle = cues.deal = false; cues.sec = -1; }
  function syncCues(now) {
    var after = now >= state.cs, e = now - state.cs, r = state.endsAt - now;
    cues.key = cueKey();
    cues.collect = after && e >= holdMs();
    cues.shuffle = after && r <= TM.SHUFFLE_LEAD;
    cues.deal = after && r <= TM.DEAL_LEAD;
    cues.sec = after ? Math.max(0, Math.ceil(r / 1000)) : -2;
  }

  function tick() {
    var now = Date.now();
    if (now - lastBeat >= 1000) { lastBeat = now; heartbeat(now); }
    if (!state || state.paused) return;
    if (state.endsAt - now > Tms() + TM.GAP + 5000) {        // system clock jumped backwards
      state.cs = now; state.endsAt = now + Tms();
      if (isLeader) saveState();
      syncVisuals();
      return;
    }
    if (cues.key !== cueKey()) resetCues();
    var visible = !doc.hidden;
    if (now < state.cs) {
      if (cues.sec !== -2) { cues.sec = -2; renderTimer(now); }
      return;
    }
    var e = now - state.cs, r = state.endsAt - now;
    if (!cues.collect && e >= holdMs()) { cues.collect = true; if (visible) animCollect(); }
    if (!cues.shuffle && r <= TM.SHUFFLE_LEAD) { cues.shuffle = true; if (visible) animShuffle(); }
    if (!cues.deal && r <= TM.DEAL_LEAD) { cues.deal = true; if (visible) animDeal(); }
    var sec = Math.max(0, Math.ceil(r / 1000));
    if (sec !== cues.sec) {
      cues.sec = sec;
      renderTimer(now);
      if (visible && sec >= 1 && sec <= 3) { sound.play('tick', 0.6); pulseDigits(); }
    }
    if (r <= 0 && isLeader) commitRound(now);
  }

  function commitRound(now) {
    var latest = readState();
    if (latest && (latest.gen !== state.gen || latest.round > state.round)) { state = latest; syncVisuals(); return; }
    var revealAt = now - state.endsAt < 1500 ? state.endsAt : now;    // keep the schedule drift-free
    var res = E.dealRound(state, revealAt, TM.GAP);
    saveState();
    resetCues();
    if (!doc.hidden) animReveal(res.entry);
    updatePanelUI();
  }

  // ------------------------------------------------------------------ rendering
  function pulseDigits() {
    anim(dom.digits, [{ transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)' });
  }
  function fmtClock(sec) { return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60); }
  function setBar(v, dur, ease) {
    var el = dom.progress;
    if (!dur) {
      el.style.transition = 'none';
      el.style.transform = 'scaleX(' + clamp01(v).toFixed(4) + ')';
      void el.offsetWidth; // commit the start value
    } else {
      el.style.transition = 'transform ' + Math.round(dur) + 'ms ' + (ease || 'linear');
      el.style.transform = 'scaleX(' + clamp01(v).toFixed(4) + ')';
    }
  }
  function renderTimer(now, hard) {
    var inGap = now < state.cs, r = state.endsAt - now, label, sec;
    if (state.paused) { label = 'PAUSED'; sec = Math.max(0, Math.ceil(r / 1000)); }
    else if (inGap) { label = 'REVEALING'; sec = 0; }
    else { label = 'NEXT CARD IN'; sec = Math.max(0, Math.ceil(r / 1000)); }
    setText(dom.timerLabel, label);
    setText(dom.digits, fmtClock(sec));
    dom.timer.classList.toggle('is-final', !state.paused && !inGap && sec <= 3);
    // Progress bar: one CSS transition per round (GPU-composited, no per-frame JS)
    var key;
    if (state.paused) {
      key = 'p' + state.pausedAt;
      if (hard || shown.bar !== key) { shown.bar = key; setBar(r / Tms(), 0); }
    } else if (inGap) {
      key = 'g' + cueKey();
      if (hard || shown.bar !== key) { shown.bar = key; setBar(1, Math.max(200, state.cs - now), 'ease-in-out'); }
    } else {
      key = 'c' + cueKey() + ':' + state.endsAt;
      if (hard || shown.bar !== key) { shown.bar = key; setBar(r / Tms(), 0); setBar(0, Math.max(0, r)); }
    }
  }
  function setNum(el, n, bump) {
    var t = fmt(n);
    setText(el, t);
    el.style.fontSize = t.length > 7 ? '36px' : t.length > 5 ? '44px' : t.length > 4 ? '50px' : '';
    if (bump) anim(el, [{ transform: 'scale(1.32)', color: '#ffe08a' }, { transform: 'scale(1)', color: '#ffffff' }], { duration: 750, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  }
  function renderStats(animated) {
    var bR = animated && shown.red >= 0 && state.red > shown.red;
    var bB = animated && shown.black >= 0 && state.black > shown.black;
    if (shown.red !== state.red) { setNum(dom.redCount, state.red, bR); shown.red = state.red; }
    if (shown.black !== state.black) { setNum(dom.blackCount, state.black, bB); shown.black = state.black; }
    var tot = state.red + state.black;
    dom.ratio.style.width = (tot ? state.red / tot * 100 : 50).toFixed(2) + '%';
  }
  function renderHistory(animated) {
    var items = state.history.slice(0, 6);
    var sig = items.map(function (x) { return x.r + x.c; }).join('|');
    if (sig === shown.hist) return;
    var prevTop = shown.histTop;
    shown.hist = sig;
    shown.histTop = items[0] ? items[0].r + items[0].c : '';
    var html = '';
    for (var i = 0; i < 6; i++) {
      var it = items[i];
      if (it) {
        var c = E.parseCard(it.c);
        html += '<div class="rvb-chip c-' + c.color + (i === 0 ? ' is-new' : '') + '" title="Round ' + it.r + ' · ' + c.name + '"><i class="s-' + c.suit + '"></i></div>';
      } else {
        html += '<div class="rvb-chip is-empty"><i></i></div>';
      }
    }
    dom.recent.innerHTML = html;
    if (animated && items.length && shown.histTop !== prevTop) {
      var chips = dom.recent.children;
      anim(chips[0], [
        { transform: 'scale(0) rotate(-120deg)', opacity: 0 },
        { transform: 'scale(1.2) rotate(10deg)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1) rotate(0deg)', opacity: 1 }
      ], { duration: 700, easing: 'cubic-bezier(.2,.8,.3,1)' });
      for (var j = 1; j < chips.length; j++) {
        anim(chips[j], [{ transform: 'translateX(-78px)' }, { transform: 'translateX(0)' }], { duration: 560, easing: 'cubic-bezier(.3,.8,.3,1)' });
      }
    }
  }
  function renderRound(n, animate) {
    if (shown.round === n) return;
    shown.round = n;
    var t = fmt(n);
    dom.round.textContent = t;
    dom.round.parentNode.style.fontSize = t.length > 7 ? '30px' : t.length > 5 ? '38px' : '';
    if (animate) anim(dom.round, [{ transform: 'translateY(20px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
  }
  function deckInfo() { return 'DECK ' + state.deckNo + ' · CARD ' + (state.pos + 1) + ' / 52'; }
  function setPlaque(text, mode) {
    var key = text + '|' + mode;
    if (shown.plaque === key) return;
    shown.plaque = key;
    dom.plaqueText.textContent = text;
    dom.plaque.className = 'rvb-plaque' + (mode ? ' is-' + mode : '');
    anim(dom.plaque, [{ opacity: 0.2 }, { opacity: 1 }], { duration: 350 });
  }
  function renderLive() {
    dom.app.classList.toggle('is-paused', !!state.paused);
    setText(dom.live, state.paused ? 'PAUSED' : 'LIVE');
  }
  function panelOf(color) { return color === 'red' ? dom.panelRed : dom.panelBlack; }
  function clearResult() {
    dom.app.classList.remove('result-red', 'result-black');
    dom.panelRed.classList.remove('is-winner', 'is-loser');
    dom.panelBlack.classList.remove('is-winner', 'is-loser');
  }
  function showResult(entry, animated) {
    var color = E.colorOf(entry.c), other = color === 'red' ? 'black' : 'red';
    dom.app.classList.remove('result-' + other);
    dom.app.classList.add('result-' + color);
    panelOf(color).classList.remove('is-loser');
    panelOf(color).classList.add('is-winner');
    panelOf(other).classList.remove('is-winner');
    panelOf(other).classList.add('is-loser');
    setPlaque('ROUND ' + fmt(entry.r) + ' · ' + color.toUpperCase() + ' WINS', color);
    renderRound(entry.r, false);
    renderStats(animated);
    renderHistory(animated);
    if (animated) {
      sound.play(color === 'red' ? 'chimeRed' : 'chimeBlack', 0.85);
      burst(color);
      anim(dom.frontShine, [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(420%)', opacity: 1 }], { duration: 950, easing: 'ease-in-out' });
    }
  }

  // ------------------------------------------------------------------ animations
  function flash() {
    if (settings.quality === 'low') return;
    anim(dom.flash, [
      { opacity: 0, transform: 'scale(.6)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.25 },
      { opacity: 0, transform: 'scale(1.35)' }
    ], { duration: 1100, easing: 'ease-out' });
  }
  function burst(color) {
    var n = settings.quality === 'high' ? 36 : settings.quality === 'medium' ? 16 : 0;
    for (var i = 0; i < n; i++) {
      var p = doc.createElement('i');
      var size = 5 + Math.random() * 9;
      p.className = 'rvb-pt ' + (i % 3 === 0 ? (color === 'red' ? 'r' : 'w') : 'g');
      p.style.width = p.style.height = size.toFixed(1) + 'px';
      p.style.marginLeft = p.style.marginTop = (-size / 2).toFixed(1) + 'px';
      dom.particles.appendChild(p);
      var a = Math.random() * Math.PI * 2, dist = 170 + Math.random() * 280;
      var dx = Math.cos(a) * dist, dy = Math.sin(a) * dist * 0.8;
      var an = anim(p, [
        { transform: 'translate(0,0) scale(.3)', opacity: 0 },
        { transform: 'translate(' + (dx * 0.4).toFixed(1) + 'px,' + (dy * 0.4).toFixed(1) + 'px) scale(1)', opacity: 1, offset: 0.18 },
        { transform: 'translate(' + dx.toFixed(1) + 'px,' + (dy + 110).toFixed(1) + 'px) scale(.25)', opacity: 0 }
      ], { duration: 1200 + Math.random() * 900, easing: 'cubic-bezier(.12,.75,.3,1)', fill: 'forwards' });
      bindRemove(p, an);
    }
  }
  function bindRemove(el, an) {
    var rm = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    if (an) an.onfinish = rm; else rm();
  }
  function hideNewDeck() { dom.newdeck.classList.remove('show'); }
  function deckCount() { return settings.quality === 'low' ? 6 : settings.quality === 'medium' ? 10 : 14; }
  function liftPose(i) { return 'translate(' + (-i * 0.35).toFixed(2) + 'px,' + (-24 - i * 0.7).toFixed(2) + 'px) scale(.92)'; }
  function buildDeck(n) {
    removeDeck();
    var frag = doc.createDocumentFragment(), cards = [];
    for (var i = 0; i < n; i++) {
      var d = doc.createElement('div');
      d.className = 'rvb-dcard' + (i === n - 1 ? ' top' : '');
      d.style.transform = liftPose(i);
      frag.appendChild(d);
      cards.push(d);
    }
    dom.deck.appendChild(frag);
    return cards;
  }
  function removeDeck() { dom.deck.textContent = ''; }

  function animReveal(entry) {
    clearLater(); removeDeck(); hideNewDeck(); clearResult();
    cancelAnims(dom.card); cancelAnims(dom.cardWrap);
    dom.cardWrap.style.opacity = '1';
    dom.front.innerHTML = Cards.faceSVG(entry.c);
    dom.card.classList.add('face-up');
    setPlaque('REVEALING', '');
    sound.play('flip', 1);
    anim(dom.card, [
      { transform: 'translateY(0) rotateY(0deg) scale(1)' },
      { transform: 'translateY(-34px) rotateY(0deg) scale(1.05)', offset: 0.22 },
      { transform: 'translateY(-34px) rotateY(180deg) scale(1.05)', offset: 0.78 },
      { transform: 'translateY(0) rotateY(180deg) scale(1)' }
    ], { duration: TM.FLIP, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
    anim(dom.shadow, [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(.82)', opacity: 0.55, offset: 0.3 },
      { transform: 'scale(.82)', opacity: 0.55, offset: 0.75 },
      { transform: 'scale(1)', opacity: 1 }
    ], { duration: TM.FLIP });
    later(function () { flash(); showResult(entry, true); }, TM.FLIP - 60);
  }

  function animCollect() {
    clearLater(); clearResult();
    setPlaque(deckInfo(), '');
    renderRound(state.round, true);
    if (!dom.card.classList.contains('face-up')) return;
    cancelAnims(dom.card);
    dom.card.classList.remove('face-up');
    sound.play('flip', 0.4);
    anim(dom.card, [
      { transform: 'translateY(0) rotateY(180deg)' },
      { transform: 'translateY(-28px) rotateY(270deg)', offset: 0.5 },
      { transform: 'translateY(0) rotateY(360deg)' }
    ], { duration: TM.COLLECT, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'backwards' });
  }

  function animShuffle() {
    clearLater();
    var n = deckCount(), cards = buildDeck(n), D = TM.SHUFFLE, isNew = state.newDeck, low = settings.quality === 'low';
    cancelAnims(dom.cardWrap);
    dom.cardWrap.style.opacity = '0';
    setPlaque(isNew ? 'NEW DECK · SHUFFLING' : 'SHUFFLING', '');
    if (isNew) { dom.newdeck.classList.add('show'); later(hideNewDeck, 1700); }
    var s1 = low ? 110 : 150, s2 = low ? 90 : 122, half = Math.ceil(n / 2);
    for (var i = 0; i < n; i++) {
      var side1 = i % 2 === 0 ? -1 : 1, k1 = Math.floor(i / 2);
      var side2 = i < half ? -1 : 1, k2 = side2 < 0 ? i : i - half;
      var rest = 'translate(' + (-i * 0.35).toFixed(2) + 'px,' + (-i * 0.7).toFixed(2) + 'px) scale(1)';
      var lift = liftPose(i);
      var split1 = 'translate(' + (side1 * (s1 - k1 * 0.6)).toFixed(1) + 'px,' + (-34 - k1 * 1.3).toFixed(1) + 'px) rotate(' + (side1 * 7) + 'deg) scale(.92)';
      var split2 = 'translate(' + (side2 * (s2 - k2 * 0.6)).toFixed(1) + 'px,' + (-30 - k2 * 1.3).toFixed(1) + 'px) rotate(' + (side2 * 5) + 'deg) scale(.92)';
      var t1 = 700 + i * (480 / n), t2 = 1720 + i * (430 / n);
      anim(cards[i], [
        { offset: 0, transform: rest, easing: 'cubic-bezier(.3,0,.2,1)' },
        { offset: 300 / D, transform: lift, easing: 'cubic-bezier(.3,0,.2,1)' },
        { offset: 680 / D, transform: split1 },
        { offset: t1 / D, transform: split1, easing: 'cubic-bezier(.5,0,.6,1)' },
        { offset: (t1 + 130) / D, transform: lift },
        { offset: 1380 / D, transform: lift, easing: 'cubic-bezier(.3,0,.2,1)' },
        { offset: 1680 / D, transform: split2 },
        { offset: t2 / D, transform: split2, easing: 'cubic-bezier(.5,0,.6,1)' },
        { offset: (t2 + 120) / D, transform: lift },
        { offset: 1, transform: lift }
      ], { duration: D, fill: 'backwards' });
    }
    later(function () { sound.play('shuffle', 0.8, 1.6); }, 640);
    later(function () { sound.play('shuffle', 0.7, 1.7); }, 1660);
  }

  function animDeal() {
    clearLater(); hideNewDeck();
    var cards = dom.deck.querySelectorAll('.rvb-dcard');
    if (!cards.length) cards = buildDeck(deckCount());
    var n = cards.length;
    sound.play('deal', 0.9);
    for (var i = 0; i < n - 1; i++) {
      cancelAnims(cards[i]);
      anim(cards[i], [
        { transform: liftPose(i), opacity: 1 },
        { transform: 'translate(' + (-150 - i * 2) + 'px,' + (-150 - i) + 'px) rotate(-14deg) scale(.62)', opacity: 0 }
      ], { duration: 620, delay: i * 12, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
    }
    var start = liftPose(n - 1);
    if (n) cards[n - 1].style.visibility = 'hidden';
    cancelAnims(dom.cardWrap);
    dom.cardWrap.style.opacity = '1';
    dom.card.classList.remove('face-up');
    anim(dom.cardWrap, [
      { transform: start + ' rotate(0deg)' },
      { transform: 'translate(0px,-62px) scale(.97) rotate(-3deg)', offset: 0.35 },
      { transform: 'translate(0px,6px) scale(1.01) rotate(.5deg)', offset: 0.78 },
      { transform: 'translate(0px,0px) scale(1) rotate(0deg)' }
    ], { duration: TM.DEAL, easing: 'cubic-bezier(.3,.7,.3,1)' });
    later(removeDeck, 780);
    setPlaque(deckInfo(), '');
  }

  /** Renders the static picture for the current moment (load, resume, tab re-activation, settings). */
  function syncVisuals() {
    if (!state) return;
    clearLater(); hideNewDeck(); removeDeck();
    dom.particles.textContent = '';
    cancelAnims(dom.card); cancelAnims(dom.cardWrap); cancelAnims(dom.shadow); cancelAnims(dom.flash);
    var now = nowFor(), ph = phaseAt(now);
    syncCues(now);
    dom.cardWrap.style.opacity = '1';
    if ((ph === 'gap' || ph === 'result') && state.last) {
      dom.front.innerHTML = Cards.faceSVG(state.last.c);
      dom.card.classList.add('face-up');
      showResult(state.last, false);
    } else {
      dom.card.classList.remove('face-up');
      clearResult();
      renderRound(state.round, false);
      setPlaque(deckInfo(), '');
      if (ph === 'shuffle') {
        buildDeck(deckCount());
        dom.cardWrap.style.opacity = '0';
        setPlaque(state.newDeck ? 'NEW DECK · SHUFFLING' : 'SHUFFLING', '');
      }
    }
    renderStats(false);
    renderHistory(false);
    renderTimer(now, true);
    renderLive();
    updatePanelUI();
  }

  // ------------------------------------------------------------------ game actions
  function pause() {
    if (!state || state.paused) return;
    state.paused = true;
    state.pausedAt = Date.now();
    saveState();
    renderTimer(state.pausedAt, true); renderLive(); updatePanelUI();
    toast('Game paused');
  }
  function resume() {
    if (!state || !state.paused) return;
    var shift = Math.max(0, Date.now() - state.pausedAt);
    state.cs += shift; state.endsAt += shift; state.revealAt += shift;
    state.paused = false; state.pausedAt = 0;
    saveState();
    renderTimer(Date.now(), true); renderLive(); updatePanelUI();
    toast('Game running');
  }
  function togglePause() { if (state.paused) resume(); else pause(); }
  function setIntervalSec(sec, silent) {
    sec = Number(sec);
    if (!state || E.INTERVALS.indexOf(sec) < 0) return;
    state.interval = sec;
    var now = nowFor(), T = sec * 1000;
    if (now >= state.cs && state.endsAt - now > T) state.endsAt = now + T;
    saveState();
    syncVisuals();
    if (!silent) toast('Round interval: ' + sec + ' seconds');
  }
  function restartGame() {
    var gen = (state ? state.gen : 0) + 1, iv = state ? state.interval : 15;
    state = E.createState(iv, Date.now());
    state.gen = gen;
    shown.hist = null;
    saveState();
    syncVisuals();
    toast('New game · fresh shuffled deck');
  }
  function resetStats() {
    state.red = 0; state.black = 0; state.history = [];
    saveState();
    renderStats(false); renderHistory(false); updatePanelUI();
    toast('Statistics reset');
  }
  function setQuality(q) {
    if (QUALITY.indexOf(q) < 0) return;
    settings.quality = q;
    saveSettings(); applyQuality(); updatePanelUI();
    toast('Animation quality: ' + q.charAt(0).toUpperCase() + q.slice(1));
  }
  function applyQuality() {
    dom.app.classList.remove('q-low', 'q-medium', 'q-high');
    dom.app.classList.add('q-' + settings.quality);
  }
  function toggleSound() {
    settings.sound = !settings.sound;
    saveSettings();
    sound.soundOn = settings.sound;
    ensureAudio(); updatePanelUI();
    toast('Sound effects ' + (settings.sound ? 'ON' : 'OFF'));
  }
  function toggleMusic() {
    settings.music = !settings.music;
    saveSettings();
    sound.setMusic(settings.music);
    ensureAudio(); updatePanelUI();
    toast('Music ' + (settings.music ? 'ON' : 'OFF'));
  }
  function ensureAudio() {
    if (!sound.unlocked && settings.sound) sound.tryStart(noop);
  }
  function toggleFullscreen() {
    var d = doc, el = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          var p = req.call(el);
          if (p && typeof p.catch === 'function') p.catch(function () { toast('Fullscreen is not available here'); });
        } else toast('Fullscreen is not supported');
      } else {
        var ex = d.exitFullscreen || d.webkitExitFullscreen;
        if (ex) { var p2 = ex.call(d); if (p2 && typeof p2.catch === 'function') p2.catch(noop); }
      }
    } catch (e) { toast('Fullscreen is not available here'); }
  }
  function requestWakeLock() {
    try {
      if (!wakeLock && !doc.hidden && root.navigator && root.navigator.wakeLock && root.isSecureContext) {
        root.navigator.wakeLock.request('screen').then(function (l) {
          wakeLock = l;
          l.addEventListener('release', function () { wakeLock = null; });
        }, noop);
      }
    } catch (e) { /* not supported */ }
  }

  // ------------------------------------------------------------------ UI: toasts, panel, keys
  function toast(msg, ms) {
    if (opts.obs || !dom.toasts) return;
    var t = doc.createElement('div');
    t.className = 'rvb-toast';
    t.textContent = msg;
    dom.toasts.appendChild(t);
    while (dom.toasts.children.length > 2) dom.toasts.removeChild(dom.toasts.firstChild);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 350); }, ms || 2200);
  }
  function setSeg(group, val) {
    var seg = dom.settings.querySelector('[data-group="' + group + '"]');
    if (!seg) return;
    var bs = seg.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-val') === val);
  }
  function updatePanelUI() {
    if (!dom.settings || !state || !settings) return;
    var paused = !!state.paused, tot = state.red + state.black;
    dom.status.className = 'rvb-status' + (paused ? ' paused' : '');
    dom.status.innerHTML = '<span class="dot"></span><b>' + (paused ? 'Paused' : 'Running') + '</b> · Round ' + fmt(state.round) +
      ' · Deck ' + state.deckNo + ' (' + state.pos + '/52 dealt)' + (isLeader ? '' : '<br><small>Mirroring the game running in another tab/window</small>');
    dom.btnToggle.innerHTML = paused ? '&#9654; Start' : '&#10073;&#10073; Pause';
    dom.btnResume.disabled = !paused;
    setSeg('interval', String(state.interval));
    setSeg('quality', settings.quality);
    dom.swSound.classList.toggle('on', settings.sound); dom.swSound.setAttribute('aria-checked', String(settings.sound));
    dom.swMusic.classList.toggle('on', settings.music); dom.swMusic.setAttribute('aria-checked', String(settings.music));
    if (doc.activeElement !== dom.volSound) dom.volSound.value = String(Math.round(settings.sfxVol * 100));
    if (doc.activeElement !== dom.volMusic) dom.volMusic.value = String(Math.round(settings.musicVol * 100));
    var fs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
    dom.btnFs.innerHTML = fs ? ICON_FS_OUT + ' Exit Fullscreen' : ICON_FS_IN + ' Enter Fullscreen';
    dom.mini.textContent = 'Red ' + fmt(state.red) + ' (' + pct(state.red, tot) + ') · Black ' + fmt(state.black) + ' (' + pct(state.black, tot) + ')';
  }
  function toggleSettings(force) {
    var open = typeof force === 'boolean' ? force : !dom.settings.classList.contains('open');
    dom.settings.classList.toggle('open', open);
    dom.settings.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) { dom.app.classList.remove('ui-idle'); updatePanelUI(); } else onActivity();
  }
  function confirmThen(btn, fn) {
    if (btn.classList.contains('armed')) {
      clearTimeout(btn._rvbT);
      btn.classList.remove('armed');
      btn.textContent = btn.getAttribute('data-label');
      fn();
      return;
    }
    btn.classList.add('armed');
    btn.textContent = btn.getAttribute('data-confirm');
    clearTimeout(btn._rvbT);
    btn._rvbT = setTimeout(function () { btn.classList.remove('armed'); btn.textContent = btn.getAttribute('data-label'); }, 3000);
  }
  function onPanelClick(e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b || !dom.settings.contains(b)) return;
    var group = b.parentNode && b.parentNode.getAttribute ? b.parentNode.getAttribute('data-group') : null;
    var act = b.getAttribute('data-act');
    if (group === 'interval') setIntervalSec(b.getAttribute('data-val'));
    else if (group === 'quality') setQuality(b.getAttribute('data-val'));
    else if (act === 'close') toggleSettings(false);
    else if (act === 'toggle') togglePause();
    else if (act === 'resume') resume();
    else if (act === 'restart') confirmThen(b, restartGame);
    else if (act === 'fullscreen') toggleFullscreen();
    else if (act === 'sound') toggleSound();
    
    else if (act === 'reset') confirmThen(b, resetStats);
    else if (act === 'download' && typeof opts.onDownload === 'function') opts.onDownload();
    updatePanelUI();
    if (b.blur) b.blur();
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var k = e.key;
    if (k === ' ' || k === 'Spacebar') { e.preventDefault(); togglePause(); }
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 's' || k === 'S') toggleSettings();
    else if (k === 'n' || k === 'N') toggleSound();
    else if (k === 'Escape' && dom.settings.classList.contains('open')) toggleSettings(false);
  }
  function onActivity() {
    if (opts.obs) return;
    dom.app.classList.remove('ui-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!dom.settings.classList.contains('open')) dom.app.classList.add('ui-idle');
    }, 2600);
  }
  function bindUI() {
    dom.gear.addEventListener('click', function () { toggleSettings(); dom.gear.blur(); });
    dom.settings.addEventListener('click', onPanelClick);
    dom.volSound.addEventListener('input', function () { settings.sfxVol = clamp01(this.value / 100); sound.sfxVol = settings.sfxVol; saveSettingsSoon(); });
    dom.volSound.addEventListener('change', function () { sound.play('tick', 1); });
    dom.volMusic.addEventListener('input', function () { settings.musicVol = clamp01(this.value / 100); sound.setMusicVolume(settings.musicVol); saveSettingsSoon(); });
    dom.stage.addEventListener('click', function () { if (dom.settings.classList.contains('open')) toggleSettings(false); });
    dom.stage.addEventListener('dblclick', toggleFullscreen);
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('mousemove', onActivity, { passive: true });
    doc.addEventListener('pointerdown', onActivity, { passive: true });
    doc.addEventListener('fullscreenchange', function () { updatePanelUI(); fitStage(); });
    doc.addEventListener('webkitfullscreenchange', function () { updatePanelUI(); fitStage(); });
  }

  // ------------------------------------------------------------------ lifecycle
  function cacheDom() {
    var ids = {
      app: 'rvb-app', stage: 'rvb-stage', round: 'rvb-round', live: 'rvb-live-text', panelRed: 'rvb-panel-red', panelBlack: 'rvb-panel-black',
      card: 'rvb-card', cardWrap: 'rvb-card-wrap', front: 'rvb-front', frontShine: 'rvb-front-shine', shadow: 'rvb-card-shadow', deck: 'rvb-deck',
      particles: 'rvb-particles', flash: 'rvb-flash', plaque: 'rvb-plaque', plaqueText: 'rvb-plaque-text', newdeck: 'rvb-newdeck',
      redCount: 'rvb-red-count', blackCount: 'rvb-black-count', ratio: 'rvb-ratio-red', timer: 'rvb-timer', timerLabel: 'rvb-timer-label',
      digits: 'rvb-timer-digits', progress: 'rvb-progress', recent: 'rvb-recent', sparkles: 'rvb-sparkles', gear: 'rvb-gear',
      settings: 'rvb-settings', status: 'rvb-status', toasts: 'rvb-toasts', btnToggle: 'rvb-btn-toggle', btnResume: 'rvb-btn-resume',
      btnFs: 'rvb-btn-fs', swSound: 'rvb-sw-sound', swMusic: 'rvb-sw-music', volSound: 'rvb-vol-sound', volMusic: 'rvb-vol-music',
      mini: 'rvb-mini', extra: 'rvb-extra'
    };
    for (var k in ids) {
      dom[k] = $(ids[k]);
      if (!dom[k]) throw new Error('RED vs BLACK: missing element #' + ids[k]);
    }
  }
  // url() values inside CSS variables resolve relative to the stylesheet that uses them,
  // so relative paths are converted to absolute URLs against the page location first.
  function absUrl(u) {
    u = String(u);
    if (/^(data:|blob:|[a-z][a-z0-9+.-]*:\/\/)/i.test(u)) return u;
    try { return new root.URL(u, doc.baseURI).href; } catch (e) { return u; }
  }
  function applyImageVars() {
    for (var k in assets.img) dom.app.style.setProperty('--img-' + k, 'url("' + absUrl(assets.img[k]).replace(/"/g, '%22') + '")');
  }
  function buildSparkles() {
    var html = '';
    for (var i = 0; i < 18; i++) {
      var x = 600 + Math.random() * 720, y = 300 + Math.random() * 460, s = 3 + Math.random() * 5, d = 7 + Math.random() * 7;
      html += '<i style="left:' + x.toFixed(0) + 'px;top:' + y.toFixed(0) + 'px;width:' + s.toFixed(1) + 'px;height:' + s.toFixed(1) +
        'px;animation-duration:' + d.toFixed(1) + 's;animation-delay:' + (-Math.random() * d).toFixed(1) + 's"></i>';
    }
    dom.sparkles.innerHTML = html;
  }
  function fitStage() {
    var w = root.innerWidth || 1920, h = root.innerHeight || 1080;
    dom.stage.style.setProperty('--rvb-scale', String(Math.min(w / 1920, h / 1080)));
  }
  function readParams() {
    var p = {};
    try {
      var q = new root.URLSearchParams(root.location.search || '');
      q.forEach(function (v, k) { p[String(k).toLowerCase()] = String(v).toLowerCase(); });
    } catch (e) { /* ignore */ }
    return p;
  }
  function initState(params) {
    var now = Date.now();
    var saved = readState();
    var lock = readJSON(KEYS.lock);
    var otherLive = storageOK && lock && lock.id !== instanceId && now - (lock.t || 0) < TM.LOCK_TTL;
    if (otherLive && saved) { state = saved; isLeader = false; lastBeat = now; return; }   // mirror the running instance
    isLeader = true;
    lastBeat = now;
    writeJSON(KEYS.lock, { id: instanceId, t: now });
    var iv = E.INTERVALS.indexOf(Number(params.interval)) >= 0 ? Number(params.interval) : 0;
    if (saved && params.reset !== '1') {
      state = saved;
      state.paused = false; state.pausedAt = 0;          // always start automatically when opened
      if (iv) state.interval = iv;
      var T = state.interval * 1000;
      if (state.endsAt <= now + 300 || state.endsAt - now > T + TM.GAP + 2000) {
        // The countdown expired while the page was closed: restart it for the same round.
        // Rounds are never replayed, duplicated or skipped.
        state.cs = now; state.endsAt = now + T;
      }
    } else {
      state = E.createState(iv || (saved ? saved.interval : 15), now);
      state.gen = saved ? saved.gen + 1 : 1;
    }
    saveState();
  }
  function initAudio() {
    sound = new SoundManager(assets.audio);
    sound.soundOn = settings.sound; sound.musicOn = false;
    sound.sfxVol = settings.sfxVol; sound.musicVol = settings.musicVol;
    sound.init();
    if (!settings.sound) return;
    sound.tryStart(function (ok) {
      if (ok) return;
      var evts = ['pointerdown', 'keydown', 'touchstart'];
      var unlock = function () {
        if (sound.unlocked || !settings.sound) { off(); return; }
        sound.tryStart(function (ok2) { if (ok2) off(); });
      };
      var off = function () { evts.forEach(function (t) { doc.removeEventListener(t, unlock, true); }); };
      evts.forEach(function (t) { doc.addEventListener(t, unlock, true); });
      setTimeout(function () { if (!sound.unlocked && settings.sound) toast('Click anywhere to enable sound', 6000); }, 1500);
    });
  }
  function revealStage() {
    var done = false;
    var go = function () { if (!done) { done = true; dom.app.classList.add('is-ready'); } };
    var waits = [];
    try { if (doc.fonts && doc.fonts.ready) waits.push(doc.fonts.ready); } catch (e) { /* ignore */ }
    ['bg', 'filigree'].forEach(function (k) {
      waits.push(new Promise(function (res) { var im = new root.Image(); im.onload = im.onerror = function () { res(); }; im.src = assets.img[k]; }));
    });
    Promise.all(waits).then(go, go);
    setTimeout(go, 1800);
  }

  function start(options) {
    if (started) return;
    started = true;
    opts = options || {};
    assets = merge(DEFAULT_ASSETS, opts.assets);
    storageOK = testStorage();
    cacheDom();
    applyImageVars();
    buildSparkles();
    var params = readParams();
    settings = loadSettings();
    if (params.obs === '1' || params.obs === 'true') { opts.obs = true; dom.app.classList.add('is-obs'); }
    if (QUALITY.indexOf(params.quality) >= 0) settings.quality = params.quality;
    if (params.sound === '0' || params.sound === 'off') settings.sound = false;
    settings.music = false;
    if (typeof opts.onDownload === 'function') dom.extra.hidden = false;
    dom.app.classList.add('ui-idle');
    applyQuality();
    bindUI();
    initAudio();
    initState(params);
    fitStage();
    root.addEventListener('resize', fitStage);
    syncVisuals();
    revealStage();
    tickHandle = setInterval(tick, TM.TICK);
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) return;
      if (!isLeader) { var latest = readState(); if (latest) state = latest; }
      syncVisuals();
      requestWakeLock();
    });
    root.addEventListener('storage', onStorage);
    root.addEventListener('pagehide', releaseLock);
    root.addEventListener('beforeunload', releaseLock);
    requestWakeLock();
  }

  function onStorage(e) {
    if (!e || !e.key) return;
    if (e.key === KEYS.state && e.newValue) {
      var s = null;
      try { s = E.restoreState(JSON.parse(e.newValue), Date.now()); } catch (x) { s = null; }
      if (!s) return;
      var prev = state;
      state = s;
      if (!doc.hidden && prev && s.gen === prev.gen && s.round === prev.round + 1 && s.last && Date.now() - s.revealAt < 2500) {
        resetCues();
        animReveal(s.last);
      } else {
        syncVisuals();
      }
      updatePanelUI();
    } else if (e.key === KEYS.settings && e.newValue) {
      settings = loadSettings();
      applyQuality();
      sound.soundOn = settings.sound;
      sound.sfxVol = settings.sfxVol;
      sound.setMusicVolume(settings.musicVol);
      if (sound.musicOn !== settings.music) sound.setMusic(settings.music);
      updatePanelUI();
    }
  }

  root.RVBGame = {
    start: start,
    pause: function () { pause(); },
    resume: function () { resume(); },
    restart: function () { restartGame(); },
    resetStats: function () { resetStats(); },
    setInterval: function (s) { setIntervalSec(s); },
    getState: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
    isLeader: function () { return isLeader; },
    debug: {
      /** Jump the countdown so the next reveal happens in `ms` milliseconds. */
      revealIn: function (ms) { if (!state || state.paused) return; var now = Date.now(); state.cs = Math.min(state.cs, now - 10000); state.endsAt = now + ms; saveState(); syncVisuals(); },
      /** Move the deck pointer (e.g. 50) to test the automatic reshuffle quickly. */
      setDeckPos: function (p) { if (!state) return; state.pos = Math.max(0, Math.min(51, p | 0)); saveState(); syncVisuals(); },
      timing: TM
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
