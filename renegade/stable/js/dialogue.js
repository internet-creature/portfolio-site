// SP-157: a small data-driven dialogue runner (no DOM; the box is js/dialogueview.js). Trees: DATA.dialogue.<id>
// (data/dialogue/*.js, generated from the authoring YAML by tools/dialogue_convert.js).
// NODE fields: beats [{ speaker, text }] shown in order; then `choices` [{ id, text, target }] OR `next` (node id) OR
//   `end` (a named ending). `actions` (game_action names) run when the node finishes. `flag` marks a node a human
//   still has to look at (e.g. a route the draft didn't give).
// Text tokens: {name} {they} {them} {their} (state.player, the new-game step), {click} ("Click" / "Tap").
// Game actions: G.Dialogue.actions[name](ctx). An unknown name is a stub: a console note, listed in G.Dialogue.stubbed.
(function (root) {
  const G = root.G, D = G.Dialogue = { actions: {}, stubbed: [] };
  const PRON = { he: ["he", "him", "his"], she: ["she", "her", "her"], they: ["they", "them", "their"] };
  D.tree = (id) => (DATA.dialogue || {})[id] || null;
  D.player = () => (G.state && G.state.player) || { name: "", gender: "they" };
  D.text = function (t, touch) {
    const p = D.player(), pr = PRON[p.gender] || PRON.they;
    return String(t || "").replace(/\{name\}/g, p.name || "friend").replace(/\{they\}/g, pr[0]).replace(/\{them\}/g, pr[1]).replace(/\{their\}/g, pr[2])
      .replace(/\{click\}/g, touch ? "Tap" : "Click");
  };
  D.speaker = (s) => { const M = (DATA.dialogue || {}).speakers || {}; return s in M ? M[s] : s; };
  // a session: { tree, id, node, beat, done, end }. cur() = { speaker, text, choices|null } for the box
  D.start = function (id, ctx) {
    const tree = D.tree(id); if (!tree) throw new Error("no dialogue " + id);
    const s = { id, tree, node: null, beat: 0, done: false, end: null, ctx: ctx || {}, path: [], choices: [] };
    D.go(s, tree.start); return s;
  };
  D.go = function (s, nid) {
    const n = s.tree.nodes[nid]; if (!n) throw new Error(`dialogue ${s.id}: no node ${nid}`);
    s.node = nid; s.beat = 0; s.path.push(nid);
    if (!(n.beats || []).length) D.finish(s);
  };
  D.cur = function (s) {
    if (s.done) return null;
    const n = s.tree.nodes[s.node], b = n.beats[s.beat] || {}, last = s.beat >= n.beats.length - 1;
    return { node: s.node, speakerId: b.speaker || null, speaker: D.speaker(b.speaker), text: D.text(b.text, s.ctx.touch), choices: last && n.choices ? n.choices.map((c) => ({ id: c.id, text: D.text(c.text, s.ctx.touch) })) : null };
  };
  // Next on a beat. Returns false when the box is waiting on a choice.
  D.next = function (s) {
    if (s.done) return false;
    const n = s.tree.nodes[s.node];
    if (s.beat < n.beats.length - 1) { s.beat++; return true; }
    if (n.choices) return false;
    D.finish(s); return true;
  };
  D.choose = function (s, cid) {
    const n = s.tree.nodes[s.node], c = (n.choices || []).find((x) => x.id === cid); if (!c) throw new Error(`dialogue ${s.id}: no choice ${cid} at ${s.node}`);
    s.choices.push(cid); D.runActions(s, n); D.go(s, c.target);
  };
  D.finish = function (s) {
    const n = s.tree.nodes[s.node]; D.runActions(s, n);
    if (n.next) return D.go(s, n.next);
    s.done = true; s.end = n.end || "end";
    if (s.ctx.onEnd) s.ctx.onEnd(s);
  };
  D.runActions = function (s, n) {
    for (const a of n.actions || []) {
      if (D.actions[a]) D.actions[a](s);
      else { if (!D.stubbed.includes(a)) D.stubbed.push(a); if (root.console) console.info(`[dialogue] game_action "${a}" is not implemented yet (stub)`); }
    }
  };
  // checks for tests / tools: every target and next resolves; nodes with no way on (no choices, next or end)
  D.validate = function (tree) {
    const errors = [], deadEnds = [], flagged = [], ids = Object.keys(tree.nodes);
    if (!tree.nodes[tree.start]) errors.push("start " + tree.start + " missing");
    for (const id of ids) {
      const n = tree.nodes[id];
      for (const c of n.choices || []) if (!tree.nodes[c.target]) errors.push(`${id}.${c.id} -> ${c.target} missing`);
      if (n.next && !tree.nodes[n.next]) errors.push(`${id}.next -> ${n.next} missing`);
      if (!(n.choices || []).length && !n.next && !n.end) deadEnds.push(id);
      if (n.flag) flagged.push(id);
    }
    const seen = new Set(), walk = (id) => { if (seen.has(id) || !tree.nodes[id]) return; seen.add(id); const n = tree.nodes[id]; (n.choices || []).forEach((c) => walk(c.target)); if (n.next) walk(n.next); };
    walk(tree.start);
    return { errors, deadEnds, flagged, unreachable: ids.filter((id) => !seen.has(id)) };
  };

  // ---- the game_action hooks that map to existing systems ----
  // "Show me around": the full tutorial (overlay steps), Main 1 goes active, then the building tour (the box view)
  D.actions.begin_building_introductions = function (s) {
    G.Tut.setMode("full"); if (G.Main) G.Main.onAdvisorTalked(); G.State.save();
    if (G.DialogueView && G.DialogueView.tour) s.after = (fin) => G.DialogueView.tour(s.id, fin);
  };
  // "I'll take it from here": no overlay steps, Main 1 still goes active (the journal needs a goal). Marks nothing done.
  D.actions.allow_free_exploration = function () {
    G.Tut.setMode("none"); if (G.Main) G.Main.onAdvisorTalked(); G.State.save();
  };
})(typeof window !== "undefined" ? window : globalThis);
