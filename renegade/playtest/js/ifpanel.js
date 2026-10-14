// SP-200 (slice 1 of the SP-198 / SP-199 interface panel): the in-run right panel as one fixed riveted-steel panel built
// into the game frame (Smudge's v1.3 mock, /workspace/sp199_panel): minimap, status strip, 6 tab buttons, tab body.
// This file is the model (headless: tests/ifpanel.js) plus the DOM bits that aren't plain sections; js/ui.js
// renderExpedition still builds every section and hands them to IP.el, which routes them into the tabs.
// Nothing here is saved: the open tab and the minimap view live in IP.ui (memory only, reset on reload).
(function (root) {
  const G = root.G;
  const IP = G.IfPanel = {};
  IP.TABS = [
    { id: "squad", label: "Squad", tip: "Squad: your body and Grunts, HP, Heal" },
    { id: "pack", label: "Pack", tip: "Pack: worn gear, Backup set, Bag, resources, Secure Pouch" },
    { id: "map", label: "Map", tip: "Map: objectives, what's here, Sweep, getting out" },
    { id: "skills", label: "Skills", tip: "Skills: the squad's skill levels used by checks" },
    { id: "log", label: "Log", tip: "Log: everything that happened (scrolls)" },
    { id: "settings", label: "Settings", tip: "Settings" }
  ];
  IP.VIEWS = ["zone", "map", "area"];
  // tab icons: Smudge's 11x11 1-bit glyphs, copied from /workspace/sp199_panel/panel.py ICONS (the v1 concept's tab row)
  IP.ICONS = {
    squad: ["...xx......", "..xxxx.....", "..xxxx..xx.", "...xx..xxxx", ".xxxxx.xxxx", "xxxxxxx.xx.", "xxxxxxxxxxx", "xx.xx.xxxxx", "xx.xx.xx.xx", "...xx......", "..xx.xx...."],
    pack: ["....xxx....", "...x...x...", ".xxxxxxxxx.", "xx.......xx", "xx.xxxxx.xx", "xx.x...x.xx", "xx.xxxxx.xx", "xx.......xx", "xx.......xx", "xxxxxxxxxxx", ".xxxxxxxxx."],
    map: ["xx...xx....", "x.xxx.x.xxx", "x..x..xx..x", "x..x..x...x", "x.x...x.x.x", "x..x..x..xx", "x..xx.x...x", "x...x.x.x.x", "x..x..x...x", "xxx.xx.xx.x", "...xx...xxx"],
    skills: [".....x.....", ".....x.....", "....xxx....", "xxxxxxxxxxx", ".xxxxxxxxx.", "..xxxxxxx..", "...xxxxx...", "..xxx.xxx..", "..xx...xx..", ".xx.....xx.", ".x.......x."],
    log: [".xxxxxxxxx.", "x.........x", ".xxxxxxxxx.", ".x.......x.", ".x.xxxxx.x.", ".x.......x.", ".x.xxxx..x.", ".x.......x.", ".x.xxxxx.x.", ".xxxxxxxxx.", "x.........x"],
    settings: ["....xxx....", ".x.xxxxx.x.", "..xxxxxxx..", ".xxx...xxx.", "xxx.....xxx", "xxx.....xxx", "xxx.....xxx", ".xxx...xxx.", "..xxxxxxx..", ".x.xxxxx.x.", "....xxx...."]
  };
  IP.iconSvg = function (id) {
    let d = ""; IP.ICONS[id].forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === "x") d += `M${x} ${y}h1v1h-1z`; });
    return `<svg class="ifp-ico" viewBox="0 0 11 11" width="22" height="22" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}"/></svg>`;
  };
  IP.textLabels = () => !!(G.state && G.state.settings && G.state.settings.textTabLabels);   // Settings tab: "Text tab labels" (accessibility)
  IP.ui = { tab: "squad", view: null };   // view null = automatic (MAP inside an Area Map, ZONE elsewhere)
  // desktop only for now (Megan: desktop first); the phone layout keeps the old scrolling column
  IP.enabled = () => !(DATA.config.ifPanel && DATA.config.ifPanel.enabled === false) && !(G.Touch && G.Touch.layout && G.Touch.layout());

  const run = () => G.state && G.state.run;
  const V2 = () => G.V2 && G.V2.on && G.V2.on();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // which minimap views exist right now: ZONE always in a run; MAP when the Map you're on has walkable Areas; AREA is slice 2
  IP.views = function () {
    const r = run(); if (!r) return { zone: false, map: false, area: false };
    return { zone: true, map: !!(V2() && G.V2.isAreaMap(r.loc)), area: false };
  };
  IP.autoView = function () { const r = run(), v = IP.views(); return v.map && G.Exp.inSite() ? "map" : "zone"; };
  IP.view = function () { const v = IP.views(), w = IP.ui.view; return w && v[w] ? w : IP.autoView(); };

  // ZONE view: the zone's Maps as nodes at their map positions (0..1), the edges between them.
  // state: here | visited | known (seen / scouted, not visited) | fog (next to somewhere you've been, not yet seen: "???")
  IP.zoneModel = function () {
    const r = run(), map = G.Zones.map(), X = G.Exp, nodes = [], byId = {};
    const known = (nid) => nid === map.insertion || X.discovered(nid) || !!r.visited[nid];
    const add = (nid, state) => {
      const n = map.nodes[nid], loc = G.Map.loc(n);
      let exit = false;
      if (state !== "fog" && loc) {
        if (V2() && G.V2.inst(nid, false)) { const I = G.V2.extractInfo(nid); exit = I.category !== "none" && !(I.category === "legacy" && !I.open); }
        else exit = !!loc.extraction && X.extractionOpen(n);
      }
      const o = { id: nid, x: n.x / 1000, y: n.y / 600, state, label: state === "fog" ? "???" : nid === map.insertion ? "Drop point" : G.Map.label(n), exit, here: r.loc === nid,
        reachable: state !== "fog" && nid !== r.loc && !!(X.canMoveTo && X.canMoveTo(nid)) };
      nodes.push(o); byId[nid] = o;
    };
    // Megan (Oct 13, PR #44): only the Maps connected to the current one, plus the current one; an unseen neighbour is "???"
    add(r.loc, "here");
    for (const m of G.Map.neighbors(map, r.loc)) if (!byId[m] && map.nodes[m]) add(m, r.visited[m] ? "visited" : known(m) ? "known" : "fog");
    const links = map.edges.filter((e) => byId[e[0]] && byId[e[1]] && (e[0] === r.loc || e[1] === r.loc)).map((e) => ({ a: e[0], b: e[1], fog: byId[e[0]].state === "fog" || byId[e[1]].state === "fog" }));
    const zd = DATA.zones.list[r.zone];
    return { view: "zone", title: zd ? zd.name : "", nodes, links };
  };

  // MAP view: the current Map's Areas. Area defs carry no positions, so they're laid out by link distance from the entry
  // Area (columns left to right, the way you came in on the left). seen Areas are named; an unseen Area linked to a seen one
  // is fogged "?"; the rest aren't drawn. Exits: a Peaceful Map gets out from any Area (marked on the Map, not an Area);
  // a Contested Map marks the Area of each revealed extraction opportunity (ready, locked or wrecked).
  IP.mapModel = function (nid) {
    const r = run(); nid = nid || r.loc;
    const def = G.V2.areaDef(nid); if (!def) return null;
    const m = G.V2.inst(nid, false); if (!m) return null; const ids = Object.keys(def.areas), entry = G.V2.entryArea(def), cur = r.loc === nid ? G.V2.curArea(nid) : null;
    const depth = { [entry]: 0 }, order = [entry];
    for (let i = 0; i < order.length; i++) for (const b of G.V2.links(def, order[i])) if (depth[b] == null) { depth[b] = depth[order[i]] + 1; order.push(b); }
    for (const a of ids) if (depth[a] == null) { depth[a] = 0; order.push(a); }
    const cols = {}; for (const a of order) (cols[depth[a]] = cols[depth[a]] || []).push(a);
    const maxD = Math.max(...Object.keys(cols).map(Number));
    const seen = (a) => !!(m.seenAreas[a] || a === cur);
    const I = G.V2.extractInfo(nid), exitAreas = {};
    for (const o of I.opps || []) if (o.state !== "hidden") exitAreas[o.area] = o.state;
    const nodes = [];
    for (const a of order) {
      const st = a === cur ? "here" : seen(a) ? "visited" : G.V2.links(def, a).some(seen) ? "fog" : null;
      if (!st) continue;
      const col = cols[depth[a]], row = col.indexOf(a);
      nodes.push({ id: a, x: maxD ? 0.1 + 0.8 * depth[a] / maxD : 0.5, y: (row + 1) / (col.length + 1), state: st, label: st === "fog" ? "?" : G.Util.copy(def.areas[a].name),
        here: a === cur, entry: a === entry, exit: st !== "fog" && exitAreas[a] ? exitAreas[a] : false, reachable: !!(cur && a !== cur && IP.areaTarget(a)) });
    }
    const has = {}; for (const n of nodes) has[n.id] = n;
    const links = (def.links || []).filter((l) => has[l[0]] && has[l[1]]).map((l) => ({ a: l[0], b: l[1], fog: has[l[0]].state === "fog" || has[l[1]].state === "fog" }));
    const loc = G.Map.loc(G.Zones.node(nid));
    return { view: "map", title: loc ? loc.name : "", nodes, links, anyAreaExit: I.category === "peaceful" || !!I.finish, exitName: I.name || "" };
  };
  // the way through to Area aid from where you stand, if you can legally take it now: the current Area's exit object to it,
  // usable by the same rules the play window uses (G.Exp.objActions / objBlocked: a closed door, a fight in progress...)
  IP.areaTarget = function (aid) {
    const r = run(), X = G.Exp; if (!r || r.queue.length || !X.inSite() || !V2() || !G.V2.isAreaMap(r.loc)) return null;
    const site = X.site(); if (!site) return null;
    const o = site.objects.find((x) => x.kind === "areaExit" && x.to === aid); if (!o) return null;
    const acts = X.objActions(o); if (!acts.length || acts[0] !== "go" || X.objBlocked(o, site)) return null;
    return { o, acts };
  };
  // click on the MAP view: exactly what clicking that exit in the play window does (walk over to it, or step through)
  IP.goArea = function (aid) {
    const t = IP.areaTarget(aid); if (!t) return false;
    if (G.AreaWalk && G.AreaWalk.enabled && G.AreaWalk.enabled() && G.AreaWalk.s) G.AreaWalk.go(t.o); else G.UI.onSiteObject(t.o, t.acts);
    return true;
  };
  IP.model = function () { const v = IP.view(); return v === "map" ? IP.mapModel() : IP.zoneModel(); };

  // the status strip: HP, carry kg, Med Supplies charges (SP-194: the pouch pool), and the Extract button (enabled when you can get out right here, else
  // disabled with the reason as its tooltip: the authoritative line from G.V2.extractInfo / the legacy extraction point)
  IP.strip = function () {
    const r = run(), X = G.Exp, maxHp = X.maxBodyHp(), cap = X.capacity(), kg = X.carried();
    const out = { hp: r.bodyHp, maxHp, kg, cap, med: G.Med.charges(), extract: { label: "Extract", can: false, why: "", act: null } };
    const node = X.node(), loc = G.Map.loc(node), E = out.extract;
    if (V2() && loc && G.V2.inst(r.loc, false)) {
      const I = G.V2.extractInfo(r.loc);
      if (I.category === "occupied" && I.item) { E.label = "Escape"; E.can = !!I.canNow; E.act = "escape"; }
      else if (I.category === "peaceful" || I.finish) { E.can = !!I.canNow; E.act = "extract"; if (I.finish) E.label = "Finish"; }
      else if (I.category === "legacy" && I.open) { E.can = !!(I.canNow && X.canExtract()); E.act = "legacy"; }
      E.why = E.can ? "" : G.Util.copy(I.text || "No way out here.");
    } else if (loc && loc.extraction) {
      E.act = "legacy"; E.can = !!(X.extractionOpen(node) && X.canExtract()); E.why = E.can ? "" : X.wrecked(node) ? "Wrecked. Find another way out." : "No way out here right now.";
    } else E.why = loc ? "No way out on this Map." : "Find a way out on the map.";
    if (r.queue.length && E.can) { E.can = false; E.why = "Finish what's in front of you first."; }
    return out;
  };

  // Skills tab (slice 1: read-only): the deployed squad's skill levels, best first (what checks roll against)
  IP.skills = function () {
    const r = run(), body = G.Exp.body(), out = [];
    for (const k in DATA.skills) { const v = body.skills && body.skills[k]; const lvl = v ? (v.lvl || 0) : 0; if (DATA.skills[k].name) out.push({ id: k, name: DATA.skills[k].name, lvl }); }
    return out.sort((a, b) => b.lvl - a.lvl || a.name.localeCompare(b.name));
  };

  IP.setTextLabels = function (on) { G.state.settings.textTabLabels = !!on; G.State.save(); if (G.UI && G.UI.render) G.UI.render(); };
  // which tab a side section belongs to (js/ui.js tags each with data-ifp)
  IP.routes = { squad: "squad", carry: "pack", obj: "map", here: "map", sweep: "map", extract: "map", hint: "map", heat: "map", log: "log" };

  // ---------- DOM (browser only) ----------
  IP.minimapSvg = function (M, W, H) {
    // fit what's drawn to the well (display only): the known part of a zone is often one corner of it
    const xs = M.nodes.map((n) => n.x), ys = M.nodes.map((n) => n.y), span = (a) => { const lo = Math.min(...a), hi = Math.max(...a), d = Math.max(0.3, hi - lo), c = (lo + hi) / 2; return [c - d / 2, d]; };
    const [x0, dx] = xs.length ? span(xs) : [0, 1], [y0, dy] = ys.length ? span(ys) : [0, 1], P = 18;
    const px = (n) => [Math.round(P + 24 + ((n.x - x0) / dx) * (W - 2 * P - 48)), Math.round(P + 4 + ((n.y - y0) / dy) * (H - 2 * P - 8))], by = {};
    for (const n of M.nodes) by[n.id] = px(n);
    let s = `<svg class="mm-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" shape-rendering="crispEdges">`;
    for (const l of M.links) { const a = by[l.a], b = by[l.b]; s += `<line class="mm-link${l.fog ? " fog" : ""}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }
    for (const n of M.nodes) {
      const [x, y] = by[n.id], sz = n.here ? 9 : 7;
      s += `<g class="mm-node ${n.state}${n.reachable ? " reach" : ""}${n.exit ? " exit" : ""}" data-mm-node="${esc(n.id)}"><title>${esc(n.label)}${n.exit ? " (way out)" : ""}${n.here ? " (you are here)" : ""}</title>`;
      s += `<rect x="${x - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}"/>`;
      if (n.exit) s += `<rect class="mm-exit" x="${x + 6}" y="${y - 9}" width="5" height="7"/>`;
      if (n.here) s += `<rect class="mm-you" x="${x - 2}" y="${y - 2}" width="4" height="4"/>`;
      s += "</g>";
    }
    // names: drawn where they fit (inside the well, clear of other names and nodes), else only the hover tooltip
    const boxes = M.nodes.map((n) => { const [x, y] = by[n.id]; return [x - 6, y - 6, x + 6, y + 6]; }), hit = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    for (const n of M.nodes.slice().sort((a, b) => (b.here ? 1 : 0) - (a.here ? 1 : 0))) {
      const [x, y] = by[n.id], t = n.label.toUpperCase(), w = t.length * 8; let placed = false;
      for (const ty of [y + 18, y - 10]) { const tx = Math.round(x - w / 2), b = [tx, ty - 8, tx + w, ty]; if (tx < 2 || tx + w > W - 2 || ty - 8 < 12 || ty > H - 2) continue;
        const own = boxes.splice(M.nodes.indexOf(n), 1)[0]; const clear = !hit(b); boxes.splice(M.nodes.indexOf(n), 0, own);
        if (clear) { s += `<text class="mm-label${n.here ? " here" : ""}" data-mm-label="${esc(n.id)}" x="${tx}" y="${ty}">${esc(t)}</text>`; boxes.push(b); placed = true; break; } }
      for (const t2 of placed ? [] : IP.shortLabels(t)) {   // SP-204: a shortened name before none at all ("FRONT OFF.")
        const w2 = t2.length * 8;
        for (const ty of [y + 18, y - 10]) { const tx = Math.max(2, Math.min(W - 2 - w2, Math.round(x - w2 / 2))), b = [tx, ty - 8, tx + w2, ty]; if (ty - 8 < 12 || ty > H - 2) continue;
          const own = boxes.splice(M.nodes.indexOf(n), 1)[0]; const clear = !hit(b); boxes.splice(M.nodes.indexOf(n), 0, own);
          if (clear) { s += `<text class="mm-label short${n.here ? " here" : ""}" data-mm-label="${esc(n.id)}" x="${tx}" y="${ty}">${esc(t2)}</text>`; boxes.push(b); placed = true; break; } }
        if (placed) break;
      }
      if (!placed) s = s.replace(`data-mm-node="${esc(n.id)}">`, `data-mm-node="${esc(n.id)}" data-mm-tip-only="1">`);
    }
    return s + "</svg>";
  };

  // shorter forms of a minimap name, longest first: words over 5 letters cut to 4 + ".", then the first word alone, then
  // the first 6 letters ("FRONT OFFICE" -> "FRONT OFFI.", "FRONT", "FRONT.")
  IP.shortLabels = function (t) {
    const words = t.split(/\s+/).filter(Boolean), out = [];
    if (words.length > 1) out.push(words.map((w) => (w.length > 5 ? w.slice(0, 4) + "." : w)).join(" "), words[0]);
    if (t.length > 6) out.push(t.slice(0, 5) + ".");
    return out.filter((x, i) => x !== t && out.indexOf(x) === i);
  };
  // SP-204: squad HP + Heal rows, always on show under the status strip (model: logic; the view below draws it)
  IP.squadModel = function () {
    const r = run(), X = G.Exp, body = X.body(), maxHp = X.maxBodyHp(), med = G.Med.charges() > 0, out = [];
    out.push({ who: "body", name: body.name, hp: r.bodyHp, max: maxHp, alive: r.bodyHp > 0, canHeal: med && r.bodyHp > 0 && r.bodyHp < maxHp });
    r.squad.forEach((m, i) => { const mx = G.Battle.unitFromGrunt(m.g).maxHp; out.push({ who: i, name: G.Allies.name(m.g), hp: m.hp, max: mx, alive: m.hp > 0, canHeal: med && m.hp > 0 && m.hp < mx }); });
    return out;
  };
  IP.squadEl = function (h, bar, acts) {
    const box = h("div", { class: "ifp-squad", "data-ifp-squad": "1" });
    for (const m of IP.squadModel()) box.appendChild(h("div", { class: "ifp-sqrow" + (m.alive ? "" : " dead"), "data-sq": String(m.who) },
      h("span", { class: "ifp-sqname" }, m.name.toUpperCase()),
      m.alive ? bar(m.hp / m.max, "#5fd35f", `${Math.ceil(m.hp)}/${Math.round(m.max)}`) : h("span", { class: "ifp-dead" }, "DEAD"),
      m.alive ? h("button", { class: "ifp-btn", "data-act": "ifp-heal", disabled: !m.canHeal, title: m.canHeal ? "Field heal: 1 Med Supplies charge" : "No heal needed or no charges",
        onclick: () => acts.heal && acts.heal(m.who) }, "HEAL") : null));
    return box;
  };
  // SP-204: the body's character XP trough under the play window
  IP.xpModel = function () {
    const s = G.state, L = DATA.config.leveling, lvl = G.Skills.charLevel(s), at = (n) => n * n * L.charLevelDivisor;
    const cur = (s.lifetimeXp || 0) - at(lvl), need = at(lvl + 1) - at(lvl);
    return { lvl, cur: Math.round(cur), need: Math.round(need), frac: need > 0 ? Math.max(0, Math.min(1, cur / need)) : 0 };
  };
  IP.xpEl = function (h) {
    const X = IP.xpModel();
    return h("div", { class: "ifp-xp", "data-ifp-xp": String(X.lvl), title: "Character XP" }, h("b", null, `LV ${X.lvl}`),
      h("div", { class: "ifp-xp-track" }, h("div", { class: "ifp-xp-fill", style: `width:${Math.round(X.frac * 1000) / 10}%` })), h("span", null, `${X.cur}/${X.need} XP`));
  };
  IP.minimapEl = function (h) {
    const M = IP.model(), views = IP.views(), cur = IP.view();
    const slider = h("div", { class: "mm-views", role: "radiogroup", "aria-label": "Minimap view" });
    for (const v of IP.VIEWS) slider.appendChild(h("button", { class: "mm-vbtn" + (v === cur ? " on" : ""), role: "radio", "aria-checked": v === cur ? "true" : "false", "data-mm-view": v, disabled: !views[v],
      title: v === "area" ? "AREA view: coming in a later slice" : !views[v] ? "Only inside a Map with Areas" : v.toUpperCase() + " view", onclick: () => { IP.ui.view = v; G.UI.render(); } }, v.toUpperCase()));
    const well = h("div", { class: "mm-well", "data-mm": cur });
    well.innerHTML = `<div class="mm-title">${esc((cur === "map" ? "Map: " : "") + M.title).toUpperCase()}</div>` + IP.minimapSvg(M, 360, 150) + (M.anyAreaExit ? `<div class="mm-foot">${esc(M.exitName)}: OUT FROM ANY AREA</div>` : "");
    well.addEventListener("click", (e) => { const g = e.target.closest && e.target.closest("[data-mm-node]"); if (!g) return; const n = M.nodes.find((x) => x.id === g.dataset.mmNode); if (!n || !n.reachable) return;
      if (cur === "zone" && !G.Exp.inSite() && G.Traversal) G.Traversal.select(n.id); else if (cur === "map") IP.goArea(n.id); });
    return h("div", { class: "ifp-minimap" }, slider, well);
  };

  IP.stripEl = function (h, bar, acts) {
    const S = IP.strip(), E = S.extract;
    const btn = h("button", { class: "ifp-extract", "data-act": "strip-extract", "data-can": E.can ? "1" : "0", disabled: !E.can, title: E.can ? E.label : E.why, onclick: () => acts[E.act] && acts[E.act]() }, E.label.toUpperCase());
    const wrap = h("div", { class: "ifp-xwrap", title: E.can ? "" : E.why }, btn);   // a disabled button shows no tooltip of its own in some browsers
    return h("div", { class: "ifp-strip" },
      h("div", { class: "ifp-stats" },
        h("div", { class: "ifp-stat" }, h("b", null, "HP"), bar(S.hp / S.maxHp, "#5fd35f", `${Math.ceil(S.hp)}/${Math.round(S.maxHp)}`)),
        h("div", { class: "ifp-stat" }, h("b", null, "KG"), bar(S.kg / S.cap / 1.5, S.kg > S.cap ? "#e0a040" : "#6aa0ff", `${G.Util.fmt1(S.kg)}/${G.Util.fmt1(S.cap)}`)),
        h("div", { class: "ifp-med", title: "Med Supplies (charges)" }, `${S.med} MED`)), wrap);
  };

  // sections: { key: element }, key from IP.routes; acts: strip Extract handlers
  IP.el = function (h, bar, sections, acts) {
    const tab = IP.TABS.some((t) => t.id === IP.ui.tab) ? IP.ui.tab : "squad";
    const txt = IP.textLabels(), tabs = h("div", { class: "ifp-tabs" + (txt ? " text" : " icons"), role: "tablist" });
    for (const t of IP.TABS) tabs.appendChild(h("button", { class: "ifp-tab" + (t.id === tab ? " on" : ""), role: "tab", "aria-selected": t.id === tab ? "true" : "false", "data-ifp-tab": t.id, title: t.tip, "aria-label": t.label, onclick: () => { IP.ui.tab = t.id; G.UI.render(); } }, txt ? t.label.toUpperCase() : null));
    if (!txt) for (const b of tabs.childNodes) if (b.dataset && b.dataset.ifpTab && b.insertAdjacentHTML) b.insertAdjacentHTML("beforeend", IP.iconSvg(b.dataset.ifpTab));
    const body = h("div", { class: "ifp-body tab-" + tab, role: "tabpanel", "data-ifp-body": tab });
    for (const k in IP.routes) if (IP.routes[k] === tab && sections[k]) for (const el of [].concat(sections[k])) body.appendChild(el);
    if (tab === "skills") { const sec = h("section", { class: "panel" }, h("h3", null, "Skills (" + G.Exp.body().name + ")")); for (const s of IP.skills()) sec.appendChild(h("div", { class: "ifp-kv" }, h("span", null, s.name), h("b", null, String(s.lvl)))); body.appendChild(sec); }
    if (tab === "settings") body.appendChild(h("section", { class: "panel" }, h("h3", null, "Settings"),
      h("button", { class: "ifp-btn wide", "data-act": "ifp-open-settings", onclick: () => acts.settings && acts.settings() }, "OPEN SETTINGS"),
      h("small", { class: "hint" }, "Audio, aim mode, graphics, tutorial."),
      h("label", { class: "ifp-set" }, h("input", { type: "checkbox", "data-set": "textTabLabels", checked: txt, onchange: (e) => IP.setTextLabels(e.target.checked) }), " Text tab labels"),
      h("small", { class: "hint" }, "Shows the tab names as text instead of icons.")));
    if (!body.childNodes.length) body.appendChild(h("small", { class: "hint" }, "Nothing here right now."));
    return h("div", { class: "exp-side ifp", "data-ifpanel": "1" }, IP.minimapEl(h), IP.stripEl(h, bar, acts), IP.squadEl(h, bar, acts), tabs, body);
  };
})(typeof window !== "undefined" ? window : this);
