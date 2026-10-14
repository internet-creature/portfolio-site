// Slice 3 §8 audio. Plays assets/sfx/<key>.mp3 and the ambient loops in assets/amb/ (data/audio.js); silent if a file
// is missing (each file is requested once, then remembered as ok / missing). Web Audio (fetch + decode) when served
// over http(s); HTMLAudio elements under file:// (browsers block fetch there). Audio starts after the first click.
(function (root) {
  const G = root.G;
  const A = () => DATA.audio;
  const SFX = G.Sfx = { enabled: A().enabled, unlocked: false, cache: {}, requests: {}, last: {}, guns: [], played: [], screen: null, amb: null, ctx: null };
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const hasDom = typeof document !== "undefined" && typeof Audio !== "undefined";
  const base = () => (DATA.sprites.basePath || "assets/");
  // settings live in the save (state.settings); defaults from data/audio.js
  SFX.settings = () => (G.state && G.state.settings) || A().defaults;
  SFX.vol = (kind) => { const s = SFX.settings(); return s.mute ? 0 : (s.master ?? A().defaults.master) * (s[kind] ?? A().defaults[kind]); };

  // ---- admission (pure, tested headless): retrigger window + gunshot voice cap (quietest dropped first) ----
  // returns { ok, stop: voice | null, why }
  SFX.admit = function (key, vol, t) {
    const D = A(), def = D.sfx[key] || {};
    if (SFX.last[key] != null && t - SFX.last[key] < D.retriggerMs) return { ok: false, why: "retrigger" };
    if (def.group === "gun") {
      SFX.guns = SFX.guns.filter((v) => v.end > t);
      if (SFX.guns.length >= D.maxGunshots) {
        const q = SFX.guns.reduce((a, v) => (v.vol < a.vol ? v : a), SFX.guns[0]);
        if (vol <= q.vol) return { ok: false, why: "voices" };
        return { ok: true, stop: q };
      }
    }
    return { ok: true, stop: null };
  };

  // ---- loading (once per file) ----
  const useWA = () => SFX.ctx && typeof location !== "undefined" && /^https?:/.test(location.protocol);
  function load(key, urls) {
    let e = SFX.cache[key]; if (e) return e;
    e = SFX.cache[key] = { state: "pending", buf: null, el: null, url: null, abort: typeof AbortController !== "undefined" ? new AbortController() : null };
    const tryUrl = (i) => {
      if (SFX.cache[key] !== e) return;
      if (i >= urls.length) { e.state = "missing"; return; }
      const url = G.Assets ? G.Assets.url(urls[i]) : urls[i]; SFX.requests[url] = (SFX.requests[url] || 0) + 1; e.url = url;
      if (useWA()) {
        fetch(url, e.abort ? { signal: e.abort.signal } : undefined).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
          .then((ab) => SFX.ctx.decodeAudioData(ab)).then((buf) => { if (SFX.cache[key] !== e) return; e.buf = buf; e.state = "ok"; SFX.onReady(key); })
          .catch(() => tryUrl(i + 1));
      } else {
        const el = new Audio(); e.loading = el; el.preload = "auto";
        el.addEventListener("canplaythrough", () => { if (SFX.cache[key] === e && e.state === "pending") { e.loading = null; e.el = el; e.state = "ok"; SFX.onReady(key); } }, { once: true });
        el.addEventListener("error", () => { if (SFX.cache[key] === e && e.state === "pending") tryUrl(i + 1); }, { once: true });
        el.src = url; el.load();
      }
    };
    tryUrl(0);
    return e;
  }
  const sfxUrls = (key) => [base() + ((A().sfx[key] || {}).path || A().sfxPath) + key + A().ext];   // path: a key filed elsewhere (Snare's stinger_roll in music/)
  const loopUrls = (key) => {
    const exts = A().loopExts.filter((x) => !(x === ".ogg" && hasDom && !(new Audio()).canPlayType("audio/ogg")));
    return exts.map((x) => base() + A().ambPath + key + x);
  };
  SFX.status = (key) => ((A().sfx[key] || {}).pending ? "pending (no file yet)" : SFX.cache[key] ? SFX.cache[key].state : "not loaded");
  SFX.onReady = function (key) {
    const e = SFX.cache[key], w = e && e.stingWant; if (w) { e.stingWant = null; if (now() - w.at <= (ST().lateMs ?? 800)) startSting(key, e, w.opts); }
    if (SFX.vol("ambient") > 0 && A().loops[key] && SFX.wantLoop === key && (!SFX.amb || SFX.amb.key !== key)) SFX.startLoop(key); };

  // ---- one-shot SFX ----
  SFX.play = function (key, opts) {
    if (!key || !SFX.enabled) return false;
    opts = opts || {};
    const def = A().sfx[key] || { vol: 0.7 }, vol = (def.vol ?? 0.7) * (opts.vol ?? 1) * SFX.vol("sfx"), t = now();
    SFX.played.push(key); if (SFX.played.length > 50) SFX.played.shift();   // debug / tests: what the game asked for
    if (!A().sfx[key] || def.pending) return false;   // unknown keys and pending files are silent (never requested)
    if (def.sting) return SFX.sting(key, opts);        // Snare's stingers: one at a time, with the music duck (below)
    if (!hasDom || !SFX.unlocked || vol <= 0) return false;
    const e = load(key, sfxUrls(key));
    if (e.state !== "ok") return false;
    const adm = SFX.admit(key, vol, t); if (!adm.ok) return false;
    if (adm.stop) { try { adm.stop.stop(); } catch (x) {} SFX.guns = SFX.guns.filter((v) => v !== adm.stop); }
    SFX.last[key] = t;
    const rate = def.noPitch ? 1 : 1 + (Math.random() * 2 - 1) * A().pitchVar;   // noPitch: musical one-shots stay in key
    let voice;
    try {
      if (e.buf && SFX.ctx) {
        const src = SFX.ctx.createBufferSource(), g = SFX.ctx.createGain(); src.buffer = e.buf; src.playbackRate.value = rate; g.gain.value = vol;
        src.connect(g); g.connect(SFX.bus || SFX.master); src.start();
        voice = { vol, end: t + (e.buf.duration / rate) * 1000, stop: () => src.stop() };
      } else if (e.el) {
        const B = A().bus || {}, att = def.group === "gun" && B.htmlGunAtten ? 1 / Math.sqrt(1 + SFX.guns.filter((v) => v.end > t).length) : 1;   // no limiter without Web Audio
        const n = e.el.cloneNode(); n.volume = Math.min(1, vol * att * (B.gain ?? 1)); n.preservesPitch = false; n.playbackRate = rate; n.play().catch(() => {});
        voice = { vol, end: t + ((e.el.duration || 0.5) / rate) * 1000, stop: () => n.pause() };
      }
    } catch (x) { return false; }
    if (voice && def.group === "gun") SFX.guns.push(voice);
    return true;
  };

  // ---- Snare's stingers (assets/music_src/README_stingers.md, README_heat_reveal.md; data/audio.js stingers) ----
  // Keys marked sting: true. They are music: silent and never fetched while the music is off (G.Music.gain() 0: the
  // per-visit Music toggle or Mute) or the SFX slider is 0, and they ride the SFX bus at Snare's levels.
  // One at a time: a higher-priority sting fades the playing one out (fadeMs, never a hard cut); otherwise the new one is
  // skipped. A sting asked for before its file is decoded plays when it lands, if that is within lateMs (else it's
  // dropped: a late sting is worse than none). oneShot: the decoded buffer is dropped once the sting ends, so stingers
  // never sit in memory (SFX.preloadStings decodes them just before they can fire: a battle, an extraction attempt).
  // Music: duck (the music bus to `to` over `attack` s, held through the sting, back over `release` s) or out (the zone /
  // battle music fades out over `fade` s and the next track starts from its top `lead` s before the sting ends:
  // G.Music.stingOut).
  SFX.stingNow = null; SFX.stingLog = [];
  const ST = () => A().stingers || {};
  SFX.stingAudible = () => SFX.vol("sfx") > 0 && !!(G.Music && G.Music.gain() > 0);
  SFX.preloadStings = function (keys) {
    if (!hasDom || !SFX.unlocked || !SFX.enabled || !SFX.stingAudible()) return 0;
    let n = 0; for (const k of keys) { const d = A().sfx[k]; if (d && d.sting && !d.pending) { load(k, sfxUrls(k)); n++; } } return n;
  };
  SFX.stingPrio = (key) => (ST().priority || []).indexOf(key);
  SFX.sting = function (key, opts) {
    opts = opts || {};
    const def = A().sfx[key] || {}, t = now();
    if (!def.sting || def.pending || !SFX.enabled) return false;
    if (!hasDom || !SFX.unlocked || !SFX.stingAudible()) return false;   // muted: nothing fetched
    const cur = SFX.stingNow && SFX.stingNow.end > t ? SFX.stingNow : null;
    if (cur && SFX.stingPrio(key) <= SFX.stingPrio(cur.key)) { SFX.stingLog.push({ key, skipped: cur.key }); return false; }
    const e = load(key, sfxUrls(key));
    if (e.state === "missing") return false;
    if (e.state !== "ok") { e.stingWant = { at: t, opts }; return "queued"; }
    return startSting(key, e, opts);
  };
  function startSting(key, e, opts) {
    const def = A().sfx[key] || {}, t = now(), vol = (def.vol ?? 1) * (opts.vol ?? 1) * SFX.vol("sfx");
    if (vol <= 0 || !SFX.stingAudible()) return false;
    const cur = SFX.stingNow && SFX.stingNow.end > t ? SFX.stingNow : null;
    if (cur) { if (SFX.stingPrio(key) <= SFX.stingPrio(cur.key)) return false; cur.fade((ST().fadeMs ?? 80) / 1000); }
    const dur = e.buf ? e.buf.duration : (e.el && e.el.duration) || 4;
    let stop, fade;
    try {
      if (e.buf && SFX.ctx) {
        const c = SFX.ctx, src = c.createBufferSource(), g = c.createGain(); src.buffer = e.buf; g.gain.value = vol;
        src.connect(g); g.connect(SFX.bus || SFX.master); src.start();
        stop = () => { try { src.stop(); } catch (x) {} };
        fade = (sec) => { const t0 = c.currentTime; g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(g.gain.value, t0); g.gain.linearRampToValueAtTime(0, t0 + sec); try { src.stop(t0 + sec + 0.02); } catch (x) {} };
      } else if (e.el) {
        const n = e.el.cloneNode(); n.volume = Math.min(1, vol * ((A().bus || {}).gain ?? 1)); n.play().catch(() => {});
        stop = () => n.pause(); fade = (sec) => { const v0 = n.volume, t0 = now(); const id = setInterval(() => { const f = Math.min(1, (now() - t0) / (sec * 1000)); n.volume = v0 * (1 - f); if (f >= 1) { clearInterval(id); n.pause(); } }, 20); };
      } else return false;
    } catch (x) { return false; }
    const s = SFX.stingNow = { key, start: t, end: t + dur * 1000, dur, stop, fade: (sec) => { s.end = now(); fade(sec); } };
    SFX.last[key] = t; SFX.stingLog.push({ key, at: t, dur }); if (SFX.stingLog.length > 40) SFX.stingLog.shift();
    const D = ST(), duck = (D.duck || {})[key], out = (D.out || {})[key];
    if (G.Music) { if (duck) G.Music.duck(duck.to, duck.attack, duck.hold ?? dur, duck.release); else if (out) G.Music.stingOut(dur, out); }   // (again at the start: a sting that landed late moves the hold)
    setTimeout(() => {   // oneShot: drop the decoded buffer once it has played (unless another play of it is running)
      if (SFX.stingNow === s) SFX.stingNow = null;
      if (def.oneShot && SFX.cache[key] === e) delete SFX.cache[key];
    }, dur * 1000 + 100);
    return true;
  }
  // the extraction stings come after a die / a sound effect: G.Music's part (the fade out) starts now, the sting at delayMs
  SFX.stingLater = function (key, delayMs, opts) {
    opts = opts || {};
    if (!SFX.stingAudible() || !(A().sfx[key] || {}).sting) return false;
    SFX.preloadStings([key]);
    const out = (ST().out || {})[key];
    if (out && G.Music && hasDom && SFX.unlocked) { G.Music.stingOut(((delayMs || 0) / 1000) + (out.durSec || 4), out); opts = Object.assign({}, opts, { musicOut: true }); }
    setTimeout(() => SFX.sting(key, opts), delayMs || 0);
    return true;
  };

  // ---- ambient loops: one per screen, 1 s crossfade ----
  SFX.setScreen = function (screen) {
    const key = A().screens[screen]; SFX.screen = screen; SFX.wantLoop = key;
    if (SFX.loopOff(key)) { if (SFX.amb) { SFX.amb.fadeOut(); SFX.amb = null; } SFX.wantLoop = null; return; }   // a loop switched off in data (never loaded)
    if (!hasDom || !SFX.unlocked || !SFX.enabled || SFX.vol("ambient") <= 0) return;
    if (SFX.amb && SFX.amb.key === key) { SFX.amb.setVol(SFX.loopVol(key)); return; }
    const e = load(key, loopUrls(key)); if (e.state === "ok") SFX.startLoop(key);
  };
  SFX.loopOff = (key) => !key || !!(A().loops[key] || {}).off;
  SFX.loopVol = (key) => ((A().loops[key] || {}).vol ?? 0.8) * SFX.vol("ambient");
  SFX.startLoop = function (key) {
    const e = SFX.cache[key], fade = A().crossfadeSec, v = SFX.loopVol(key), old = SFX.amb;
    if (!e || e.state !== "ok") return;
    let voice;
    if (e.buf && SFX.ctx) {
      const src = SFX.ctx.createBufferSource(), g = SFX.ctx.createGain(), t0 = SFX.ctx.currentTime; src.buffer = e.buf; src.loop = true;   // gapless
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + fade); src.connect(g); g.connect(SFX.master); src.start();
      voice = { key, setVol: (x) => g.gain.setTargetAtTime(x, SFX.ctx.currentTime, 0.1), fadeOut: () => { const t = SFX.ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); src.stop(t + fade + 0.05); } };
    } else if (e.el) {
      const n = e.el.cloneNode(); n.loop = true; n.volume = 0; n.play().catch(() => {});
      const ramp = (from, to, done) => { const t0 = now(); const id = setInterval(() => { const f = Math.min(1, (now() - t0) / (fade * 1000)); n.volume = Math.max(0, Math.min(1, from + (to - from) * f)); if (f >= 1) { clearInterval(id); if (done) done(); } }, 50); };
      ramp(0, v);
      voice = { key, setVol: (x) => { n.volume = Math.max(0, Math.min(1, x)); }, fadeOut: () => ramp(n.volume, 0, () => n.pause()) };
    }
    if (old) old.fadeOut();
    SFX.amb = voice;
  };
  SFX.cancelMutedLoads = function () {
    for (const key of Object.keys(SFX.cache)) {
      const e = SFX.cache[key], sting = !!(A().sfx[key] || {}).sting;
      if (e.state !== "pending" || (sting ? SFX.stingAudible() : SFX.vol(A().loops[key] ? "ambient" : "sfx") > 0)) continue;   // a sting's download stops when the music goes off
      delete SFX.cache[key]; if (e.abort) e.abort.abort();
      if (e.loading) { e.loading.pause(); if (e.loading.removeAttribute) e.loading.removeAttribute("src"); e.loading.load(); }
    }
  };
  SFX.applySettings = function () { SFX.cancelMutedLoads(); if (SFX.screen) SFX.setScreen(SFX.screen); if (SFX.amb) SFX.amb.setVol(SFX.loopVol(SFX.amb.key)); if (G.Music) G.Music.applySettings(); };   // music: js/music.js, its own channel

  // SFX bus: gain -> limiter -> master (loops connect to the master directly)
  SFX.makeBus = function (ctx, out) {
    const B = A().bus || {}, g = ctx.createGain(); g.gain.value = B.gain ?? 1;
    if (B.limiter && ctx.createDynamicsCompressor) {
      const c = ctx.createDynamicsCompressor(), L = B.limiter;
      c.threshold.value = L.threshold; c.knee.value = L.knee; c.ratio.value = L.ratio; c.attack.value = L.attack; c.release.value = L.release;
      g.connect(c); c.connect(out); SFX.limiter = c;
    } else g.connect(out);
    return g;
  };
  // browsers only allow audio after a user gesture
  SFX.unlock = function () {
    if (SFX.unlocked) return; SFX.unlocked = true;
    try { const AC = root.AudioContext || root.webkitAudioContext; if (AC) { SFX.ctx = new AC(); SFX.master = SFX.ctx.createGain(); SFX.master.connect(SFX.ctx.destination); SFX.bus = SFX.makeBus(SFX.ctx, SFX.master); } } catch (x) { SFX.ctx = null; }
    if (SFX.screen) SFX.setScreen(SFX.screen);
    if (G.Music) G.Music.onUnlock();
  };
  // iOS Safari only lets audio start from a touchend / click (not touchstart / pointerdown), can hand back a suspended
  // context, and suspends it again after an interruption: every gesture resumes it, and the first one plays a 1-sample
  // silent buffer (the old iOS unlock). Cheap once it's running.
  SFX.resume = function () {
    SFX.unlock(); const c = SFX.ctx; if (!c) return;
    if (c.state !== "running" && c.resume) { try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (x) {} }
    if (!SFX._kicked) { SFX._kicked = true; try { const s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, 22050); s.connect(c.destination); s.start(0); } catch (x) {} }
  };
  if (hasDom) {
    for (const k of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) document.addEventListener(k, SFX.resume, { capture: true, passive: true });
    document.addEventListener("click", (ev) => { const b = ev.target && ev.target.closest && ev.target.closest("button"); if (b && !b.disabled && !b.dataset.nosfx) SFX.play("sfx_ui_click"); }, true);
  }
})(window);
