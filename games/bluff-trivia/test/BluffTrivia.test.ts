import test from 'node:test';
import assert from 'node:assert/strict';

import { QuestionManager } from '../dist/server/QuestionManager.js';
import { AnswerManager } from '../dist/server/AnswerManager.js';
import { VotingManager } from '../dist/server/VotingManager.js';
import { ScoreManager } from '../dist/server/ScoreManager.js';
import { formatBluffAnswer, normalizeForComparison } from '../dist/shared/types.js';
import { BLUFF_CONFIG } from '../dist/shared/config.js';

test('Answer formatting and normalization works with Turkish characters', () => {
  assert.equal(formatBluffAnswer('istanbul'), 'İstanbul');
  assert.equal(formatBluffAnswer('ANKARA ŞEHRİ'), 'Ankara Şehri');
  assert.equal(formatBluffAnswer('   çikolatalı   pasta   '), 'Çikolatalı Pasta');

  const norm1 = normalizeForComparison('Iğdır');
  const norm2 = normalizeForComparison('iğdir');
  assert.equal(norm1, norm2);
});

test('AnswerManager validates submissions, rejects real answers and duplicate bluffs', () => {
  const am = new AnswerManager();
  const correctAnswer = 'Cilt Kremi Ve Parfüm';

  // 1. Empty rejection
  const resEmpty = am.submitAnswer('p1', 'Player 1', '   ', correctAnswer);
  assert.equal(resEmpty.success, false);

  // 2. Real answer rejection
  const resReal = am.submitAnswer('p1', 'Player 1', 'cilt kremi ve parfum', correctAnswer);
  assert.equal(resReal.success, false);
  assert.ok(resReal.error?.includes('GERÇEK CEVAP'));

  // 3. Valid bluff submission
  const resValid1 = am.submitAnswer('p1', 'Player 1', 'Zırh Cilası', correctAnswer);
  assert.equal(resValid1.success, true);
  assert.equal(resValid1.formattedAnswer, 'Zırh Cilası');

  // 4. Duplicate bluff rejection from another player
  const resDup = am.submitAnswer('p2', 'Player 2', 'zırh cilasi', correctAnswer);
  assert.equal(resDup.success, false);
  assert.ok(resDup.error?.includes('zaten yazıldı'));

  // 5. Valid bluff from player 2
  const resValid2 = am.submitAnswer('p2', 'Player 2', 'Aşk İksiri', correctAnswer);
  assert.equal(resValid2.success, true);
});

test('VotingManager prevents voting for own bluff and prevents double votes', () => {
  const vm = new VotingManager();
  const correctAnswer = 'Emu Kuşu';
  const playerAnswers = [
    { sessionId: 'p1', nickname: 'Ali', answerText: 'Dodo Kuşu', submittedAt: 1000 },
    { sessionId: 'p2', nickname: 'Zeynep', answerText: 'Pelikan', submittedAt: 1010 },
  ];

  const choices = vm.setupChoices(correctAnswer, playerAnswers, ['Kivi Kuşu', 'Devekuşu']);
  assert.ok(choices.length >= 3);

  const aliBluff = choices.find((c) => c.authorSessionId === 'p1');
  const zeynepBluff = choices.find((c) => c.authorSessionId === 'p2');
  assert.ok(aliBluff);
  assert.ok(zeynepBluff);

  // Ali tries to vote for his own bluff
  const resSelf = vm.vote('p1', 'Ali', aliBluff.id);
  assert.equal(resSelf.success, false);
  assert.ok(resSelf.error?.includes('Kendi yazdığınız blöfe'));

  // Ali votes for Zeynep's bluff
  const resVote = vm.vote('p1', 'Ali', zeynepBluff.id);
  assert.equal(resVote.success, true);

  // Ali tries to vote again
  const resDouble = vm.vote('p1', 'Ali', zeynepBluff.id);
  assert.equal(resDouble.success, false);
  assert.ok(resDouble.error?.includes('Zaten oy'));
});

test('ScoreManager correctly computes correct guess rewards, trick rewards and Bluff Master', () => {
  const sm = new ScoreManager();
  const correctAnswer = 'Kaşlarını';

  const choices = [
    { id: 'opt_real', text: 'Kaşlarını', isReal: true, authorSessionId: '', authorNickname: '' },
    { id: 'opt_fake_ali', text: 'Bıyıklarını', isReal: false, authorSessionId: 'p_ali', authorNickname: 'Ali' },
    { id: 'opt_fake_can', text: 'Kirpiklerini', isReal: false, authorSessionId: 'p_can', authorNickname: 'Can' },
  ];

  const votes = [
    // Zeynep guesses the truth
    { voterSessionId: 'p_zeynep', voterNickname: 'Zeynep', choiceId: 'opt_real', votedAt: 100 },
    // Veli falls for Ali's bluff
    { voterSessionId: 'p_veli', voterNickname: 'Veli', choiceId: 'opt_fake_ali', votedAt: 102 },
    // Ayşe falls for Ali's bluff
    { voterSessionId: 'p_ayse', voterNickname: 'Ayşe', choiceId: 'opt_fake_ali', votedAt: 105 },
    // Ali falls for Can's bluff
    { voterSessionId: 'p_ali', voterNickname: 'Ali', choiceId: 'opt_fake_can', votedAt: 106 },
  ];

  const results = sm.calculateRoundResults(1, correctAnswer, choices, votes);

  // Zeynep should get correct guess points (+100)
  const zeynepScore = results.playerScores.get('p_zeynep');
  assert.equal(zeynepScore?.correctGained, BLUFF_CONFIG.pointsForCorrectGuess);
  assert.equal(zeynepScore?.totalRound, BLUFF_CONFIG.pointsForCorrectGuess);

  // Ali tricked 2 people (+200), totalRound = 200
  const aliScore = results.playerScores.get('p_ali');
  assert.equal(aliScore?.trickGained, 2 * BLUFF_CONFIG.pointsPerPlayerTricked);
  assert.equal(aliScore?.totalRound, 2 * BLUFF_CONFIG.pointsPerPlayerTricked);

  // Can tricked 1 person (+100)
  const canScore = results.playerScores.get('p_can');
  assert.equal(canScore?.trickGained, 1 * BLUFF_CONFIG.pointsPerPlayerTricked);

  // Bluff Master should be Ali with 2 victims
  assert.equal(results.bluffMasterName, 'Ali');
  assert.equal(results.bluffMasterCount, 2);
  assert.equal(results.truthStumped, false);
});

test('ScoreManager detects truthStumped when nobody guesses the real answer', () => {
  const sm = new ScoreManager();
  const choices = [
    { id: 'opt_real', text: 'Wells Fargo', isReal: true, authorSessionId: '', authorNickname: '' },
    { id: 'opt_fake', text: 'HSBC', isReal: false, authorSessionId: 'p1', authorNickname: 'Mert' },
  ];

  const votes = [
    { voterSessionId: 'p2', voterNickname: 'Bora', choiceId: 'opt_fake', votedAt: 100 },
  ];

  const results = sm.calculateRoundResults(1, 'Wells Fargo', choices, votes);
  assert.equal(results.truthStumped, true);
});

test('QuestionManager draws unique non-repeating questions across a match', () => {
  const qm = new QuestionManager();
  qm.resetMatchDeck();

  const drawnIds = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const q = qm.nextQuestion();
    assert.ok(!drawnIds.has(q.id), `Question ${q.id} was repeated!`);
    drawnIds.add(q.id);
  }
  assert.equal(drawnIds.size, 10);
});
