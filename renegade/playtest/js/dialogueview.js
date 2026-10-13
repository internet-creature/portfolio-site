// SP-157 / SP-192 / SP-004: the dialogue box (runner: js/dialogue.js) and the building tour (begin_building_introductions).
// The box sits centred toward the bottom of the screen; on a tour step it moves to the top while the ringed element
// would be under it. Clicks under it are blocked while it's open; the tour dims around the ring like the tutorial overlay.
(function (root) {
  if (typeof document === "undefined") return;
  const G = root.G, V = G.DialogueView = { open: false };
  const touch = () => !!(G.Touch && G.Touch.layout());
  const PAD = () => (DATA.tutorial.ringPadPx != null ? DATA.tutorial.ringPadPx : 6);
  V.mount = function (cls) {
    V.close();
    const el = V.el = document.createElement("div"); el.id = "dlg-root"; el.className = "dlg " + (cls || "");
    el.innerHTML = '<div class="dlg-block"></div><div class="dlg-ring"></div><div class="dlg-box bottom" role="dialog" aria-live="polite"><div class="dlg-panel"><div class="dlg-head" hidden></div><div class="dlg-speaker"></div><p class="dlg-text"></p><button class="dlg-next" data-act="dlg-next">CLICK TO CONTINUE</button></div><div class="dlg-choices"></div><div class="dlg-btns"><button class="dlg-skip" data-act="dlg-skip" hidden>Skip tour</button><span class="dlg-n"></span></div></div>';
    // SP-193: the whole panel continues (or finishes the typing line), like the CLICK TO CONTINUE prompt
    el.querySelector(".dlg-panel").addEventListener("click", (e) => { if (e.target.closest(".dlg-next")) return; e.stopPropagation(); if (V.finishTyping()) return; const b = el.querySelector(".dlg-next"); if (b && !b.hidden) b.click(); });
    for (const k of ["pointerdown", "mousedown", "click", "wheel"]) el.querySelector(".dlg-block").addEventListener(k, (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { passive: false });
    document.body.appendChild(el); V.open = true; if (G.UI.hideTip) G.UI.hideTip();
    window.addEventListener("keydown", V.onKey, true);
    return el;
  };
  V.close = function () {
    if (V.raf) cancelAnimationFrame(V.raf); V.raf = 0;
    if (V.tw) clearInterval(V.tw); V.tw = 0; V.typing = false; if (G.Chathead) G.Chathead.sleep();
    if (V.el) V.el.remove(); V.el = null; V.open = false; V.s = null; V.tourSteps = null;
    window.removeEventListener("keydown", V.onKey, true);
  };
  V.onKey = function (e) {
    if (!V.open || G.Util.typing(e)) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (e.repeat) return; if (V.finishTyping()) return; const b = V.el.querySelector(".dlg-next"); if (b && !b.hidden) b.click(); }
  };
  // ---- a dialogue tree ----
  V.start = function (id, after) {
    const el = V.mount("talk");
    V.after = after || null;
    V.s = G.Dialogue.start(id, { touch: touch(), onEnd: (s) => { const then = s.after, fin = V.after; V.close(); if (then) then(fin); else if (fin) fin(); } });
    el.dataset.dialogue = id;
    el.querySelector(".dlg-next").addEventListener("click", (e) => { e.stopPropagation(); if (V.finishTyping()) return; if (!V.s) return; G.Dialogue.next(V.s); V.paint(); });
    V.paint();
  };
  V.paint = function () {
    if (!V.s || !V.el) return;
    const c = G.Dialogue.cur(V.s); if (!c) return;
    const el = V.el, sp = el.querySelector(".dlg-speaker"), ch = el.querySelector(".dlg-choices"), next = el.querySelector(".dlg-next");
    el.dataset.node = c.node;
    sp.textContent = c.speaker || ""; sp.hidden = !c.speaker;
    ch.innerHTML = "";
    if (c.choices) for (const o of c.choices) {
      const b = document.createElement("button"); b.className = "dlg-choice"; b.dataset.choice = o.id; b.textContent = o.text;
      b.addEventListener("click", (e) => { e.stopPropagation(); if (G.Sfx && G.Sfx.play) G.Sfx.play("sfx_ui_click"); G.Dialogue.choose(V.s, o.id); V.paint(); });
      ch.appendChild(b);
    }
    next.hidden = !!c.choices;
    V.say(c.speakerId, c.text, !!c.choices);
  };
  // ---- SP-193: the typewriter + the talking chathead (timings: DATA.dialogue.box, speakers.js) ----
  // The line is laid out in full up front (the untyped rest is invisible), so words never jump lines while they type.
  // While typing: the head plays "talk", the choices / CLICK TO CONTINUE wait. Clicking finishes the line at once.
  // dialogue_blip: V.onBlip(speakerId, ch) per typed character, skipping spaces / punctuation, at most one per blipMinMs
  // (a hook for Snare; no audio yet). Reduced motion: the line shows at once.
  V.blips = 0; V.onBlip = null;
  // Press Start 2P is monospace (16 px a glyph at 2x), so a 510 px column holds 31 characters: lines are wrapped
  // by word here and shown three to a panel (Smudge's 3-line plate). A longer line pages: CLICK TO CONTINUE shows the
  // next three; choices wait for the last page.
  V.COLS = 31; V.ROWS = 3;
  V.pages = function (text) {
    const lines = [];
    for (const para of String(text || "").split("\n")) {
      let cur = "";
      for (let w of para.split(/ +/)) {
        while (w.length > V.COLS) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, V.COLS)); w = w.slice(V.COLS); }
        if (!cur) cur = w; else if (cur.length + 1 + w.length <= V.COLS) cur += " " + w; else { lines.push(cur); cur = w; }
      }
      lines.push(cur);
    }
    const out = []; for (let i = 0; i < lines.length; i += V.ROWS) out.push(lines.slice(i, i + V.ROWS).join("\n"));
    return out.length ? out : [""];
  };
  V.say = function (speakerId, text, hasChoices) {
    const el = V.el, head = el.querySelector(".dlg-head");
    const hasHead = G.Chathead ? G.Chathead.mount(head, speakerId) : false;
    el.classList.toggle("has-head", !!hasHead);
    V.full = String(text || ""); V.pageList = V.pages(V.full); V.pi = 0; V.hasChoices = hasChoices; V.speakerId = speakerId;
    el.querySelector(".dlg-choices").hidden = true;
    V.typePage();
  };
  V.typePage = function () {
    const el = V.el, B = (DATA.dialogue || {}).box || {}, t = el.querySelector(".dlg-text"), page = V.pageList[V.pi];
    if (V.tw) clearInterval(V.tw);
    t.innerHTML = '<span class="dlg-typed"></span><span class="dlg-rest"></span>';
    const typed = t.firstChild, rest = t.lastChild;
    V.page = page; V.n = 0; V.typing = true; el.dataset.typed = "0"; el.dataset.page = (V.pi + 1) + "/" + V.pageList.length;
    el.querySelector(".dlg-next").hidden = true;
    const show = () => { typed.textContent = page.slice(0, V.n); rest.textContent = page.slice(V.n); };
    if (G.Chathead) G.Chathead.talking(true);
    const cps = B.cps || 43, t0 = performance.now(); let lastBlip = 0;
    if (!cps || (G.Gfx && G.Gfx.reducedMotion && G.Gfx.reducedMotion())) { V.n = page.length; show(); return V.doneTyping(); }
    show();
    V.tw = setInterval(() => {
      const n = Math.min(page.length, Math.floor((performance.now() - t0) / 1000 * cps));
      for (let i = V.n; i < n; i++) { const ch = page[i], now = performance.now(); if (/[A-Za-z0-9]/.test(ch) && now - lastBlip >= (B.blipMinMs || 45)) { lastBlip = now; V.blips++; if (V.onBlip) V.onBlip(V.speakerId, ch); } }
      if (n !== V.n) { V.n = n; show(); }
      if (V.n >= page.length) V.doneTyping();
    }, 1000 / 60);
  };
  V.doneTyping = function () {
    if (V.tw) clearInterval(V.tw); V.tw = 0; V.typing = false;
    if (!V.el) return;
    const t = V.el.querySelector(".dlg-text"), last = V.pi >= V.pageList.length - 1; t.firstChild.textContent = V.page; t.lastChild.textContent = "";
    V.el.dataset.typed = last ? "1" : "page"; if (G.Chathead) G.Chathead.talking(false);
    V.el.querySelector(".dlg-choices").hidden = !last; V.el.querySelector(".dlg-next").hidden = last && !!V.hasChoices;
  };
  // a click / Enter: finish the typing page, or turn to the next page. true = handled (don't advance the dialogue)
  V.finishTyping = function () {
    if (V.typing) { V.n = V.page.length; V.doneTyping(); return true; }
    if (V.pageList && V.pi < V.pageList.length - 1) { V.pi++; V.typePage(); return true; }
    return false;
  };
  // ---- the building tour: one box per step, ring on its target, box out of the ring's way ----
  V.tour = function (id, after) {
    const steps = ((DATA.dialogue[id] || {}).tour || []).filter((st) => !!document.querySelector(st.target));
    if (!steps.length) { if (after) after(); return; }
    if (G.UI.panel) { G.UI.panel = null; G.UI.render(); }
    const el = V.mount("tour"); el.dataset.dialogue = id;
    V.tourSteps = steps; V.ti = 0; V.after = after || null;
    const skip = el.querySelector(".dlg-skip"); skip.hidden = false;
    const done = () => { const fin = V.after; V.close(); G.State.save(); G.UI.render(); if (fin) fin(); };
    skip.addEventListener("click", (e) => { e.stopPropagation(); done(); });
    el.querySelector(".dlg-next").addEventListener("click", (e) => { e.stopPropagation(); if (V.finishTyping()) return; if (++V.ti >= V.tourSteps.length) return done(); V.paintTour(); });
    V.paintTour();
    const loop = () => { if (!V.tourSteps) return; V.place(); V.raf = requestAnimationFrame(loop); }; V.raf = requestAnimationFrame(loop);
  };
  V.paintTour = function () {
    const st = V.tourSteps[V.ti], el = V.el, sp = el.querySelector(".dlg-speaker");
    el.dataset.step = st.id; sp.textContent = G.Dialogue.speaker(st.speaker) || ""; sp.hidden = !sp.textContent;
    el.querySelector(".dlg-n").textContent = `${V.ti + 1} / ${V.tourSteps.length}`;
    V.say(st.speaker, G.Dialogue.text(st.text, touch()), false);
    V.place();
  };
  V.rectOf = function (sel) {
    const els = [...document.querySelectorAll(sel)].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!els.length) return null;
    const rs = els.map((x) => x.getBoundingClientRect()), p = PAD();
    const l = Math.min(...rs.map((r) => r.left)) - p, t = Math.min(...rs.map((r) => r.top)) - p, r = Math.max(...rs.map((r) => r.right)) + p, b = Math.max(...rs.map((r) => r.bottom)) + p;
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  };
  // the box goes to the top when the ring overlaps where it sits at the bottom (and back again when it doesn't)
  V.place = function () {
    if (!V.el || !V.tourSteps) return;
    const ring = V.el.querySelector(".dlg-ring"), box = V.el.querySelector(".dlg-box"), R = V.rectOf(V.tourSteps[V.ti].target);
    if (!R) { ring.style.display = "none"; return; }
    ring.style.display = ""; Object.assign(ring.style, { left: R.left + "px", top: R.top + "px", width: R.width + "px", height: R.height + "px" });
    const bw = box.offsetWidth, bh = box.offsetHeight, W = innerWidth, H = innerHeight, m = 24;
    const bottom = { left: (W - bw) / 2, right: (W + bw) / 2, top: H - m - bh, bottom: H - m };
    const hit = R.left < bottom.right && R.right > bottom.left && R.top < bottom.bottom && R.bottom > bottom.top;
    // a ring big enough to cover both spots (the whole hideout): stay at the bottom
    const top = { left: bottom.left, right: bottom.right, top: m, bottom: m + bh }, hitTop = R.left < top.right && R.right > top.left && R.top < top.bottom && R.bottom > top.top;
    const up = hit && !hitTop;
    box.classList.toggle("top", up); box.classList.toggle("bottom", !up); V.el.dataset.boxAt = up ? "top" : "bottom";
  };
})(typeof window !== "undefined" ? window : globalThis);
