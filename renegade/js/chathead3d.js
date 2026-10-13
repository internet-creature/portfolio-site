// SP-193: the talking 3D chathead (ES module, loaded on demand by js/chathead.js). ONE WebGLRenderer for every
// portrait, kept for the session (SP-118: a context per dialogue would hit Chrome's ~16-context cap and can force-lose
// the 3D battle renderer). Smudge's setup: MeshToonMaterial with the SP-129 4-band ramp, hemi 1.5, warm key from the
// front-right, cool rim from behind; fov 24, 1.3 m out, 40 deg off axis, aimed at y 0.115; 1x, pixelated.
// Clips: "talk" loops while a line types, fading out when it ends; "blink" fires on a random idle timer.
// The loop only redraws while something animates.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
let R = null; const glbs = new Map();
export const stats = { contexts: 0, frames: 0, blinks: 0, talkStarts: 0 };
function make(px) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  stats.contexts++;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setPixelRatio(1); renderer.setSize(px, px, false);
  renderer.domElement.className = "dlg-head-gl";
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xc0ccd8, 0x2a3020, 1.5));
  const key = new THREE.DirectionalLight(0xf2c890, 2.6); key.position.set(-1.2, 1.0, 1.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fa8c0, 1.4); rim.position.set(1.5, 0.8, -1.2); scene.add(rim);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 20), A = 40 * Math.PI / 180, tgt = new THREE.Vector3(0, 0.115, 0);
  cam.position.set(-Math.sin(A) * 1.3, tgt.y + 0.08, Math.cos(A) * 1.3); cam.lookAt(tgt);
  const bands = new THREE.DataTexture(new Uint8Array([60, 120, 185, 255]), 4, 1, THREE.RedFormat);
  bands.minFilter = bands.magFilter = THREE.NearestFilter; bands.needsUpdate = true;
  return { renderer, canvas: renderer.domElement, scene, cam, bands, clock: new THREE.Clock(), model: null, mixer: null, talk: null, blink: null, raf: 0, until: 0, talking: false, timer: 0, blinkSec: [2.5, 5] };
}
// the live shared renderer (recreated only if its context was lost)
export function ensure(px) {
  if (R && !R.renderer.getContext().isContextLost()) return R;
  R = make(px || 128); return R;
}
function load(url) {
  if (!glbs.has(url)) glbs.set(url, new Promise((ok, no) => new GLTFLoader().load(url, ok, undefined, no)).catch((e) => { glbs.delete(url); throw e; }));
  return glbs.get(url);
}
// put a speaker's head in the shared scene; resolves to the canvas once the first frame is drawn
export async function show(url, opts) {
  const r = ensure(opts && opts.px); if (opts && opts.blinkSec) r.blinkSec = opts.blinkSec;
  const g = await load(url);
  if (r.model !== g.scene) {
    if (r.model) r.scene.remove(r.model);
    g.scene.traverse((m) => { if (m.isMesh && !m.material.isMeshToonMaterial) { const s = m.material; m.material = new THREE.MeshToonMaterial({ gradientMap: r.bands, color: s.color, vertexColors: !!m.geometry.attributes.color }); } });
    r.scene.add(g.scene); r.model = g.scene;
    r.mixer = new THREE.AnimationMixer(g.scene);
    const clip = (n) => g.animations.find((a) => a.name === n);
    r.talk = clip("talk") ? r.mixer.clipAction(clip("talk")) : null;
    r.blink = clip("blink") ? r.mixer.clipAction(clip("blink")) : null;
    if (r.blink) { r.blink.setLoop(THREE.LoopOnce, 1); r.blink.clampWhenFinished = false; }
  }
  if (r.talk) { r.talk.stop(); } r.talking = false;
  r.mixer.setTime(0); r.renderer.render(r.scene, r.cam); stats.frames++;
  idle(); return r.canvas;
}
function run(sec) {
  R.until = Math.max(R.until, performance.now() + sec * 1000);
  if (R.raf) return;
  R.clock.getDelta();
  const tick = () => {
    if (!R) return;
    R.mixer.update(Math.min(R.clock.getDelta(), 0.1)); R.renderer.render(R.scene, R.cam); stats.frames++;
    if (R.talking || performance.now() < R.until) R.raf = requestAnimationFrame(tick); else R.raf = 0;
  };
  R.raf = requestAnimationFrame(tick);
}
function idle() {
  clearTimeout(R.timer);
  const [a, b] = R.blinkSec;
  R.timer = setTimeout(() => { if (!R || !R.blink || !R.canvas.isConnected) return; R.blink.reset().play(); stats.blinks++; run(0.25); idle(); }, (a + Math.random() * (b - a)) * 1000);
}
export function blinkNow() { if (R && R.blink) { R.blink.reset().play(); stats.blinks++; run(0.25); } }
// talk on while the line types; off fades it out so the jaw settles shut
export function setTalking(on, fadeSec) {
  if (!R || !R.talk || R.talking === !!on) return;
  R.talking = !!on;
  if (on) { stats.talkStarts++; R.talk.reset().setEffectiveWeight(1).play(); run(0); }
  else { R.talk.fadeOut(fadeSec == null ? 0.2 : fadeSec); run((fadeSec == null ? 0.2 : fadeSec) + 0.05); }
}
export function state() { return { live: !!R && !R.renderer.getContext().isContextLost(), talking: !!(R && R.talking), animating: !!(R && R.raf), stats: Object.assign({}, stats) }; }
export function sleep() { if (!R) return; clearTimeout(R.timer); R.talking = false; if (R.raf) cancelAnimationFrame(R.raf); R.raf = 0; }
