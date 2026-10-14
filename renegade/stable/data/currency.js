// SP-196: Chips (everyday money, plastic poker-style chips the settlement treats as real money) and Old World Money (the
// premium, pre-collapse cash; earnable only in singleplayer and pre-alpha). Both ride in the currency pouch with the retry
// tokens: weightless, never lost (death included). Numbers Megan didn't give are [GUT] (Rivet, 2026-10-13).
DATA.currency = {
  // Chips finds, rolled once per searched object on their own stream (the regular loot rolls are untouched).
  // [chance %, min, max]; the ticket's table weights read as chances. Target ~20-40 Chips per extracted early run (Megan).
  chips: {
    // [GUT] tuned 2026-10-13 from a 20-run bot sim (Hushwood + Greyback): the ticket-weight first pass gave ~16 per extracted run
    crate: [55, 3, 6], desk: [60, 2, 4], locker: [45, 2, 4], body_human: [55, 2, 5],
    safe: [100, 8, 14]
  },
  // Old World Money finds: chance % for 1. Target ~1-3 per extracted early run (Megan).
  // [GUT] tuned 2026-10-13: safes / Elites / Hunters alone gave ~0.1 per early run (they are rare early), so everyday
  // containers get a small chance too
  oldMoney: { safe: 50, crate: 10, desk: 10, locker: 8, body_human: 8, eliteBody: 30, hunterBody: 50 },
  chipsPerOldMoney: 25,   // one way only: 1 Old World Money -> 25 Chips, never back (ticket placeholder, kept) [GUT]
  // Old World Money can never pay for these (Megan, Q3): retries and reroll tokens
  oldMoneyNeverBuys: ["retry", "retryToken", "reroll", "rerollToken"],
  startingChips: 10,   // [GUT] a new save can buy a few charges from Dunn before the first run
  pouchNote: "Currency pouch: weightless, never lost."
};
