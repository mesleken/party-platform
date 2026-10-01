import { BLUFF_CONFIG } from '../shared/config.js';
import type { AnonymousChoice, VoteRecord, RevealItem, RoundScoringResult } from '../shared/types.js';

export class ScoreManager {
  public calculateRoundResults(
    round: number,
    correctAnswer: string,
    choices: AnonymousChoice[],
    votes: VoteRecord[]
  ): RoundScoringResult {
    // Map choice ID to list of voters
    const choiceVoters = new Map<string, string[]>(); // choiceId -> voterNicknames
    const choiceVoterIds = new Map<string, string[]>(); // choiceId -> voterSessionIds

    for (const c of choices) {
      choiceVoters.set(c.id, []);
      choiceVoterIds.set(c.id, []);
    }

    for (const v of votes) {
      const votersList = choiceVoters.get(v.choiceId);
      const voterIdList = choiceVoterIds.get(v.choiceId);
      if (votersList) votersList.push(v.voterNickname);
      if (voterIdList) voterIdList.push(v.voterSessionId);
    }

    // Player round points tracker: sessionId -> { correctGained, trickGained, totalRound }
    const playerScores = new Map<
      string,
      { correctGained: number; trickGained: number; totalRound: number }
    >();

    const getPlayerScore = (sid: string) => {
      let rec = playerScores.get(sid);
      if (!rec) {
        rec = { correctGained: 0, trickGained: 0, totalRound: 0 };
        playerScores.set(sid, rec);
      }
      return rec;
    };

    let bluffMasterName = '';
    let maxTrickedCount = 0;

    // Build reveals
    const reveals: RevealItem[] = choices.map((c) => {
      const voters = choiceVoters.get(c.id) || [];
      const voterIds = choiceVoterIds.get(c.id) || [];

      if (c.isReal) {
        // True answer: reward each voter
        for (const vid of voterIds) {
          const s = getPlayerScore(vid);
          s.correctGained += BLUFF_CONFIG.pointsForCorrectGuess;
          s.totalRound += BLUFF_CONFIG.pointsForCorrectGuess;
        }
      } else if (c.authorSessionId) {
        // Fake answer: reward the author for each victim
        const victimCount = voters.length;
        if (victimCount > 0) {
          const s = getPlayerScore(c.authorSessionId);
          const gained = victimCount * BLUFF_CONFIG.pointsPerPlayerTricked;
          s.trickGained += gained;
          s.totalRound += gained;

          if (victimCount > maxTrickedCount) {
            maxTrickedCount = victimCount;
            bluffMasterName = c.authorNickname;
          }
        }
      }

      return {
        id: c.id,
        text: c.text,
        isCorrect: c.isReal,
        authorName: c.isReal ? 'GERÇEK CEVAP' : c.authorNickname,
        authorSessionId: c.authorSessionId,
        votes: voters.length,
        voters
      };
    });

    return {
      round,
      correctAnswer,
      reveals,
      playerScores,
      bluffMasterName: maxTrickedCount > 0 ? bluffMasterName : '',
      bluffMasterCount: maxTrickedCount
    };
  }
}
