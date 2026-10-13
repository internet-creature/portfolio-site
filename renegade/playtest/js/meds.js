// SP-194: Med Supplies (a pool of charges in the pouch), the med item table, and the battle-only meds (Pain pills,
// Morphine, special meds). Pure logic: the pool is state.stash.res.med, usable at camp and on runs, never lost.
// Battle effects (heal cooldown, pills, HoTs, healing received) live here; js/tactical.js queues and fires them.
(function (root) {
  const G = root.G, U = G.Util;
  const M = G.Med = {};
  const D = () => DATA.meds;
  const stash = () => G.state.stash;
  const alive = (u) => u && u.state === "alive";

  // ---------- the pool and the pouch stacks ----------
  M.charges = () => stash().res.med || 0;
  M.spend = function (n) { if (M.charges() < n) return false; stash().res.med -= n; return true; };
  M.add = function (n) { stash().res.med = M.charges() + n; };
  M.specials = () => (stash().specialMeds = stash().specialMeds || {});
  // kind: "pills" | "morphine" | "sm:<id>"
  M.count = (kind) => (kind.startsWith("sm:") ? M.specials()[kind.slice(3)] || 0 : stash().res[kind] || 0);
  M.take = function (kind) {
    if (!(M.count(kind) > 0)) return false;
    if (kind.startsWith("sm:")) M.specials()[kind.slice(3)]--; else stash().res[kind]--;
    return true;
  };
  M.name = (kind) => (kind === "med" ? DATA.resources.med.name : kind.startsWith("sm:") ? D().specials[kind.slice(3)].name : D()[kind].name);
  // what the pouch holds for battle (the pause menu and the squad panel): pills, Morphine, then each special stack owned
  M.battleKinds = function () {
    const out = ["pills", "morphine"].filter((k) => M.count(k) > 0);
    for (const id in D().specials) if (M.count("sm:" + id) > 0) out.push("sm:" + id);
    return out;
  };

  // ---------- the med item table ----------
  // entries: { kind: "charges" | "pills" | "morphine" | "special", id, name, charges?, rarity, w }
  M.table = function () {
    const out = [];
    for (const row of D().charges) for (const name of row.items) out.push({ kind: "charges", id: name, name, charges: row.charges, rarity: row.rarity, w: row.weight / row.items.length });
    out.push({ kind: "pills", id: "pills", name: D().pills.name, rarity: D().pills.rarity, w: D().pills.weight });
    out.push({ kind: "morphine", id: "morphine", name: D().morphine.name, rarity: D().morphine.rarity, w: D().morphine.weight });
    for (const id in D().specials) { const s = D().specials[id]; out.push({ kind: "special", id, name: s.name, rarity: s.rarity, w: s.weight, medOnly: true }); }
    return out;
  };
  M.rank = (rarity) => D().rarities[rarity].rank;
  // ctx: { medical: bool (x3 on blue and above, special meds allowed), minRarity?: "yellow" }
  M.weight = function (e, ctx) {
    ctx = ctx || {};
    if (e.medOnly && !ctx.medical) return 0;
    if (ctx.minRarity && M.rank(e.rarity) < M.rank(ctx.minRarity)) return 0;
    return e.w * (ctx.medical && M.rank(e.rarity) >= M.rank(D().medicalShift.fromRarity) ? D().medicalShift.mult : 1);
  };
  M.roll = (rng, ctx) => rng.weighted(M.table(), (e) => M.weight(e, ctx));
  // n finds; ctx.minRarity applies to the first one only (the Pharmacy safe: at least one yellow or better)
  M.rollN = function (n, rng, ctx) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(M.roll(rng, i === 0 ? ctx : Object.assign({}, ctx, { minRarity: null })));
    return out;
  };
  // the rarity context where loot is taken: medical locations, the Med stockpile modifier and its objects shift rarity
  M.ctxAt = function (node, o) {
    const loc = node && G.Map.loc(node), rm = node && G.V2.on() ? G.V2.resMult(node.id) : {};
    return { medical: !!((loc && loc.kind === "medical") || (rm.med || 1) > 1 || (o && o.medShift)), minRarity: (o && o.medMinRarity) || null };
  };
  // apply found entries to the pouch; returns the toast lines ("+3 Trauma pressure dressing", "Pain pills")
  M.grant = function (entries) {
    const lines = [];
    for (const e of entries) {
      if (e.kind === "charges") { M.add(e.charges); lines.push(`+${e.charges} ${e.name}`); }
      else if (e.kind === "special") { M.specials()[e.id] = (M.specials()[e.id] || 0) + 1; lines.push(`${e.name} (special med)`); }
      else { stash().res[e.kind] = (stash().res[e.kind] || 0) + 1; lines.push(e.name); }
    }
    return lines;
  };
  // n Med Supplies finds taken from loot: roll the items, add them to the pouch, log each line
  M.lootFinds = function (n, ctx) {
    const lines = M.grant(M.rollN(n, G.rng, ctx));
    if (G.state.run) for (const l of lines) G.Exp.log(l, "good");
    return lines;
  };

  // ---------- battle effects ----------
  M.pillCooldown = function (b) {
    const C = D().pillCooldown, body = b.units.find((o) => o.rank === "body" && o.side === 0);
    return Math.max(C.minSec, C.baseSec - C.perMedicine * (body ? body.medicine || 0 : 0));
  };
  M.healMult = (u) => (u.healAmp && u.healAmp.t > 0 ? u.healAmp.mult : 1);
  M.noCd = (u) => u.morphT > 0;
  // heal a unit by amt (already in HP), scaled by healing received; returns what landed
  M.heal = function (u, amt) { const was = u.hp; u.hp = Math.min(u.maxHp, u.hp + amt * M.healMult(u)); return u.hp - was; };
  M.tickBattle = function (b, dt) { if (b.pillCd > 0) b.pillCd = Math.max(0, b.pillCd - dt); };
  M.tickUnit = function (b, u, dt) {
    if (u.morphT > 0) u.morphT = Math.max(0, u.morphT - dt);
    if (u.healAmp) { u.healAmp.t -= dt; if (u.healAmp.t <= 0) u.healAmp = null; }
    if (u.hots && u.hots.length) {
      for (const h of u.hots) { const s = Math.min(dt, h.t); h.t -= dt; M.heal(u, u.maxHp * h.pps / 100 * s); }
      u.hots = u.hots.filter((h) => h.t > 0);
    }
  };
  // the read-only count on the deploy Med Supplies line ("6 charges")
  M.readout = function () { const n = M.charges(); return `${n} charge${n === 1 ? "" : "s"}`; };
  // why a pouch med can't go on this unit now (null = ok); the battle-only checks (pause, squad, alive) are js/tactical.js's
  M.block = function (b, kind, u) {
    if (!(M.count(kind) > 0)) return `No ${M.name(kind)} left.`;
    if (kind === "pills" || kind === "morphine") {
      if (b.pillCd > 0) return `Pills ready in ${U.fmt1(b.pillCd)} s.`;
      if (kind === "pills" && !(u.medCd > 0)) return "No cooldown to clear";   // toasted by the view; the pill stays in the pouch
      return null;
    }
    const s = D().specials[kind.slice(3)];
    if ((s.hot || s.healPct) && !s.radiusM && u.hp >= u.maxHp - 0.5) return `${u.name} is at full HP.`;
    return null;
  };
  // use it now (instant, no channel): takes one from the pouch and applies the effect
  M.apply = function (b, kind, u) {
    if (!M.take(kind)) return `No ${M.name(kind)} left.`;
    const X = G.Battle._, nm = M.name(kind);
    if (kind === "pills" || kind === "morphine") {
      u.medCd = 0;
      if (kind === "morphine") u.morphT = D().morphineSec;
      b.pillCd = M.pillCooldown(b);
      X.floatText(b, u, nm, "#9fd8ff", true); b.log.push(`${nm} on ${u.name}: heal cooldown cleared${kind === "morphine" ? ` (none for ${D().morphineSec} s)` : ""}.`);
      return null;
    }
    const s = D().specials[kind.slice(3)];
    const targets = s.radiusM ? b.units.filter((o) => o.side === u.side && alive(o) && Math.hypot(o.x - u.x, o.y - u.y) <= s.radiusM) : [u];
    for (const t of targets) {
      if (s.hot) (t.hots = t.hots || []).push({ pps: s.hot.pps, t: s.hot.sec });
      if (s.noCdSec) { t.morphT = Math.max(t.morphT || 0, s.noCdSec); t.medCd = 0; }
      if (s.amp) t.healAmp = { mult: s.amp.mult, t: s.amp.sec };
      if (s.healPct) M.heal(t, t.maxHp * s.healPct / 100);
    }
    X.floatText(b, u, nm, "#c8a0ff", true); b.log.push(`${nm} on ${u.name}${targets.length > 1 ? ` and ${targets.length - 1} nearby` : ""}.`);
    return null;
  };
})(typeof window !== "undefined" ? window : globalThis);
