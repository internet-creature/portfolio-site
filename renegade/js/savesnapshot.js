// SP-187 save snapshot: a read-only JSON export of everything the game keeps in browser storage, for reference and for
// building sample saves. It is NOT a load path (nothing reads this file back) and it never writes or removes a key.
// Settings -> Export save (JSON) calls G.SaveSnap.download(). The console / bookmarklet copy of the same exporter for
// builds without the button is in docs/save-snapshot.md. Format: docs/save-snapshot.md. Test: tests/save_snapshot.js.
(function (root) {
  const G = root.G;
  const SS = G.SaveSnap = {};
  SS.FMT = "renegade-save-snapshot";
  SS.V = 1;
  SS.PREFIX = /^renegade/;   // every key the game, a sandbox or a published playable build (renegade_b_<label>_) uses
  const parse = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
  const keysOf = (st) => { const out = []; for (let i = 0; i < st.length; i++) out.push(st.key(i)); return out.sort(); };
  // One storage entry: the decoded value; raw only when decoding isn't byte-exact; nested = JSON kept as a string inside
  // the value (the save's s.run.snapshot, the deploy copy of the whole save), decoded by path.
  SS.entry = function (raw) {
    const v = parse(raw), e = { bytes: raw.length, value: v === undefined ? raw : v };
    if (v !== undefined && JSON.stringify(v) !== raw) e.raw = raw;
    const nested = {};
    const walk = (x, p) => {
      if (typeof x === "string") { if (/^[[{]/.test(x)) { const y = parse(x); if (y && typeof y === "object") { nested[p] = y; walk(y, p); } } }
      else if (x && typeof x === "object") for (const k in x) walk(x[k], p ? p + "." + k : k);
    };
    if (v !== undefined) walk(v, "");
    if (Object.keys(nested).length) e.nested = nested;
    return e;
  };
  SS.dump = function (st) {
    const out = {}, other = [];
    if (!st) return { entries: out, other };
    for (const k of keysOf(st)) { if (SS.PREFIX.test(k)) out[k] = SS.entry(st.getItem(k)); else other.push(k); }
    return { entries: out, other };
  };
  // ctx: { local, session, build, userAgent, url, now (Date) }. Pure: reads the two storages, returns the snapshot object.
  SS.collect = function (ctx) {
    const L = SS.dump(ctx.local), S = SS.dump(ctx.session), now = ctx.now || new Date();
    return {
      format: SS.FMT, v: SS.V, note: "Reference only. Not a load path.",
      build: String(ctx.build || "unknown"), exportedAt: now.toISOString(), url: ctx.url || "", userAgent: ctx.userAgent || "",
      keys: Object.keys(L.entries), sessionKeys: Object.keys(S.entries), otherKeys: L.other,
      local: L.entries, session: S.entries,
    };
  };
  SS.fileName = (snap, now) => { now = now || new Date(); const p = (n) => String(n).padStart(2, "0");
    return "renegade-save-" + snap.build + "-" + now.getFullYear() + "-" + p(now.getMonth() + 1) + "-" + p(now.getDate()) + ".json"; };
  SS.fromPage = function () {
    let session = null; try { session = root.sessionStorage; } catch (e) {}
    return SS.collect({ local: root.localStorage, session, build: root.BUILD_ID, userAgent: (root.navigator || {}).userAgent,
      url: root.location ? root.location.origin + root.location.pathname : "", now: new Date() });
  };
  // Browser only. The link is never attached to the page, so its click can't reach the game's own handlers.
  SS.download = function () {
    const snap = SS.fromPage(), name = SS.fileName(snap), a = root.document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return name;
  };
})(typeof window !== "undefined" ? window : globalThis);
