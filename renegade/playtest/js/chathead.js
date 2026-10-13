// SP-193: the dialogue box portrait. A speaker with a head (data/dialogue/speakers.js) gets Smudge's talking 3D
// chathead (js/chathead3d.js, one shared WebGL renderer); with no WebGL, a failed load, or before it's ready it shows
// the placeholder badge (the speaker's letter). G.Chathead.mount(host, speakerId) / talking(bool) / sleep().
(function (root) {
  if (typeof document === "undefined") return;
  const G = root.G, C = G.Chathead = { MODULE: "js/chathead3d.js", mod: null, failed: null, mode: null };
  let loadP = null;
  const H = () => (DATA.dialogue || {}).heads || {}, B = () => (DATA.dialogue || {}).box || {};
  C.webgl = () => (G.Gfx && G.Gfx.webgl ? G.Gfx.webgl() : !!root.WebGLRenderingContext);
  C.load = function () {
    if (!loadP) loadP = import(new URL(C.MODULE, document.baseURI).href).then((m) => (C.mod = m), (e) => { loadP = null; throw e; });
    return loadP;
  };
  C.url = (file) => ((DATA.sprites && DATA.sprites.basePath) || "assets/") + file;
  // fill `host` (the .dlg-head element) for a speaker; returns false when the speaker has no portrait
  C.mount = function (host, id) {
    const h = H()[id]; C.cur = id;
    if (!h) { host.hidden = true; host.innerHTML = ""; C.mode = null; return false; }
    host.hidden = false; host.dataset.speaker = id;
    const live = host.querySelector(".dlg-head-gl");
    if (live && host.dataset.head === h.file && C.mode === "3d") return true;   // same head, same box: keep drawing it
    host.dataset.head = h.file;
    host.innerHTML = '<span class="dlg-badge"></span>'; host.firstChild.textContent = h.badge || String(id || "?").charAt(0).toUpperCase();
    C.mode = "badge";
    if (C.failed || !C.webgl()) { C.failed = C.failed || "no-webgl"; host.dataset.mode = "badge"; return true; }
    host.dataset.mode = "loading";
    C.load().then((m) => m.show(C.url(h.file), { px: B().portraitPx || 128, blinkSec: B().blinkSec }))
      .then((canvas) => {
        if (!host.isConnected || C.cur !== id || host.dataset.head !== h.file) return;
        host.innerHTML = ""; host.appendChild(canvas); host.dataset.mode = "3d"; C.mode = "3d";
        if (C.wantTalk) C.mod.setTalking(true);
      })
      .catch((e) => { C.failed = String((e && e.message) || e); host.dataset.mode = "badge"; if (root.console) console.warn("[chathead] 3D head unavailable, showing the badge:", C.failed); });
    return true;
  };
  C.talking = function (on) { C.wantTalk = !!on; if (C.mod && C.mode === "3d") C.mod.setTalking(!!on, B().talkFadeSec); };
  C.sleep = function () { C.wantTalk = false; C.cur = null; if (C.mod) C.mod.sleep(); };
  C.state = () => Object.assign({ mode: C.mode, failed: C.failed }, C.mod ? C.mod.state() : {});
})(typeof window !== "undefined" ? window : globalThis);
