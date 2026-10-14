// SP-196: the currency pouch. Chips and Old World Money go straight into it when picked up (stash.res, flagged pouch in
// data/resources.js), and so do the retry tokens (state.retryTokens). Nothing in it weighs anything or is ever lost.
// Logic only: returns toast lines for the views (AGENTS.md).
(function (root) {
  const G = root.G, U = G.Util;
  const M = (G.Currency = {}), D = () => DATA.currency;
  const res = () => G.state.stash.res;
  M.chips = () => res().chips || 0;
  M.oldMoney = () => res().oldmoney || 0;
  M.tokens = () => G.state.retryTokens || 0;
  M.isPouch = (k) => !!(DATA.items.resources[k] && DATA.items.resources[k].pouch);
  // the pouch at a glance: [{ k, name, n }]
  M.pouch = () => [{ k: "chips", name: "Chips", n: M.chips() }, { k: "oldmoney", name: "Old World Money", n: M.oldMoney() }, { k: "retryTokens", name: "Retry tokens", n: M.tokens() }];
  M.readout = () => M.pouch().map((p) => `${p.n} ${p.name}`).join(" · ");
  // a pouch resource picked up (not Med Supplies, which roll med items: js/meds.js): straight to the stash, toast lines back
  M.pickUp = function (k, n) {
    if (!(n > 0)) return [];
    res()[k] = (res()[k] || 0) + n;
    return [`+${n} ${DATA.items.resources[k].name}`];
  };
  M.add = (k, n) => { res()[k] = (res()[k] || 0) + n; };
  // spend Old World Money on something: refused for retries and reroll tokens (Megan), and only what exists is accepted
  M.spendOldMoney = function (purpose, n) {
    n = n || 1;
    if (D().oldMoneyNeverBuys.includes(purpose)) return "Old World Money can't buy retries or reroll tokens.";
    if (purpose !== "exchange") return "Old World Money can't buy that yet.";
    if (M.oldMoney() < n) return "Not enough Old World Money.";
    res().oldmoney -= n; return null;
  };
  // one way only: Old World Money -> Chips (there is no Chips -> Old World Money)
  M.exchange = function (n) {
    n = Math.floor(n || 1); if (!(n > 0)) return { error: "Nothing to exchange." };
    const err = M.spendOldMoney("exchange", n); if (err) return { error: err };
    const c = n * D().chipsPerOldMoney; M.add("chips", c);
    return { ok: true, chips: c, line: `${n} Old World Money -> ${c} Chips` };
  };
  // finds for one searched object, on their own stream so the regular loot rolls stay as they were
  M.rngFor = function () {
    const r = G.state.run; if (!r) return G.rng;
    r.curN = (r.curN || 0) + 1;
    return U.makeRng(((r.seed || 1) * 2654435761 + r.curN * 40503) >>> 0);
  };
  M.rollFinds = function (type, o, out) {
    const c = D().chips[type], om = D().oldMoney, rng = M.rngFor();
    if (c && rng.chance(c[0])) { const n = rng.int(c[1], c[2]); if (n > 0) out.chips = (out.chips || 0) + n; }
    let p = om[type] || 0;
    if (o && o.hunter) p = Math.max(p, om.hunterBody); else if (o && o.elite) p = Math.max(p, om.eliteBody);
    if (p && rng.chance(p)) out.oldmoney = (out.oldmoney || 0) + 1;
    return out;
  };
})(typeof window !== "undefined" ? window : globalThis);
