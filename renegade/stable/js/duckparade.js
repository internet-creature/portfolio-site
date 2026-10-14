// SP-216 the duck parade (modifier duck_parade in data/mapsv2.js, tuning in DATA.mapsV2.duckParade). Its object is a bush
// hiding a momma duck and her ducklings. The first search brings them out and they leave the Area through its way out: this
// file records that they've gone (o.ducksGone) and js/duckview.js draws the walk. Searching the bush again after that
// finds one wearable piece of the Yellow Raincoat set, once (o.rummaged; picked on the run's own rng stream), and from
// then on every boop says the next quack line (o.boops). No roll, no Attention, no Heat. All three fields are optional on
// the object (a per-run modifier object, so nothing to reset). V2 only: modifiers never reach a legacy run.
(function (root) {
  const G = root.G, U = G.Util;
  const DP = G.DuckParade = {};
  const D = () => DATA.mapsV2.duckParade;

  // the modifier's bush (older saves placed the same object as "Duck parade" decor: same decorMod, so it works the same)
  DP.is = (o) => !!o && o.kind === "decor" && o.decorMod === "duck";
  DP.count = () => 1 + D().ducklings;
  // the set pieces the bush can give: the ones that can be worn (the rain boots wait for a feet slot)
  DP.pieces = () => DATA.sets.list[D().set].pieces.filter((b) => G.Items.canEquip({ base: b }));
  // a find not yet taken comes first; then search (the ducks, then the find); after that, boop
  DP.actions = function (o) {
    if (G.V2.hasLoot(o)) return ["loot"];
    if (!o.rummaged) return ["rummage"];
    return ["boop"];
  };
  DP.quack = function (o) {
    const L = D().lines, n = o.boops = (o.boops || 0) + 1;
    return L[(n - 1) % L.length];
  };
  // any use of the bush (its one action at the time): { text }, plus ducks (how many came out) the moment they leave
  DP.use = function (site, o) {
    const X = G.Exp, T = D().text;
    if (!o.ducksGone) {
      o.ducksGone = true; o.examine = T.examineGone;
      const text = `${DP.quack(o)} ${U.copy(T.out)}`;
      X.log(`${o.name}: ${text}`, "good"); G.State.save();
      return { text, ducks: DP.count() };
    }
    if (!o.rummaged) return DP.search(site, o);
    const text = DP.quack(o);
    X.log(`${o.name}: ${text}`); G.State.save();
    return { text };
  };
  // the find: one piece, Normal like the other silly outfits, item level and pick both on this bush's own stream
  DP.search = function (site, o) {
    const X = G.Exp, V = G.V2, key = site.key || site.nid, rng = V.rngFor(G.state.run.seed, key, o.id, "raincoat");
    const ilvl = V.withRng(rng, () => X.itemLevel(X.node(site.nid)));
    const item = G.Items.make(rng.pick(DP.pieces()), G.Items.rollRarity(rng, X.rarityBonus(), ilvl), ilvl, rng);
    o.rummaged = true; o.examine = D().text.examineSearched;
    o.loot = V.toEntries(key + ":" + o.id, { items: [item], res: {} });
    X.log(`${o.name}: ${U.copy(D().text.found)} ${G.Items.name(item)}.`, "good");
    X.push({ type: "loot", site: key, objs: [o.id], title: o.name });
    G.State.save();
    return { item };
  };
})(typeof window !== "undefined" ? window : globalThis);
