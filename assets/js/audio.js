/*!
 * RED vs BLACK · Card Challenge — sound manager
 * Uses pooled HTMLAudioElements (works from file:// — no fetch / XHR needed).
 * Browsers block audio until the first user interaction; tryStart() handles that.
 */
(function (root) {
  'use strict';

  function noop() {}
  function clamp01(v) { v = Number(v); return !(v > 0) ? 0 : v > 1 ? 1 : v; }
  var POOL = { flip: 3, deal: 2, shuffle: 2, tick: 3, chimeRed: 2, chimeBlack: 2 };

  function SoundManager(urls) {
    this.urls = urls || {};
    this.pools = {};
    this.music = null;
    this.soundOn = true;
    this.musicOn = true;
    this.sfxVol = 0.8;
    this.musicVol = 0.4;
    this.unlocked = false;
    this._fade = 0;
    this._fading = false;
  }

  SoundManager.prototype.init = function () {
    if (typeof root.Audio === 'undefined') return;
    for (var name in POOL) {
      if (!Object.prototype.hasOwnProperty.call(POOL, name) || !this.urls[name]) continue;
      var items = [];
      for (var i = 0; i < POOL[name]; i++) {
        var a = new root.Audio();
        a.preload = 'auto';
        a.src = this.urls[name];
        items.push(a);
      }
      this.pools[name] = { items: items, i: 0 };
    }
    if (this.urls.music) {
      var m = new root.Audio();
      m.preload = 'auto';
      m.loop = true;
      m.src = this.urls.music;
      m.volume = 0;
      this.music = m;
    }
  };

  /** Play a sound effect. vol = relative volume (0..1), rate = playback rate. */
  SoundManager.prototype.play = function (name, vol, rate) {
    if (!this.soundOn || !this.unlocked) return;
    var pool = this.pools[name];
    if (!pool) return;
    var a = pool.items[pool.i];
    pool.i = (pool.i + 1) % pool.items.length;
    try { a.pause(); a.currentTime = 0; } catch (e) { /* not ready yet */ }
    a.volume = clamp01(this.sfxVol * (vol == null ? 1 : vol));
    try { a.playbackRate = rate || 1; } catch (e2) { /* ignore */ }
    var p;
    try { p = a.play(); } catch (e3) { return; }
    if (p && typeof p.catch === 'function') p.catch(noop);
  };

  /** Try to start audio output (autoplay). cb(true) when audio is allowed. */
  SoundManager.prototype.tryStart = function (cb) {
    var self = this;
    var useMusic = this.musicOn && this.music;
    var probe = useMusic ? this.music : (this.pools.tick && this.pools.tick.items[0]);
    if (!probe) { if (cb) cb(false); return; }
    var prevVol = probe.volume;
    probe.volume = 0;
    var p;
    try { p = probe.play(); } catch (e) { if (cb) cb(false); return; }
    var ok = function () {
      self.unlocked = true;
      if (useMusic) {
        if (!self.musicOn) { try { probe.pause(); } catch (e) { /* ignore */ } }
        else self._fadeMusic(self.musicVol, 2500);
      } else {
        try { probe.pause(); probe.currentTime = 0; } catch (e2) { /* ignore */ }
        probe.volume = prevVol;
      }
      if (cb) cb(true);
    };
    var fail = function () { if (cb) cb(false); };
    if (p && typeof p.then === 'function') p.then(ok, fail); else ok();
  };

  SoundManager.prototype.setMusic = function (on) {
    this.musicOn = !!on;
    var m = this.music, self = this;
    if (!m) return;
    if (this.musicOn) {
      if (!this.unlocked) return;
      var p;
      try { p = m.play(); } catch (e) { return; }
      if (p && typeof p.then === 'function') p.then(function () { self._fadeMusic(self.musicVol, 1200); }, noop);
      else this._fadeMusic(this.musicVol, 1200);
    } else {
      this._fadeMusic(0, 600, function () { try { m.pause(); } catch (e) { /* ignore */ } });
    }
  };

  SoundManager.prototype.setMusicVolume = function (v) {
    this.musicVol = clamp01(v);
    if (this.music && this.musicOn && this.unlocked) {
      if (this._fading) { clearInterval(this._fade); this._fading = false; }
      try { this.music.volume = this.musicVol; } catch (e) { /* ignore */ }
    }
  };

  SoundManager.prototype._fadeMusic = function (target, ms, done) {
    var m = this.music, self = this;
    if (!m) return;
    clearInterval(this._fade);
    this._fading = true;
    var from = m.volume, start = Date.now();
    this._fade = setInterval(function () {
      var t = Math.min(1, (Date.now() - start) / ms);
      try { m.volume = clamp01(from + (target - from) * t); } catch (e) { /* ignore */ }
      if (t >= 1) {
        clearInterval(self._fade);
        self._fading = false;
        if (done) done();
      }
    }, 50);
  };

  root.RVBSoundManager = SoundManager;
})(typeof window !== 'undefined' ? window : globalThis);
