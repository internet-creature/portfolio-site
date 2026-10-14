// Slice 4 §G: the title / login screen (Megan, Sep 30 00:25 PT; art by Smudge, assets/ui/login/README.md). All numbers here.
// OSRS x WoW: the scorched RENEGADE logo, a wood-and-stone panel with Username / Password greyed out (for the future
// MMO: they do nothing), a glowing Play, the build hash bottom-left, a small sound toggle bottom-right. Behind it a
// hand-written WebGL low-poly Hushwood camp at night (js/titlescene.js, built from ui/login/login_scene.json); the stills
// cover no WebGL / reduced motion / a failed context. Music: music_title on the first tap or the 🔊 button; Play goes in
// and crossfades to the outpost. Every "file" below is under DATA.sprites.basePath and is packaged (tools/asset-manifest.js).
window.DATA = window.DATA || {};
DATA.title = {
  enabled: true,              // false: straight into the game as before
  art: {
    logoStrip: { file: "ui/login/logo_renegade_strip4.png", frame: [175, 39], frames: 4, fps: 6 },   // ember flicker, CSS steps(4)
    panel: { file: "ui/login/panel_9slice.png", slice: 12, border: 24 },          // border-image: 12 fill / 24px repeat
    divider: { file: "ui/login/panel_divider_3slice.png", slice: 6, border: 12 },
    field: { file: "ui/login/field_disabled_9slice.png", slice: 5, border: 10 },
    lock: { file: "ui/login/icon_field_lock.png" },
    labelUser: { file: "ui/login/label_username.png" }, labelPass: { file: "ui/login/label_password.png" },
    button: { normal: { file: "ui/login/btn_play_9slice_normal.png" }, hover: { file: "ui/login/btn_play_9slice_hover.png" }, pressed: { file: "ui/login/btn_play_9slice_pressed.png" } },   // DOM-text button (Login): 10 fill / 20px stretch
    play: { normal: { file: "ui/login/btn_play_normal.png" }, hover: { file: "ui/login/btn_play_hover.png" }, pressed: { file: "ui/login/btn_play_pressed.png" } },
    soundOn: { file: "ui/login/btn_sound_on.png" }, soundOnHover: { file: "ui/login/btn_sound_on_hover.png" },
    soundOff: { file: "ui/login/btn_sound_off.png" }, soundOffHover: { file: "ui/login/btn_sound_off_hover.png" },
    versionTag: { file: "ui/login/version_tag_3slice.png", slice: 4 },
    stillDesktop: { file: "ui/login/scene_still_desktop_sky.png" }, stillPhone: { file: "ui/login/scene_still_phone.png" }
  },
  scene: {
    file: "ui/login/login_scene.json",   // Smudge's scene description (numbers, materials, camera, lighting)
    webgl: true,                         // false: always the still
    fpsDesktop: 60, fpsPhone: 30,        // phones: the same tiny FBO at 30 fps ("lighter")
    phoneMaxWidth: 700,                  // narrower (or portrait) = the phone framing (216 px wide FBO, vfov 72)
    fboHeight: 360, fboWidthPortrait: 216,   // native pixels (x2+ nearest upscale); the other side follows the window's aspect
    rngSeed: 20260930,                   // the scene's small random details (rock jitter, stake tips, cone turns)
    embers: 46, stars: 420,
    fireFlicker: 0.12, fireFlickerHz: 4, flameScale: 0.12, flameJitterM: 0.08, flameShadeMs: 120,
    zbias: { flame_mid: 0.3, flame_core: 0.55, flame_tip: 0.75 },   // inner flame cones win the depth test (metres toward the camera)
    owlBlinkMs: 140,
    // Login sky B3 (Smudge, Oct 13): landscape only (portrait/phone framing keeps the old sky). A world-locked panorama
    // (sky gradient, static stars, moon + halo, the orbital planetoid; alpha 254 = moon/planetoid) replaces the procedural
    // sky + point stars, so it drifts with the camera. Beacons and the streak are drawn crisp in the sky pass (no glow),
    // behind the trees; the streak also passes behind the moon/planetoid. Reduced motion = the still (no streak, no beacons).
    sky: {
      on: true,
      pano: { file: "ui/login/sky_pano_b3.png", w: 1152, h: 576, pxPerDeg: 6.4, az0: -90.0, el1: 78.0 },
      camera: { height: 1.4, target_y: 1.0, vfov_landscape: 70.0, arc_rad: 0.22, period_s: 96.0 },   // swivel +-12.6 deg (was +-28.6), slower; sin = eased at the ends   // the camp lower in frame, looking up past the fire
      // v3: the planetoid is a low-poly 3D sphere (js/titlescene.js) at a fixed world direction, infinitely far (it moves with the
      // eye: zero translation parallax), point-sampled plate texture, lit from the moon side; beacons are points on it
      planetoid: { tex: { file: "ui/login/planetoid_plates.png" }, dir: [0.47553, 0.30902, -0.82364], angRad: 0.14, light: [-0.52685, 0.42943, -0.73349], axis: [-0.4148, 0.90442, 0.09984], front: [-0.47553, -0.30902, 0.82364],   // v4: az 30, el 18 deg, radius 8.0 deg (54% of v3 0.261 rad), 200 m; thin crescent lit from behind-left; moon at az 25, el 26 (in the pano)
                   seg: [20, 12], dist: 200, litScale: 5.0, rim: "#2b2f37", spinDegPerMin: 1.5,
                   ramp: ["#15171c", "#1f2229", "#2b2f37", "#4e5054", "#8e8e8c", "#b8b6ae"], belt: ["#c65a30", "#862c1c"],
                   beacons: [[0.45, 0.3, 0.84, 2], [0.62, -0.12, 0.77, 2], [0.28, -0.38, 0.88, 1], [0.72, 0.38, 0.58, 2]] },   // local [x, y(axis), z(front), size px]
      beacons: [[860.4, 386.1, 2], [900.2, 409.6, 2], [890.2, 405.1, 1], [854.9, 349.1, 2]],   // blink timers (v3: drawn on the 3D planetoid, see planetoid.beacons)
      beaconColour: "#c65a30", beaconOnMs: 180, beaconWaitMs: [3000, 7000], beaconFirstMs: [0, 3000],
      streak: { firstMs: [5000, 20000], waitMs: [15000, 40000], durMs: [1700, 2300], lenPx: [150, 210], angleDeg: [5, 15],
                startX: [300, 850], startY: [290, 370], tailPx: 48, colours: ["#f2efe4", "#d4c8a0", "#b8b6ae", "#8c8c86", "#5c5c5e"] }
    }
  },
  phoneBreakpoint: 700,                  // px: the phone layout (1x logo at x2, 352 px panel)
  logoScaleDesktop: 3, logoScalePhone: 2
};
