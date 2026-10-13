// SP-157 / SP-193: who talks in the dialogue box and how they look. Megan swaps a speaker's head here, nothing else.
// speakers: how a draft speaker id shows on the name plate (null = no name plate, e.g. narration).
// heads: the talking 3D chathead for a speaker (js/chathead.js). file = a glb under assets/ with the SP-193 rig
//   (shoulders / head / jaw / eye_l / eye_r) and the "talk" + "blink" clips. badge = the letter shown in the portrait
//   when WebGL or the glb isn't available. A speaker with no head entry gets no portrait.
// box: the dialogue box's typewriter and chathead timings (Smudge's SP-193 fonts/README.md, as mocked).
window.DATA = window.DATA || {}; DATA.dialogue = DATA.dialogue || {};
DATA.dialogue.speakers = { Caine: "Caine", note: "A note, in your handwriting", narrator: null };
DATA.dialogue.heads = {
  // Caine uses the default soldier for now: SP-193 option B, Guard Brannock (674 tris). Swap the file when his own head exists.
  Caine: { file: "3d/chatheads/brannock.glb", badge: "C" }
};
DATA.dialogue.box = {
  cps: 43,                 // typewriter speed, characters a second (75 characters in about 1.75 s)
  talkFadeSec: 0.2,        // when the line finishes, "talk" fades out over this so the jaw settles shut
  blinkSec: [2.5, 5],      // idle: "blink" on a random timer in this range
  blipMinMs: 45,           // dialogue_blip hook (for Snare): at most one per this many ms; spaces and punctuation skipped
  portraitPx: 128,         // the chathead renders at 1x into a portrait this size (image-rendering: pixelated)
  // packed by tools/asset-manifest.js (paths under assets/); css/dialogue.css loads them
  files: [{ file: "fonts/PressStart2P.woff2" }, { file: "fonts/PressStart2P-OFL.txt" }, { file: "ui/dialog_m1_riveted_steel.png" }]
};
