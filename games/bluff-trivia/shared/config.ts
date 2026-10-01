export const BLUFF_CONFIG = {
  defaultTotalRounds: 5,
  submitTimeSeconds: 25,
  votingTimeSeconds: 18,
  revealDurationSeconds: 8,
  roundResultDurationSeconds: 5,

  // Scoring
  pointsForCorrectGuess: 100, // Doğru cevabı bulan oyuncuya
  pointsPerPlayerTricked: 150, // Blöfüne inandırdığı her rakip için (+150)

  minPlayers: 2,
  maxPlayers: 12
};
