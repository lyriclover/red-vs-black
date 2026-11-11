/*!
 * RED vs BLACK · Card Challenge — game engine (pure logic, no DOM)
 * Standard 52-card deck. Hearts & Diamonds = RED, Spades & Clubs = BLACK.
 * Cards are dealt from a shuffled deck and never repeat until all 52 have been used,
 * then a fresh deck is shuffled automatically.
 */
(function (root) {
  'use strict';

  var SUITS = ['H', 'D', 'C', 'S'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUIT_NAMES = { H: 'Hearts', D: 'Diamonds', C: 'Clubs', S: 'Spades' };
  var RANK_NAMES = { A: 'Ace', J: 'Jack', Q: 'Queen', K: 'King' };
  var INTERVALS = [10, 15, 20, 30];
  var HISTORY_MAX = 60;
  var CARD_RE = /^(A|[2-9]|10|J|Q|K)[HDCS]$/;

  /** Unbiased random integer in [0, n) using crypto when available. */
  function randomInt(n) {
    var c = root.crypto || root.msCrypto;
    if (c && typeof c.getRandomValues === 'function') {
      var buf = new Uint32Array(1);
      var limit = Math.floor(4294967296 / n) * n;
      var x;
      do { c.getRandomValues(buf); x = buf[0]; } while (x >= limit);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }

  function fullDeck() {
    var d = [];
    for (var s = 0; s < SUITS.length; s++) for (var r = 0; r < RANKS.length; r++) d.push(RANKS[r] + SUITS[s]);
    return d;
  }

  /** Fisher–Yates shuffle (in place). */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function newDeck() { return shuffle(fullDeck()); }

  function isValidCard(id) { return typeof id === 'string' && CARD_RE.test(id); }

  function isValidDeck(deck) {
    if (!Array.isArray(deck) || deck.length !== 52) return false;
    var seen = {};
    for (var i = 0; i < 52; i++) {
      var c = deck[i];
      if (!isValidCard(c) || seen[c]) return false;
      seen[c] = 1;
    }
    return true;
  }

  function colorOf(id) {
    var s = String(id).slice(-1);
    return s === 'H' || s === 'D' ? 'red' : 'black';
  }

  function parseCard(id) {
    var suit = id.slice(-1);
    var rank = id.slice(0, -1);
    return {
      id: id, rank: rank, suit: suit, color: colorOf(id),
      name: (RANK_NAMES[rank] || rank) + ' of ' + SUIT_NAMES[suit]
    };
  }

  function createState(interval, now) {
    var iv = INTERVALS.indexOf(interval) >= 0 ? interval : 15;
    return {
      v: 1,
      gen: 1,                 // incremented on restart (used to reset visual cues)
      round: 1,               // round currently counting down (next card to deal)
      deck: newDeck(),        // current shuffled deck
      pos: 0,                 // index of the next card in the deck
      deckNo: 1,              // number of decks used so far
      newDeck: true,          // the next shuffle animation introduces a fresh deck
      red: 0,
      black: 0,
      history: [],            // newest first: { r: round, c: card, d: deckNo, n: position }
      last: null,             // last revealed entry
      interval: iv,           // seconds
      revealAt: now - 100000, // time the last card was revealed
      cs: now,                // countdown start of current round
      endsAt: now + iv * 1000,// countdown end (reveal time) of current round
      paused: false,
      pausedAt: 0
    };
  }

  /**
   * Deals the card for the current round and schedules the next one.
   * Mutates state. Returns { card, entry, color }.
   */
  function dealRound(state, revealAt, gapMs) {
    if (!isValidDeck(state.deck) || state.pos < 0 || state.pos >= 52) {
      state.deck = newDeck(); state.pos = 0; state.deckNo += 1;
    }
    var id = state.deck[state.pos];
    state.pos += 1;
    var color = colorOf(id);
    if (color === 'red') state.red += 1; else state.black += 1;
    var entry = { r: state.round, c: id, d: state.deckNo, n: state.pos };
    state.last = entry;
    state.history.unshift(entry);
    if (state.history.length > HISTORY_MAX) state.history.length = HISTORY_MAX;
    state.round += 1;
    state.newDeck = false;
    if (state.pos >= 52) {             // deck exhausted -> automatic reshuffle
      state.deck = newDeck();
      state.pos = 0;
      state.deckNo += 1;
      state.newDeck = true;
    }
    state.revealAt = revealAt;
    state.cs = revealAt + gapMs;
    state.endsAt = state.cs + state.interval * 1000;
    return { card: parseCard(id), entry: entry, color: color };
  }

  function int(v, min, max, dflt) {
    v = Number(v);
    if (!isFinite(v)) return dflt;
    v = Math.floor(v);
    if (v < min) return dflt;
    if (max != null && v > max) return dflt;
    return v;
  }
  function validEntry(e) {
    return e && typeof e === 'object' && isValidCard(e.c) && int(e.r, 1, null, 0) > 0;
  }

  /** Validates & sanitizes a saved state object. Returns a clean state or null. */
  function restoreState(obj, now) {
    if (!obj || typeof obj !== 'object' || obj.v !== 1 || !isValidDeck(obj.deck)) return null;
    var s = createState(INTERVALS.indexOf(obj.interval) >= 0 ? obj.interval : 15, now);
    s.gen = int(obj.gen, 1, null, 1);
    s.round = int(obj.round, 1, null, 1);
    s.deck = obj.deck.slice();
    s.pos = int(obj.pos, 0, 51, 0);
    s.deckNo = int(obj.deckNo, 1, null, 1);
    s.newDeck = !!obj.newDeck;
    s.red = int(obj.red, 0, null, 0);
    s.black = int(obj.black, 0, null, 0);
    s.history = Array.isArray(obj.history) ? obj.history.filter(validEntry).slice(0, HISTORY_MAX).map(function (e) {
      return { r: int(e.r, 1, null, 1), c: e.c, d: int(e.d, 1, null, 1), n: int(e.n, 1, 52, 1) };
    }) : [];
    s.last = validEntry(obj.last) ? { r: int(obj.last.r, 1, null, 1), c: obj.last.c, d: int(obj.last.d, 1, null, 1), n: int(obj.last.n, 1, 52, 1) } : null;
    ['revealAt', 'cs', 'endsAt', 'pausedAt'].forEach(function (k) {
      if (typeof obj[k] === 'number' && isFinite(obj[k])) s[k] = obj[k];
    });
    s.paused = !!obj.paused;
    return s;
  }

  var api = {
    SUITS: SUITS, RANKS: RANKS, INTERVALS: INTERVALS, HISTORY_MAX: HISTORY_MAX,
    randomInt: randomInt, fullDeck: fullDeck, shuffle: shuffle, newDeck: newDeck,
    isValidCard: isValidCard, isValidDeck: isValidDeck, colorOf: colorOf, parseCard: parseCard,
    createState: createState, dealRound: dealRound, restoreState: restoreState
  };
  root.RVBEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
