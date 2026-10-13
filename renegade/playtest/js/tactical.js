// Tactical pause (Megan, Sep 29): pause the fight at any time, queue ready abilities (aimed) and item uses from the
// pouch (Med Supplies charges, Pain pills, Morphine, special meds; SP-194), then resume: the queue runs in order. Items channel for
// DATA.config.battle.tacticalPause.channelSec after the resume. Pure logic; js/battleview.js draws and takes input.
// b.paused, b.tq = [{ kind: "ability" | "med", u, i?, tgt?, n }], u.channel = { kind, t, max, ... }.
(function (root) {
  const G = root.G, U = G.Util;
  const T = G.Tactical = {};
  const CF = () => DATA.config.battle.tacticalPause || {};
  const alive = (u) => u && u.state === "alive";
  const run = () => G.state && G.state.run;

  T.on = () => !!CF().enabled;
  T.canPause = (b) => T.on() && b.phase === "fight" && !b.over;
  T.pause = function (b) { if (!T.canPause(b)) return "Not in a fight."; b.paused = true; b.tq = b.tq || []; return null; };
  T.queue = (b) => (b.tq = b.tq || []);
  // resume: run the queue in order (abilities fire now, items start channelling; 2 items on one unit chain)
  T.resume = function (b) {
    if (!b.paused) return null;
    b.paused = false; if (G.Abilities) G.Abilities.aimCancel(b); b.itemAim = null;
    const q = T.queue(b).splice(0); const done = [];
    for (const a of q) {
      a.u.queued = (a.u.queued || 1) - 1;
      if (a.kind === "escape") { const err = G.Escape.start(b); if (err) b.log.push(`Queued Break away failed: ${err}`); done.push({ a, err }); continue; }
      if (a.kind === "ability") {
        const s = a.u.abl[a.i]; s.queued = false;
        const err = G.Abilities.use(b, a.u, a.i, a.tgt, false); if (err) b.log.push(`Queued ${s.d.name} failed: ${err}`); done.push({ a, err });
      } else if (a.kind !== "med") {   // SP-194: pouch meds are instant (no channel)
        const err = T.itemBlock(b, a.kind, a.u, true, true) || G.Med.apply(b, a.kind, a.u); if (err) b.log.push(`Queued ${G.Med.name(a.kind)} failed: ${err}`); done.push({ a, err });
      } else {
        const ch = { kind: a.kind, t: 0, max: CF().channelSec[a.kind] || 1, order: a.order };
        (a.u.chQ = a.u.chQ || []).push(ch); if (!a.u.channel) a.u.channel = a.u.chQ.shift();
        b.log.push(`${a.u.name}: ${T.label(a)} (${U.fmt1(ch.max)} s)`); done.push({ a });
      }
    }
    return done;
  };
  T.toggle = (b) => (b.paused ? (T.resume(b), null) : T.pause(b));

  // SP-002 (Megan, Oct 2): a Med Supplies charge is spent when its heal lands, not when it's queued. Until then it's
  // spoken for: queued, channelling or waiting in a unit's channel queue (living units only; a downed unit's charge is free).
  T.medPending = function (b) {
    const isMed = (c) => c && c.kind === "med";
    let n = T.queue(b).filter(isMed).length;
    for (const u of b.units) if (alive(u)) n += (isMed(u.channel) ? 1 : 0) + (u.chQ || []).filter(isMed).length;
    return n;
  };
  T.medFree = (b) => (run() ? Math.max(0, G.Med.charges() - T.medPending(b)) : 0);
  // a pouch med (pills, Morphine, special) waiting in the queue is spoken for too
  T.kindFree = (b, kind) => Math.max(0, G.Med.count(kind) - T.queue(b).filter((a) => a.kind === kind).length);
  // what the squad can use from the pause menu: Med Supplies charges (less those spoken for), then the pouch meds
  // TODO (design, milestone 5): special-ammo swaps were dropped from the pause for now (the step-9 pack auto-loads every gun)
  T.items = function (b) {
    if (!run()) return [];
    const out = [{ kind: "med", name: DATA.resources.med.name, n: b ? T.medFree(b) : G.Med.charges(), sprite: DATA.resources.med.sprite }];
    for (const k of G.Med.battleKinds()) out.push({ kind: k, name: G.Med.name(k), n: b ? T.kindFree(b, k) : G.Med.count(k), sprite: DATA.resources.med.sprite });
    return out;
  };
  T.label = (a) => (a.kind === "ability" ? a.u.abl[a.i].d.name : a.kind === "escape" ? "Break away" : a.kind === "med" ? "Med Supplies" : G.Med.name(a.kind));
  // why an item can't go on this unit (null = ok)
  // live (SP-156 squad panel): the Med kit is used mid-fight without pausing; every other rule is the same
  // firing: the queued use is resolving now (it no longer counts against its own stack)
  T.itemBlock = function (b, kind, u, live, firing) {
    if (!b.paused && !live) return "Pause first (Space).";
    if (live && !T.canPause(b)) return !T.on() ? "Not in this battle." : b.phase === "place" ? "Once the fight starts." : "The fight is over.";
    if (!u || u.side !== 0) return "Pick one of your squad.";
    if (!alive(u)) return `${u.name} is down.`;
    const r = run(); if (!r) return "No expedition.";
    if (kind === "med") {
      if (!(G.Med.charges() > 0)) return "No Med Supplies charges left.";
      if (!(T.medFree(b) > 0)) return "Every Med Supplies charge is already queued.";
      if (u.medCd > 0) return `${u.name} can't take more Med Supplies for ${U.fmt1(u.medCd)} s.`;
      if (T.queue(b).some((a) => a.kind === "med" && a.u === u) || (u.channel && u.channel.kind === "med") || (u.chQ || []).some((c) => c.kind === "med")) return `${u.name} already has Med Supplies coming (cooldown).`;
      if (u.hp >= u.maxHp - 0.5) return `${u.name} is at full HP.`; return null;
    }
    if (kind === "pills" || kind === "morphine" || kind.startsWith("sm:")) {
      if (!firing && !(T.kindFree(b, kind) > 0)) return `Every ${G.Med.name(kind)} you have is already queued.`;
      if (!firing && (kind === "pills" || kind === "morphine") && T.queue(b).some((a) => a.kind === "pills" || a.kind === "morphine")) return "A pill is already queued (one bottle).";
      return G.Med.block(b, kind, u);
    }
    return "Unknown item.";
  };
  // queue an item use: the kit stays in the bag until its heal lands (SP-002); cancelling just frees it again
  T.queueItem = function (b, kind, u) {
    const why = T.itemBlock(b, kind, u); if (why) return why;
    const a = { kind, u, order: T.queue(b).length + 1 };
    T.queue(b).push(a); u.queued = (u.queued || 0) + 1; return null;
  };
  // SP-156: the squad panel's Use Med kit button. Paused: queued like before (runs on resume). Running: the same
  // channel starts at once (exactly what a pause, queue and resume would do); the kit still leaves the bag when it lands
  // SP-194: the same for a pouch med (instant: it takes effect at once while the fight runs)
  T.useItem = function (b, kind, u) {
    if (kind === "med") return T.useMed(b, u);
    if (b.paused) return T.queueItem(b, kind, u);
    return T.itemBlock(b, kind, u, true) || G.Med.apply(b, kind, u);
  };
  T.useMed = function (b, u) {
    if (b.paused) return T.queueItem(b, "med", u);
    const why = T.itemBlock(b, "med", u, true); if (why) return why;
    const ch = { kind: "med", t: 0, max: CF().channelSec.med || 1, order: 0 };
    (u.chQ = u.chQ || []).push(ch); if (!u.channel) u.channel = u.chQ.shift();
    b.log.push(`${u.name}: Med Supplies (${U.fmt1(ch.max)} s)`); return null;
  };
  // queue an aimed ability (the view calls this instead of firing while paused); cooldown spent when it fires
  T.queueAbility = function (b, u, i, tgt) {
    if (!b.paused) return "Pause first (Space).";
    const s = u && u.abl && u.abl[i]; if (!s) return "No such ability.";
    if (s.queued) return `${s.d.name} is already queued.`;
    const why = G.Abilities.validate(b, u, s, tgt); if (why) return why;
    s.queued = true; T.queue(b).push({ kind: "ability", u, i, tgt, order: T.queue(b).length + 1 }); u.queued = (u.queued || 0) + 1;
    G.Abilities.aimCancel(b); return null;
  };
  // queue Break away (resolves on unpause: the channel starts then)
  T.queueEscape = function (b) {
    if (!b.paused) return "Pause first (Space).";
    const why = G.Escape.block(b); if (why) return why;
    const u = b.units.find((x) => x.rank === "body" && x.side === 0);
    T.queue(b).push({ kind: "escape", u, order: T.queue(b).length + 1 }); u.queued = (u.queued || 0) + 1; return null;
  };
  // the heal cooldown (medCd) for a unit, from the user's (your body's) Medicine level
  T.medCooldown = function (b) {
    const C = CF().medCooldown || { baseSec: 0, perMedicine: 0, minSec: 0 }, body = b.units.find((o) => o.rank === "body" && o.side === 0);
    return Math.max(C.minSec, C.baseSec - C.perMedicine * (body ? body.medicine || 0 : 0));
  };
  // cancel a queued action while paused (nothing was spent yet)
  T.cancel = function (b, idx) {
    if (!b.paused) return "Only while paused.";
    const q = T.queue(b), a = q[idx]; if (!a) return "Nothing there.";
    q.splice(idx, 1); a.u.queued = Math.max(0, (a.u.queued || 1) - 1);
    if (a.kind === "ability") a.u.abl[a.i].queued = false;
    q.forEach((x, k) => (x.order = k + 1));
    return null;
  };

  // B.step, per channelling unit: the unit does nothing else; at the end the item takes effect
  T.channelTick = function (b, u, dt) {
    const ch = u.channel; ch.t += dt;
    if (ch.t < ch.max) return;
    u.channel = (u.chQ && u.chQ.shift()) || null;
    const X = G.Battle._;
    if (ch.kind === "escape") { G.Escape.resolve(b); return; }
    if (ch.kind === "med") {
      // SP-002: the charge is spent now, as the heal lands (a fight that ends mid-channel keeps it)
      if (run() && !G.Med.spend(1)) { b.log.push(`Med Supplies on ${u.name}: no charges left.`); return; }
      // the field heal roll, made now (the pause never shows its outcome): Medicine chance, fail heals x0.25
      const R = DATA.config.rolls, body = b.units.find((o) => o.rank === "body" && o.side === 0), calm = body && (body.quirks || []).includes("heals_cant_fail");
      const med = body ? body.medicine || 0 : 0, chance = calm ? 100 : U.clamp(R.fieldHealBase + med / R.fieldHealSkillDiv, R.hitMin, R.hitMax), roll = b.rng() * 100, ok = roll < chance;
      const amt = u.maxHp * DATA.config.expedition.medHealPct / 100 * (ok ? 1 : R.fieldHealFailMult), was = u.hp;
      G.Med.heal(u, amt);
      X.floatText(b, u, `+${Math.round(u.hp - was)} ${ok ? "" : "(fumbled) "}Med Supplies`, ok ? "#7ee07e" : "#f0b050", true); X.bark(b, u, "healed");
      b.log.push(`Med Supplies on ${u.name} (1 charge): field heal ${Math.round(chance)}% → rolled ${Math.floor(roll)}: ${ok ? "success" : "fumbled"}, +${Math.round(u.hp - was)} HP`);
      if (G.Escape) G.Escape.feed(b, `Med Supplies on ${u.name} (1 charge): ${Math.round(chance)}% → rolled ${Math.floor(roll)}: ${ok ? "success" : "fumbled"}, +${Math.round(u.hp - was)} HP`, ok ? "good" : "bad");
      (b.tStats = b.tStats || []).push({ kind: "med", u: u.name, t: b.t, ok, amt: u.hp - was, order: ch.order });
      // design call (milestone 5): a Med kit used in battle gives the body the same Medicine XP as one used between fights
      if (body) X.xp(body, "medicine", X.XP().fieldHeal);
      if (!G.Med.noCd(u)) u.medCd = u.medCdMax = T.medCooldown(b);   // Megan (milestone 5): no other heal on this unit for a while; Morphine / Surge Injector: none
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
