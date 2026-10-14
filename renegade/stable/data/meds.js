// SP-194 (Megan, design locked 2026-10-13): Med Supplies are one pool of charges (state.stash.res.med) that lives in your
// pouch: weightless, never lost, usable at camp and on runs. Loot never drops "Med kits": it rolls a named med item from
// this table and adds its charge value at once (the item never enters the pack). Pain pills, Morphine and the special
// meds are their own pouch stacks (stash.res.pills, stash.res.morphine, stash.specialMeds), used in battle only.
// Numbers marked [DRAFT] are gut calls (Megan's standing rule: best judgment unless she gave a number).
window.DATA = window.DATA || {};
DATA.meds = {
  // rarity colours for the med table only (gear rarities have no green; the colours follow data/forestmap.js's ladder)
  rarities: {
    white:  { name: "Common",    color: "#e8e8e8", rank: 0 },
    green:  { name: "Uncommon",  color: "#5fd35f", rank: 1 },
    blue:   { name: "Rare",      color: "#4aa3ff", rank: 2 },
    yellow: { name: "Epic",      color: "#ffd84a", rank: 3 },
    purple: { name: "Legendary", color: "#c070ff", rank: 4 },
    orange: { name: "Mythic",    color: "#ff9a3a", rank: 5 }
  },
  // charge items: [id, name, charges, rarity, base weight]; a row's weight is split evenly across its items (design table)
  charges: [
    { charges: 1,  rarity: "white",  weight: 50,   items: ["Bandage", "Sterile gauze pad", "Medical adhesive tape", "Hydrocolloid dressing", "Sterile saline wash", "Antibiotics"] },
    { charges: 2,  rarity: "green",  weight: 25,   items: ["Splint", "Gauze roll", "Hypodermic syringe", "IV set"] },
    { charges: 3,  rarity: "blue",   weight: 12,   items: ["Trauma pressure dressing", "Windlass tourniquet"] },
    { charges: 4,  rarity: "blue",   weight: 6,    items: ["Hemostatic gauze", "Chest decompression needle"] },
    { charges: 5,  rarity: "yellow", weight: 4,    items: ["First-aid kit", "IFAK"] },
    { charges: 6,  rarity: "yellow", weight: 1.8,  items: ["Trauma bag"] },
    { charges: 7,  rarity: "purple", weight: 0.7,  items: ["Portable defibrillator"] },
    { charges: 8,  rarity: "purple", weight: 0.3,  items: ["Tech bandage"] },
    { charges: 9,  rarity: "orange", weight: 0.15, items: ["Healing gel"] },
    { charges: 10, rarity: "orange", weight: 0.05, items: ["Medical nanites"] }
  ],
  // the battle-only stacks, rolled from the same table as items
  pills:    { name: "Pain pills", rarity: "blue",   weight: 8 },
  morphine: { name: "Morphine",   rarity: "purple", weight: 1.5 },
  // the rare sci-fi tier: only at medical locations, Med crates and Pharmacy safes (medOnly)
  specials: {
    mender:    { name: "Mender Patch",      rarity: "purple", weight: 0.4, desc: "Slow heal: 1% Max HP a second for 40 s.",                     hot: { pps: 1, sec: 40 } },
    mist:      { name: "Regen Mist",        rarity: "purple", weight: 0.4, desc: "Heals the target and allies within 4 m: 3% Max HP a second for 5 s.", hot: { pps: 3, sec: 5 }, radiusM: 4 },
    amplifier: { name: "Amplifier Ampoule", rarity: "purple", weight: 0.4, desc: "+50% healing received for 20 s.",                          amp: { mult: 1.5, sec: 20 } },
    quickseal: { name: "Quickseal Foam",    rarity: "orange", weight: 0.1, desc: "Heals 30% Max HP at once, with no heal cooldown.",          healPct: 30 },
    surge:     { name: "Surge Injector",    rarity: "orange", weight: 0.1, desc: "Fast heal: 6% Max HP a second for 5 s, no heal cooldown while it runs.", hot: { pps: 6, sec: 5 }, noCdSec: 5 }
  },
  medicalShift: { mult: 3, fromRarity: "blue" },   // [DRAFT] medical spots, the Med stockpile and its crate: blue and above x3
  pillCooldown: { baseSec: 3, perMedicine: 0.1, minSec: 1 },   // [DRAFT] shared by the squad (one bottle): pills and Morphine
  morphineSec: 8,                                              // [DRAFT] no heal cooldown on that unit for this long
  battleOnly: "Only useful mid-fight"
};
