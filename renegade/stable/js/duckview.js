// SP-216: the duck parade leaving an Area (presentation only: js/duckparade.js records that they've gone). Right after the
// bush's first search or boop, the momma duck leads her ducklings (drawn smaller) in a line from the bush to the Area's
// nearest way out, round what's in the way (js/areapath.js), and each one vanishes there. Positions come from the clock,
// so a re-render mid-walk picks the line up where it was; nothing is saved, so after a reload they're simply gone. The
// ducks take no input (pointer-events: none): they never cover an object or an exit for a click or a tap (the critter tap
// rule in assets/critters/critters_manifest.json). Reduced motion: no walk (the toast says they left).
(function (root) {
  const G = root.G, SP = G.Sprites;
  const DV = G.DuckView = { walk: null };
  const VW = 1000, VH = 600;
  const C = () => DATA.mapsV2.duckParade.view;
  const now = () => performance.now();
  const still = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const keyOf = (site) => site.key || site.nid;

  // bush -> the nearest way out in an open room (round the furniture where there's a path), else straight down off the floor
  DV.route = function (site, o) {
    const X = G.Exp, from = { x: o.x, y: o.y }, d = (q) => Math.hypot(q.x - o.x, q.y - o.y);
    const outs = site.objects.filter((q) => (q.kind === "exit" || q.kind === "areaExit") && X.roomOpen(site, q.room)).sort((a, b) => d(a) - d(b));
    const to = outs.length ? { x: outs[0].x, y: outs[0].y } : { x: o.x, y: VH };
    const pts = [from].concat(G.AreaPath.findPath(site, from, to) || [], [to]);
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, lens, total: lens[lens.length - 1] };
  };
  // where along the route distance s is, and which way that leg faces
  function at(rt, s) {
    let i = 1; while (i < rt.pts.length - 1 && rt.lens[i] < s) i++;
    const a = rt.pts[i - 1], b = rt.pts[i], seg = rt.lens[i] - rt.lens[i - 1], f = seg > 0 ? (s - rt.lens[i - 1]) / seg : 1;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, west: b.x < a.x };
  }

  // the logic said n ducks just came out of bush o
  DV.play = function (site, o, n) {
    if (still()) return;
    DV.walk = Object.assign({ key: keyOf(site), n, t0: now() }, DV.route(site, o));
  };

  // SiteView.render hands over each freshly built view
  DV.attach = function (wrap, site) {
    const w = DV.walk; if (!w || w.key !== keyOf(site)) return;
    const V = C(), els = [];
    for (let i = 0; i < w.n; i++) {
      const px = i ? V.momPx * V.ducklingScale : V.momPx;
      const el = document.createElement("div"); el.className = "duck-walker" + (i ? " duckling" : ""); el.hidden = true;
      el.style.width = (px / VW * 100) + "%";
      el.appendChild(SP.icon("critter_duck", px, "duck-art"));
      wrap.appendChild(el); els.push(el);
    }
    let shown = false;
    const step = () => {
      const s = (now() - w.t0) / 1000 * V.speedPx;
      if (s - (w.n - 1) * V.gapPx > w.total) { els.forEach((el) => el.remove()); if (DV.walk === w) DV.walk = null; return; }   // the last one is through
      // UI.render builds the view off the page: wait for it to land; once it's been replaced, the next attach carries on
      if (!wrap.isConnected) { if (!shown) requestAnimationFrame(step); return; }
      shown = true;
      els.forEach((el, i) => {
        const d = s - i * V.gapPx;
        if (d < 0 || d > w.total) { el.hidden = true; return; }   // still in the bush, or through the way out
        const p = at(w, d);
        el.hidden = false; el.style.left = (p.x / VW * 100) + "%"; el.style.top = (p.y / VH * 100) + "%";
        if (site.art) el.style.zIndex = Math.round(p.y);
        el.firstChild.style.transform = `scaleX(${p.west ? -1 : 1}) rotate(${(Math.sin(d / 5) * V.waddleDeg).toFixed(1)}deg)`;   // the art faces east
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
})(window);
