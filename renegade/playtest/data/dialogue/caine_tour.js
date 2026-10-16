// SP-157 / SP-192 / SP-004: hand-written parts of Caine's dialogue that the authoring draft doesn't carry.
// (speakers and their chathead models: data/dialogue/speakers.js)
// tour: the begin_building_introductions action (js/dialogueview.js). One box per building, in order, each with a ring
//   on `target` (CSS selector; every match is ringed as one box). The box sits centred near the bottom and moves to the
//   top when the ring would be under it. {name} / {they} /
//   {them} / {their} come from the new-game name + gender step (state.player).
window.DATA = window.DATA || {}; DATA.dialogue = DATA.dialogue || {};
// Copy: SP-201 final script (Megan's 10/14 notes over Vixie's 10/13 pass). No Vault or Water Still step.
// The copy pass keeps distinctive lines and checks instructions against the current mechanics; no fixed Med Supplies quantities.
DATA.dialogue.caine.tour = [
  { id: "hideout",   target: ".town-stage",           speaker: "Caine", text: "It's good to have you back. The palisade held. Let me walk you 'round so you can get reacquainted. There is much to get done." },   // SP-004 hideout intro
  { id: "stockpile", target: "[data-hs=stockpile]",   speaker: "Caine", text: "This is where we'll collect most of the supplies you find out there. Our most pressing need is food and water for the camp." },
  { id: "body_lab",  target: "[data-hs=body_lab]",    speaker: "Caine", text: "This is the Body Lab. It's a strange place, so I'll go slow. When you go down the Trapdoor, you go in a body. If that body falls out there, you wake up here in another." },
  { id: "body_lab_2", target: "[data-hs=body_lab]",    speaker: "Caine", text: "The bodies you claim on runs come back to these slabs. Choose which one you'll wear before each drop, and keep a second one ready. I'd rather we never needed it." },
  { id: "stores",    target: "[data-hs=dunn_stores]", speaker: "Caine", text: "Dunn keeps our stores, and he's always got work. Help him out and he'll knock some Food and Water off our building costs. He trades Med Supplies and Pain pills for Chips, too." },
  { id: "ilse",      target: "[data-hs=ilse_tent]",   speaker: "Caine", text: "Doc Ilse has work for you. Injuries heal on their own after a few runs. Give her an Infirmary and she can treat them sooner." },
  { id: "recruit",   target: "[data-hs=lot_recruit]", speaker: "Caine", text: "Folk out there will sign on for Food and Water. Bring them in and they'll stand with your squad. Look after them. They've got names, and people waiting on them too." },
  { id: "memorial",  target: "[data-hs=memorial]",    speaker: "Caine", text: "The Memorial Wall. Everyone who fell in your service, newest first. We don't forget them, {name}." },
  { id: "workshop",  target: "[data-hs=workshop]",    speaker: "Caine", text: "The old Workshop, waiting on your word. Build a Workbench here and we can make ammo and gear from what's in the Stockpile." },
  { id: "radio",     target: "[data-hs=lot_comms]",   speaker: "Caine", text: "Raise a Radio on this lot and we'll hear calls from across the wastes. Missions, mostly, and some can come with great reward." },
  { id: "trapdoor",  target: "[data-hs=trapdoor]",    speaker: "Caine", text: "The Trapdoor, {name}. Your way down to the Hushwood and beyond. Pick your squad and your gear, then drop when you're ready. I'll keep the fire going." }   // SP-004 trapdoor ring
];
