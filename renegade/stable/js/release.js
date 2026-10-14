// SP-195: release channels. A deployed build's js/build_id.js names its channel (public / stable / playtest), version,
// save epoch and storage namespace (stamped by tools/release/stamp.js from deploy.yml / promote.yml); the repo copy says
// "dev". This file decides when a channel wipes saves (js/state.js St.checkBuild asks wipeToken) and drives the public
// launch countdown banner. Headless-safe: the banner only mounts when there's a document (tests/release_channels.js).
(function (root) {
  const G = root.G, R = G.Release = {};
  const C = () => (DATA.config.release || {});
  R.CHANNELS = ["public", "stable", "playtest"];
  R.channel = () => (R.CHANNELS.includes(root.RENEGADE_CHANNEL) ? root.RENEGADE_CHANNEL : "dev");
  R.version = () => String(root.RENEGADE_VERSION || C().version || "0.0.0");
  R.epoch = () => { const n = parseInt(root.RENEGADE_SAVE_EPOCH, 10); return Number.isFinite(n) && n > 0 ? n : (C().stableEpoch || 1); };
  // what a change of means "wipe": the stored token (St.key("build")) differs from this one -> progression resets once
  R.wipeToken = function (buildId) {
    const ch = R.channel(), v = R.version();
    if (ch === "public") return /^0\.0\./.test(v) ? "public-v" + v : "public-keep";   // 0.0.x: every version wipes; 0.1.0+: keep (one wipe on leaving 0.0.x)
    if (ch === "stable") return "stable-e" + R.epoch();
    return String(buildId);   // playtest / dev / an own-server playable build: every new build (unchanged behaviour)
  };
  R.launchAt = () => Date.parse(C().launchAt);
  // the banner at time now (ms): { phase: "before" | "live" | "after", text, ms }
  R.launch = function (now) {
    const at = R.launchAt(), left = at - now, liveMs = (C().liveForHours || 24) * 3600e3;
    if (!Number.isFinite(at)) return { phase: "after", text: "", ms: 0 };
    if (left > 0) {
      const s = Math.floor(left / 1000), d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60, p = (n) => String(n).padStart(2, "0");
      return { phase: "before", ms: left, text: "Launching in " + (d ? d + "d " : "") + hh + "h " + p(mm) + "m " + p(ss) + "s" };
    }
    if (-left < liveMs) return { phase: "live", ms: left, text: "Now live!" };
    return { phase: "after", ms: left, text: "" };
  };
  R.indexable = (now) => R.channel() === "public" && now >= R.launchAt();
  R.label = () => { const ch = R.channel(); return ch === "dev" ? null : "v" + R.version() + (ch === "public" ? "" : " " + ch); };

  // ---------- the public countdown banner (browser only) ----------
  R.mountBanner = function (doc) {
    doc = doc || root.document; if (!doc || R.channel() !== "public" || doc.getElementById("launch-banner")) return null;
    const el = doc.createElement("div"); el.id = "launch-banner"; el.setAttribute("role", "status");
    el.style.cssText = "position:relative;z-index:50;text-align:center;font:bold 14px/1.2 system-ui,sans-serif;padding:6px 10px;background:#c8391f;color:#fff;letter-spacing:.02em";
    const app = doc.getElementById("app"); (app || doc.body).insertBefore(el, (app || doc.body).firstChild);
    const tick = () => { const L = R.launch(Date.now()); if (L.phase === "after") { el.remove(); clearInterval(R._t); return; }
      el.dataset.phase = L.phase; el.textContent = L.phase === "before" ? "Renegade v" + R.version() + " · " + L.text : "Renegade v" + R.version() + " · " + L.text;
      if (L.phase === "live") el.style.background = "#2f8f3a";
      if (R.indexable(Date.now())) { const m = doc.querySelector('meta[name="robots"][data-until-launch]'); if (m) m.remove(); } };   // a crawler that runs scripts sees the page indexable after launch
    tick(); R._t = setInterval(tick, 1000); return el;
  };
  if (root.document && root.document.addEventListener) {
    const go = () => R.mountBanner(root.document);
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", go); else go();
  }
})(typeof window !== "undefined" ? window : this);
