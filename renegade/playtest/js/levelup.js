// SP-229: the player's own level-ups (Character, Body) get a banner across the screen, with the sting js/xp.js plays.
// Listens to G.XP (logic emits { rank, lvl }); skill level-ups keep their floating text (js/xpfloat.js).
(function (root) {
  const G = root.G;
  const LU = G.LevelUp = { el: null, timer: null };
  const T = () => DATA.levelUp;
  LU.text = function (ev) {
    const t = T()[ev.rank];
    return t ? { title: t.title.replace("{n}", ev.lvl), sub: t.sub, rank: ev.rank } : null;
  };
  // Body and Character can level on the same XP gain: queue them, one banner after the other (Maple's review)
  LU.queue = [];
  LU.show = function (ev) {
    const t = LU.text(ev); if (!t || typeof document === "undefined") return;
    if (LU.el) { LU.queue.push(t); return; }
    LU.draw(t, ev.rank);
  };
  LU.draw = function (t, rank) {
    const el = LU.el = document.createElement("div");
    el.className = "levelup-banner";
    if (rank) el.dataset.rank = rank;
    el.setAttribute("role", "status");
    const a = document.createElement("div"); a.className = "lu-title"; a.textContent = t.title;
    const b = document.createElement("div"); b.className = "lu-sub"; b.textContent = t.sub;
    el.appendChild(a); el.appendChild(b);
    document.body.appendChild(el);
    LU.timer = setTimeout(() => { el.classList.add("out");
      setTimeout(() => { el.remove(); if (LU.el === el) LU.el = null; const next = LU.queue.shift(); if (next) LU.draw(next, next.rank); }, 600); }, T().showMs);
  };
  G.XP.listeners.push((ev) => { if (ev.levelUp && ev.rank) LU.show(ev); });
})(typeof window !== "undefined" ? window : globalThis);
