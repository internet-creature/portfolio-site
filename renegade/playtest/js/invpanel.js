// SP-117: the in-run inventory side panel. Drop opens a slider (how many, and the weight that frees up) instead of
// "Drop 1", and a render never throws away where you had scrolled to (G.InvPanel.keepScroll wraps UI.render).
(function (root) {
  const G = root.G;
  const IP = (G.InvPanel = { open: null });
  const h = (...a) => G.UI.h(...a);
  // a bag resource's Drop control: a button, or (while open) a slider with Drop N / Cancel
  IP.dropCtl = function (k) {
    const X = G.Exp, R = DATA.items.resources[k], have = G.state.run.bag.res[k] || 0;
    if (IP.open !== k) return h("button", { "data-act": "drop-open", "data-res": k, onclick: () => { IP.open = k; G.UI.render(); } }, "Drop");
    const label = h("span", { class: "drop-n" });
    const range = h("input", { type: "range", min: "1", max: String(have), value: String(have), "data-drop-range": k });
    const go = h("button", { class: "primary", "data-act": "drop-confirm" });
    const sync = () => {
      const n = +range.value;
      label.textContent = `${n} of ${have} (${G.Util.fmt1(n * R.kgPerUnit)} kg)`;
      go.textContent = `Drop ${n}`;
    };
    range.addEventListener("input", sync);
    go.onclick = () => { X.dropRes(k, +range.value); IP.open = null; G.UI.render(); };
    sync();
    return h("div", { class: "drop-slider", "data-drop": k }, range, label, go, h("button", { "data-act": "drop-cancel", onclick: () => { IP.open = null; G.UI.render(); } }, "Cancel"));
  };
  // remember every scrolled box under #screen before a render and put it back after (keyed by class and position)
  const key = (el) => {
    const parts = [];
    for (let e = el; e && e.id !== "screen"; e = e.parentElement) parts.push(e.dataset.ifpTab || e.className || e.tagName);
    return parts.join("<");
  };
  IP.saveScroll = function () {
    const scr = document.querySelector("#screen"), out = {};
    if (!scr) return out;
    for (const el of scr.querySelectorAll("*")) if (el.scrollTop > 0) out[key(el)] = el.scrollTop;
    return out;
  };
  IP.restoreScroll = function (kept) {
    const scr = document.querySelector("#screen");
    if (!scr || !Object.keys(kept).length) return;
    for (const el of scr.querySelectorAll("*")) { const v = kept[key(el)]; if (v) el.scrollTop = v; }
  };
})(typeof window !== "undefined" ? window : globalThis);
