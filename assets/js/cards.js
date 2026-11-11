/*!
 * RED vs BLACK · Card Challenge — card face renderer (inline SVG, crisp at any scale)
 */
(function (root) {
  'use strict';

  var P = {
    H: 'M50 92C34 78 6 60 6 34C6 17 19 6 33 6C42 6 47 11 50 18C53 11 58 6 67 6C81 6 94 17 94 34C94 60 66 78 50 92Z',
    D: 'M50 3C61 21 76 37 92 50C76 63 61 79 50 97C39 79 24 63 8 50C24 37 39 21 50 3Z',
    S: 'M50 4C58 18 94 38 94 62C94 76 84 84 72 84C64 84 57 80 53 74C54 84 58 91 67 96L33 96C42 91 46 84 47 74C43 80 36 84 28 84C16 84 6 76 6 62C6 38 42 18 50 4Z',
    C: 'M30.5 28a19.5 19.5 0 1 0 39 0a19.5 19.5 0 1 0-39 0ZM8 56a19.5 19.5 0 1 0 39 0a19.5 19.5 0 1 0-39 0ZM53 56a19.5 19.5 0 1 0 39 0a19.5 19.5 0 1 0-39 0ZM50 34L34 58L66 58ZM46 58C46 75 42 86 32 95L68 95C58 86 54 75 54 58Z'
  };
  var FONT = "'RVB Cinzel','Cinzel',Georgia,serif";
  var GOLD = '<stop offset="0" stop-color="#fff2c0"/><stop offset=".3" stop-color="#e2b75c"/><stop offset=".55" stop-color="#a87828"/><stop offset=".8" stop-color="#e9c66f"/><stop offset="1" stop-color="#9b6c1f"/>';
  var LAYOUT = {
    '2': [[0.5, 0], [0.5, 1]],
    '3': [[0.5, 0], [0.5, 0.5], [0.5, 1]],
    '4': [[0, 0], [1, 0], [0, 1], [1, 1]],
    '5': [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
    '6': [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
    '7': [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
    '8': [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
    '9': [[0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5], [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1]],
    '10': [[0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1]]
  };
  var CROWNS = {
    K: 'M10 46L3 12L25 30L50 4L75 30L97 12L90 46Z',
    Q: 'M8 46Q50 36 92 46L88 24Q76 30 68 18Q60 6 50 6Q40 6 32 18Q24 30 12 24Z',
    J: 'M12 46L16 22L33 32L50 16L67 32L84 22L88 46Z'
  };
  var PEARLS = { K: [[3, 12], [50, 4], [97, 12]], Q: [[50, 6], [12, 24], [88, 24]], J: [[16, 22], [50, 16], [84, 22]] };
  var uid = 0;

  function r(v) { return Math.round(v * 100) / 100; }

  function pip(suit, cx, cy, size, flip, fill, extra) {
    return '<path d="' + P[suit] + '" fill="' + fill + '" transform="translate(' + r(cx - size / 2) + ' ' + r(cy - size / 2) + ') scale(' + r(size / 100) + ')' +
      (flip ? ' rotate(180 50 50)' : '') + '"' + (extra || '') + '/>';
  }

  function index(c, ink) {
    var ten = c.rank === '10';
    return '<text x="34" y="66" text-anchor="middle" font-family="' + FONT + '" font-weight="900" font-size="' + (ten ? 46 : c.rank === 'Q' ? 46 : 54) + '"' +
      (ten ? ' textLength="50" lengthAdjust="spacingAndGlyphs"' : '') + ' fill="' + ink + '">' + c.rank + '</text>' +
      pip(c.suit, 34, 96, 34, false, ink);
  }

  function pips(c, ink) {
    var lay = LAYOUT[c.rank], n = lay.length, out = '';
    var size = n <= 3 ? 66 : (n <= 8 ? 60 : 54);
    for (var i = 0; i < n; i++) {
      var u = lay[i][0], v = lay[i][1];
      out += pip(c.suit, 104 + u * 112, 94 + v * 242, size, v > 0.5, ink);
    }
    return out;
  }

  function ace(c, ink, k) {
    var big = c.suit === 'S' ? 158 : 134;
    var out = '<circle cx="160" cy="215" r="106" fill="none" stroke="url(#' + k + 'g)" stroke-width="2.6"/>' +
      '<circle cx="160" cy="215" r="97" fill="none" stroke="#b8862f" stroke-width="1.3" stroke-dasharray="1.5 5" stroke-linecap="round"/>' +
      '<g fill="url(#' + k + 'g)"><path d="M160 101l7 8l-7 8l-7-8z"/><path d="M160 313l7 8l-7 8l-7-8z"/><path d="M46 215l8-7l8 7l-8 7z"/><path d="M258 215l8-7l8 7l-8 7z"/></g>';
    out += pip(c.suit, 160, 213, big, false, ink, ' stroke="url(#' + k + 'g)" stroke-width="' + r(2.4 / (big / 100)) + '" stroke-linejoin="round" paint-order="stroke"');
    return out;
  }

  function courtHalf(c, ink, k) {
    var o = pip(c.suit, 160, 166, 92, false, ink, ' opacity=".07"') + '<g transform="translate(115 74) scale(.9)"><path d="' + CROWNS[c.rank] + '" fill="url(#' + k + 'g)" stroke="#6b470f" stroke-width="2" stroke-linejoin="round"/>';
    PEARLS[c.rank].forEach(function (p) { o += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.6" fill="#fff6d8" stroke="#8a6418" stroke-width="1.2"/>'; });
    o += '<circle cx="50" cy="38" r="5" fill="' + ink + '" stroke="#6b470f" stroke-width="1"/></g>';
    o += '<text x="160" y="186" text-anchor="middle" font-family="' + FONT + '" font-weight="900" font-size="76" fill="' + ink + '" stroke="url(#' + k + 'g)" stroke-width="1.8" paint-order="stroke">' + c.rank + '</text>';
    o += pip(c.suit, 90, 98, 26, false, ink) + pip(c.suit, 230, 98, 26, false, ink);
    return o;
  }

  function court(c, ink, k, red) {
    var line = red ? '#c80f24' : '#1a1a1a';
    var out = '<defs><linearGradient id="' + k + 't" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (red ? '#fff4f4' : '#f7f7f7') + '"/><stop offset=".5" stop-color="' + (red ? '#fbe6e6' : '#ececec') + '"/><stop offset="1" stop-color="' + (red ? '#fff4f4' : '#f7f7f7') + '"/></linearGradient>' +
      '<pattern id="' + k + 'l" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H14M0 0V14" stroke="' + line + '" stroke-opacity=".08" stroke-width="1.2" fill="none"/></pattern></defs>';
    out += '<rect x="62" y="64" width="196" height="302" rx="8" fill="url(#' + k + 't)"/>' +
      '<rect x="62" y="64" width="196" height="302" rx="8" fill="url(#' + k + 'l)"/>' +
      '<rect x="62" y="64" width="196" height="302" rx="8" fill="none" stroke="url(#' + k + 'g)" stroke-width="3.6"/>' +
      '<rect x="69.5" y="71.5" width="181" height="287" rx="5" fill="none" stroke="' + line + '" stroke-opacity=".5" stroke-width="1"/>' +
      '<path d="M78 215H242" stroke="#c9a04a" stroke-width="1.6"/>' +
      '<path d="M160 206l9 9l-9 9l-9-9z" fill="url(#' + k + 'g)" stroke="#6b470f" stroke-width=".8"/>';
    var half = courtHalf(c, ink, k);
    return out + half + '<g transform="rotate(180 160 215)">' + half + '</g>';
  }

  /** Returns the SVG markup for the face of card `id` (e.g. "QH", "10S"). */
  function faceSVG(id) {
    var c = root.RVBEngine.parseCard(id);
    var k = 'rvbcf' + (++uid) + '_';
    var red = c.color === 'red';
    var ink = 'url(#' + k + 'i)';
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 430" role="img" aria-label="' + c.name + '"><defs>' +
      '<linearGradient id="' + k + 'p" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#fffefa"/><stop offset=".6" stop-color="#f8f3e8"/><stop offset="1" stop-color="#ece4d2"/></linearGradient>' +
      (red
        ? '<linearGradient id="' + k + 'i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f02b3d"/><stop offset=".55" stop-color="#c80f24"/><stop offset="1" stop-color="#8f0618"/></linearGradient>'
        : '<linearGradient id="' + k + 'i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3c3c"/><stop offset=".5" stop-color="#161616"/><stop offset="1" stop-color="#000"/></linearGradient>') +
      '<linearGradient id="' + k + 'g" x1="0" y1="0" x2="0" y2="1">' + GOLD + '</linearGradient>' +
      '</defs>' +
      '<rect width="320" height="430" rx="18" fill="url(#' + k + 'p)"/>' +
      '<rect x="8" y="8" width="304" height="414" rx="12" fill="none" stroke="' + (red ? '#c80f24' : '#222') + '" stroke-opacity=".13" stroke-width="1.5"/>';
    var idx = index(c, ink);
    s += idx + '<g transform="rotate(180 160 215)">' + idx + '</g>';
    if (c.rank === 'A') s += ace(c, ink, k);
    else if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') s += court(c, ink, k, red);
    else s += pips(c, ink);
    return s + '</svg>';
  }

  root.RVBCards = { faceSVG: faceSVG, SUIT_PATHS: P };
})(typeof window !== 'undefined' ? window : globalThis);
