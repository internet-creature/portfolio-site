// SP-041 (settlement overhaul 1/3): the always-visible settlement right panel, desktop only. It shows the body you'd
// deploy in (name, class, level, HP, injuries / restoring), every gear slot of the deploy loadout, the loadout's Grunts,
// and a Deploy button that does exactly what the Trapdoor does (UI.openPanel("zones"): zone pick, deploy prep and the
// tutorial intercept stay the same). It reads state the game already keeps and writes nothing (no new save fields, no Heat).
// G.SettlePanel.model() is plain data (headless-testable, tests/settle_panel.js); G.SettlePanel.el(h) builds the DOM;
// G.SettlePanel.mount(scr) is called at the end of UI.renderOutpost and puts the panel in a right column, under the
// SP-189 tutorial objectives when that panel is on the screen (it moves #screen > .tut-obj into the same column).
(function (root) {
  const G = root.G, SPN = (G.SettlePanel = {});
  // [loadout key, label, always shown]. The extra hands only show when filled (the deploy panel does the same).
  SPN.SLOTS = [["weapon", "Main hand", true], ["offhand", "Off hand", false], ["head", "Head", true], ["body", "Body", true], ["backpack", "Pack", true], ["weapon2", "Backup main", false], ["offhand2", "Backup off", false]];
  SPN.minWidth = 900;   // desktop only (the phone drawer is a follow-up ticket)
  SPN.on = function () {
    const s = G.state;
    if (!s || s.run || !s.bodies || !s.bodies.length) return false;
    if (G.Touch && G.Touch.layout && G.Touch.layout()) return false;
    return !(typeof root.innerWidth === "number" && root.innerWidth < SPN.minWidth);
  };
  // the click targets; SP-173/SP-174 (the universal loadout screen) can point these at it later
  SPN.openBody = () => G.UI.openPanel("character");
  SPN.openGrunt = (uid) => G.UI.openPanel("grunt:" + uid);
  SPN.deploy = () => G.UI.openPanel("zones");   // the Trapdoor's path, nothing else
  SPN.model = function () {
    const s = G.state, St = G.State, lo = s.loadout || {}, lg = lo.gear || {};
    const body = St.body(lo.bodyId) || s.bodies[0];
    const item = (uid) => (uid ? s.stash.items.find((i) => i.uid === uid) || null : null);
    const gear = {};
    for (const [k] of SPN.SLOTS) { const it = item(lg[k]); if (it) gear[k] = it; }
    const u = G.Battle.unitFromBody(body, gear, {}), cls = body.cls ? DATA.bodies.classes[body.cls] : null;
    const natural = G.Items.base(cls ? cls.naturalWeapon : DATA.bodies.basicBody.naturalWeapon).name;
    const FB = DATA.config.deploy && DATA.config.deploy.freeBackpack;
    const slots = SPN.SLOTS.filter(([k, , always]) => always || gear[k]).map(([k, label]) => {
      const it = gear[k] || null;
      return { slot: k, label, item: it, name: it ? G.Items.name(it) : null,
        empty: it ? null : k === "weapon" ? "empty (" + natural + ")" : k === "backpack" && FB ? "empty (free " + G.Items.base(FB.base).name + ")" : "empty" };
    });
    const grunts = (lo.grunts || []).map((id) => St.grunt(id)).filter(Boolean).map((g) => ({ uid: g.uid, name: G.Allies.name(g), rank: G.Allies.rankName(g), hp: Math.round(G.Battle.unitFromGrunt(g).maxHp) }));
    const inj = G.Injuries ? G.Injuries.of(body).map((x) => x.id) : [];
    return {
      body: { uid: body.uid, name: body.name, cls: cls ? cls.name : "Basic", level: G.Skills.bodyLevel(body), hp: Math.round(u.maxHp), ready: St.bodyReady(body), restoreUntil: body.restoreUntil || 0, injuries: inj },
      slots, grunts, deploy: "zones"
    };
  };
  // h = G.UI.h (or any (tag, attrs, ...children) builder)
  SPN.el = function (h) {
    const m = SPN.model(), UI = G.UI, ic = (k, px) => (G.Sprites && G.Sprites.icon ? G.Sprites.icon(k, px) : null), B = m.body;
    const body = G.State.body(B.uid);
    const box = h("aside", { class: "panel settle-panel", "data-settle-panel": "1", "aria-label": "Your loadout" });
    box.appendChild(h("h3", null, "You"));
    box.appendChild(h("button", { class: "sp-body", "data-act": "settle-body", "data-body": B.uid, title: "Open the Character screen", onclick: () => SPN.openBody() },
      ic(G.State.bodySprite(body), 36),
      h("span", { class: "sp-body-txt" }, h("b", { class: "sp-body-name" }, B.name), h("span", { class: "sp-body-sub", "data-body-stats": "1" }, `${B.cls} · Lv ${B.level} · HP ${B.hp}`),
        B.ready ? null : h("span", { class: "sp-restore" }, "Restoring ", h("span", { "data-until": B.restoreUntil }, G.Util.fmtTime(B.restoreUntil - G.now()))),
        UI && UI.injuryChips ? UI.injuryChips(body) : null)));
    box.appendChild(h("h4", null, "Gear"));
    const gl = h("ul", { class: "sp-gear" }), worn = m.slots.map((x) => x.item).filter(Boolean);
    for (const sl of m.slots) {
      const it = sl.item, ikey = it ? G.Items.sprite(it) : DATA.sprites && DATA.sprites["slot_" + (sl.slot === "backpack" ? "pack" : sl.slot)] ? "slot_" + (sl.slot === "backpack" ? "pack" : sl.slot) : "slot_gear";
      const li = h("li", { class: "sp-slot" + (it ? " r-" + it.rarity : " empty"), "data-sslot": sl.slot }, ic(ikey, 20), h("span", { class: "sp-slot-label" }, sl.label),
        h("span", it ? { class: "sp-slot-item", style: "color:" + DATA.items.rarities[it.rarity].color } : { class: "sp-slot-item" }, it ? sl.name : sl.empty));
      gl.appendChild(it && UI && UI.itemTip ? UI.itemTip(li, it, worn) : li);
    }
    box.appendChild(gl);
    box.appendChild(h("h4", null, "Squad"));
    const sq = h("div", { class: "sp-squad" });
    for (const g of m.grunts) {
      const rec = G.State.grunt(g.uid);
      sq.appendChild(h("button", { class: "sp-grunt", "data-act": "settle-grunt", "data-grunt": g.uid, title: "Open " + g.name, onclick: () => SPN.openGrunt(g.uid) },
        UI && UI.gruntIcon ? UI.gruntIcon(rec, 20) : null, h("span", { class: "sp-grunt-name" }, g.name), h("span", { class: "sp-grunt-hp" }, "HP " + g.hp)));
    }
    if (!m.grunts.length) sq.appendChild(h("p", { class: "hint" }, "No Grunts in your squad. Pick them when you deploy."));
    box.appendChild(sq);
    box.appendChild(h("button", { class: "primary sp-deploy", "data-act": "settle-deploy", title: "Same as the Trapdoor: pick a zone, then prepare to deploy", onclick: () => SPN.deploy() }, "Deploy"));
    return box;
  };
  SPN.mount = function (scr) {
    if (!SPN.on()) return null;
    const h = G.UI.h, col = h("div", { class: "settle-col", "data-settle-col": "1" });
    const obj = scr.querySelector(":scope > .tut-obj");   // SP-189: objectives on top, this panel below, one column
    if (obj) col.appendChild(obj);
    col.appendChild(SPN.el(h));
    scr.appendChild(col);
    return col;
  };
  // redraw just the panel in place (a modal over the outpost changed the loadout: the doll's Equip / Unequip)
  SPN.refresh = function () {
    const old = typeof document !== "undefined" && document.querySelector("#screen > .settle-col > .settle-panel");
    if (!old || !SPN.on()) return false;
    old.replaceWith(SPN.el(G.UI.h));
    return true;
  };
})(typeof window !== "undefined" ? window : globalThis);
