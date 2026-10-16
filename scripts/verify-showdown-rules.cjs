const { SquadValidator, MANDATORY_QUOTAS } = require('../games/transfer-showdown/dist/server/SquadValidator.js');
const { PLAYER_DATABASE } = require('../games/transfer-showdown/dist/shared/player-database.js');

console.log('=== TEST 1: Strict Quota Validation (10 players: 1 GK, 2 DEF, 5 MID, 2 FWD) ===');
const m1 = {
  sessionId: 'p1',
  nickname: 'TestManager',
  teamIndex: 0,
  budget: 50,
  availableMaxBid: 50,
  rosterCount: 10,
  isSquadFull: false,
  positionCounts: { GK: 1, DEF: 2, MID: 5, FWD: 2 },
  cards: [
    { id: 'c1', position: 'GK', name: 'Yashin', ovr: 94 },
    { id: 'c2', position: 'DEF', name: 'Maldini', ovr: 93 },
    { id: 'c3', position: 'DEF', name: 'Beckenbauer', ovr: 94 },
    { id: 'c4', position: 'MID', name: 'Zidane', ovr: 94 },
    { id: 'c5', position: 'MID', name: 'Iniesta', ovr: 91 },
    { id: 'c6', position: 'MID', name: 'Xavi', ovr: 90 },
    { id: 'c7', position: 'MID', name: 'Pirlo', ovr: 90 },
    { id: 'c8', position: 'MID', name: 'KDB', ovr: 91 },
    { id: 'c9', position: 'FWD', name: 'Messi', ovr: 93 },
    { id: 'c10', position: 'FWD', name: 'CR7', ovr: 93 }
  ]
};

const fwdCard = { id: 'c11_fwd', position: 'FWD', name: 'Haaland', ovr: 91 };
const midCard = { id: 'c11_mid', position: 'MID', name: 'Modric', ovr: 89 };
const gkCard = { id: 'c11_gk', position: 'GK', name: 'Buffon', ovr: 92 };
const defCard = { id: 'c11_def', position: 'DEF', name: 'Van Dijk', ovr: 89 };

const checkFwd = SquadValidator.canPickCard(m1, fwdCard);
const checkMid = SquadValidator.canPickCard(m1, midCard);
const checkGk = SquadValidator.canPickCard(m1, gkCard);
const checkDef = SquadValidator.canPickCard(m1, defCard);

console.log('Pick FWD check:', checkFwd);
console.log('Pick MID check:', checkMid);
console.log('Pick GK check:', checkGk);
console.log('Pick DEF check:', checkDef);

if (checkFwd.canPick === false && checkMid.canPick === false && checkGk.canPick === false && checkDef.canPick === true) {
  console.log('✅ TEST 1 PASSED: Only DEF is allowed when 1 slot remains and DEF is needed!');
} else {
  console.error('❌ TEST 1 FAILED!');
  process.exit(1);
}

console.log('\n=== TEST 2: Strict Quota Validation (9 players: 1 GK, 1 DEF, 5 MID, 2 FWD) ===');
const m2 = {
  sessionId: 'p2',
  nickname: 'TestManager2',
  teamIndex: 0,
  budget: 50,
  availableMaxBid: 50,
  rosterCount: 9,
  isSquadFull: false,
  positionCounts: { GK: 1, DEF: 1, MID: 5, FWD: 2 },
  cards: m1.cards.slice(0, 9) // 1 GK, 2 DEF -> slice gives 1 GK, 2 DEF ... let's replace 1 DEF with MID
};
m2.cards[2] = { id: 'c_mid_extra', position: 'MID', name: 'Bellingham', ovr: 90 };
// Now cards: 1 GK, 1 DEF, 5 MID, 2 FWD = 9 cards. Needs 2 DEF! Remaining slots = 2.
const check2Fwd = SquadValidator.canPickCard(m2, fwdCard);
const check2Def = SquadValidator.canPickCard(m2, defCard);

console.log('Pick FWD check (needed 2 DEF, 2 slots left):', check2Fwd);
console.log('Pick DEF check (needed 2 DEF, 2 slots left):', check2Def);

if (check2Fwd.canPick === false && check2Def.canPick === true) {
  console.log('✅ TEST 2 PASSED: Only DEF is allowed when remaining slots equal needed DEF!');
} else {
  console.error('❌ TEST 2 FAILED!');
  process.exit(1);
}

console.log('\n=== TEST 3: Real Player Photos in PLAYER_DATABASE ===');
const wikimediaPhotos = PLAYER_DATABASE.filter(p => p.photoUrl && p.photoUrl.includes('wikimedia.org'));
console.log(`Verified Wikimedia photos count: ${wikimediaPhotos.length} / ${PLAYER_DATABASE.length}`);
const sampleStars = ['Erling Haaland', 'Lionel Messi', 'Cristiano Ronaldo', 'Lev Yashin', 'Paolo Maldini', 'Zinedine Zidane'];
sampleStars.forEach(name => {
  const p = PLAYER_DATABASE.find(c => c.name === name);
  console.log(`${p.name} photo:`, p.photoUrl);
});

if (wikimediaPhotos.length >= 120) {
  console.log('✅ TEST 3 PASSED: High coverage of authentic Wikipedia portraits!');
} else {
  console.error('❌ TEST 3 FAILED!');
  process.exit(1);
}

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🎉');
