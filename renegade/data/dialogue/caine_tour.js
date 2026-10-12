// SP-157 / SP-192 / SP-004: hand-written parts of Caine's dialogue that the authoring draft doesn't carry.
// speakers: how a draft speaker id shows in the dialogue box (null = no name line, e.g. narration).
// tour: the begin_building_introductions action (js/dialogueview.js). One box per building, in order, each with a ring
//   on `target` (CSS selector; every match is ringed as one box). The box sits centred near the bottom and moves to the
//   top when the ring would be under it. {name} / {they} /
//   {them} / {their} come from the new-game name + gender step (state.player).
window.DATA = window.DATA || {}; DATA.dialogue = DATA.dialogue || {};
DATA.dialogue.speakers = { Caine: "Caine", note: "A note, in your handwriting", narrator: null };
// Copy: Vixie's SP-192 draft (building intros, walk-around order), with "Chief" read as {name} until Megan picks the
// form of address. Med kit lines and hard-coded numbers are left out until SP-194 settles them.
DATA.dialogue.caine.tour = [
  { id: "hideout",   target: ".town-stage",           speaker: "Caine", text: "Welcome home, {name}. The palisade held while you were away, and the bonfire's still lit. Let me walk you round so you can get your bearings. Everything here answers to you." },   // SP-004 hideout intro
  { id: "stockpile", target: "[data-hs=stockpile]",   speaker: "Caine", text: "The Stockpile. Every bit of Scrap, Cloth, Food and Water you haul home goes here. No cap, and nothing rots. It pays for everything we build." },
  { id: "vault",     target: "[data-hs=vault]",       speaker: "Caine", text: "Your Vault. Every piece of gear you bring home sleeps here. Upgrade it and we'll fit more, and your Secure Pouch gets bigger too." },
  { id: "body_lab",  target: "[data-hs=body_lab]",    speaker: "Caine", text: "The Body Lab, where your spare bodies wait. Choose which one you wear down the Trapdoor. If one falls out there, it rests here until it's mended." },
  { id: "stores",    target: "[data-hs=dunn_stores]", speaker: "Caine", text: "Dunn keeps our stores, and he's always got work. Help him out and he'll knock some Food and Water off our building costs." },
  { id: "ilse",      target: "[data-hs=ilse_tent]",   speaker: "Caine", text: "Doc Ilse patches up the wounded. Injuries heal on their own after a few runs. She has jobs for you too." },
  { id: "recruit",   target: "[data-hs=lot_recruit]", speaker: "Caine", text: "Grunts will sign on for Food and Water. Hire them here to fill out your squad. They'll fight for you and some won't come back, so keep a spare or two." },
  { id: "memorial",  target: "[data-hs=memorial]",    speaker: "Caine", text: "The Memorial Wall. Everyone who fell in your service, newest first. We don't forget them, {name}." },
  { id: "workshop",  target: "[data-hs=workshop]",    speaker: "Caine", text: "The old Workshop, waiting on your word. Build a Workbench and we can craft ammo and gear from the Stockpile. The work carries on while you rest." },
  { id: "radio",     target: "[data-hs=lot_comms]",   speaker: "Caine", text: "Raise a Radio on this lot and you'll get a bounty board, word on the rival crews, and someone to decode the Data Shards you bring back." },
  { id: "still",     target: "[data-hs=lot_still]",   speaker: "Caine", text: "A Water Still would give us a trickle of Water while you're away, and a garden later on. It won't replace a run, but it softens a bad streak." },
  { id: "trapdoor",  target: "[data-hs=trapdoor]",    speaker: "Caine", text: "The Trapdoor, {name}. Your way down to the Hushwood and beyond. Pick your squad and your gear, then drop when you're ready. I'll keep the fire going." }   // SP-004 trapdoor ring
];
