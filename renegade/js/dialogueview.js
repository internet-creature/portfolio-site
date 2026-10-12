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
    el.innerHTML = '<div class="dlg-block"></div><div class="dlg-ring"></div><div class="dlg-box bottom" role="dialog" aria-live="polite"><div class="dlg-speaker"></div><p class="dlg-text"></p><div class="dlg-choices"></div><div class="dlg-btns"><button class="dlg-skip" data-act="dlg-skip" hidden>Skip tour</button><span class="dlg-n"></span><button class="primary dlg-next" data-act="dlg-next">Next</button></div></div>';
    for (const k of ["pointerdown", "mousedown", "click", "wheel"]) el.querySelector(".dlg-block").addEventListener(k, (e) => { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }, { passive: false });
    document.body.appendChild(el); V.open = true; if (G.UI.hideTip) G.UI.hideTip();
    window.addEventListener("keydown", V.onKey, true);
    return el;
  };
  V.close = function () {
    if (V.raf) cancelAnimationFrame(V.raf); V.raf = 0;
    if (V.el) V.el.remove(); V.el = null; V.open = false; V.s = null; V.tourSteps = null;
    window.removeEventListener("keydown", V.onKey, true);
  };
  V.onKey = function (e) {
    if (!V.open || G.Util.typing(e)) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (e.repeat) return; const b = V.el.querySelector(".dlg-next"); if (b && !b.hidden) b.click(); }
  };
  // ---- a dialogue tree ----
  V.start = function (id, after) {
    const el = V.mount("talk");
    V.after = after || null;
    V.s = G.Dialogue.start(id, { touch: touch(), onEnd: (s) => { const then = s.after, fin = V.after; V.close(); if (then) then(fin); else if (fin) fin(); } });
    el.dataset.dialogue = id;
    el.querySelector(".dlg-next").addEventListener("click", (e) => { e.stopPropagation(); if (!V.s) return; G.Dialogue.next(V.s); V.paint(); });
    V.paint();
  };
  V.paint = function () {
    if (!V.s || !V.el) return;
    const c = G.Dialogue.cur(V.s); if (!c) return;
    const el = V.el, sp = el.querySelector(".dlg-speaker"), ch = el.querySelector(".dlg-choices"), next = el.querySelector(".dlg-next");
    el.dataset.node = c.node;
    sp.textContent = c.speaker || ""; sp.hidden = !c.speaker; el.querySelector(".dlg-text").textContent = c.text;
    ch.innerHTML = "";
    if (c.choices) for (const o of c.choices) {
      const b = document.createElement("button"); b.className = "dlg-choice"; b.dataset.choice = o.id; b.textContent = o.text;
      b.addEventListener("click", (e) => { e.stopPropagation(); if (G.Sfx && G.Sfx.play) G.Sfx.play("sfx_ui_click"); G.Dialogue.choose(V.s, o.id); V.paint(); });
      ch.appendChild(b);
    }
    next.hidden = !!c.choices;
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
    el.querySelector(".dlg-next").addEventListener("click", (e) => { e.stopPropagation(); if (++V.ti >= V.tourSteps.length) return done(); V.paintTour(); });
    V.paintTour();
    const loop = () => { if (!V.tourSteps) return; V.place(); V.raf = requestAnimationFrame(loop); }; V.raf = requestAnimationFrame(loop);
  };
  V.paintTour = function () {
    const st = V.tourSteps[V.ti], el = V.el, sp = el.querySelector(".dlg-speaker");
    el.dataset.step = st.id; sp.textContent = G.Dialogue.speaker(st.speaker) || ""; sp.hidden = !sp.textContent;
    el.querySelector(".dlg-text").textContent = G.Dialogue.text(st.text, touch());
    el.querySelector(".dlg-n").textContent = `${V.ti + 1} / ${V.tourSteps.length}`;
    el.querySelector(".dlg-next").textContent = V.ti === V.tourSteps.length - 1 ? "Got it" : "Next";
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
