export const BLUFF_CONFIG = {
  defaultTotalRounds: 5,
  submitTimeSeconds: 30,
  votingTimeSeconds: 20,
  revealDurationSeconds: 10,
  roundResultDurationSeconds: 6,

  // Scoring
  pointsForCorrectGuess: 100, // Doğru cevabı bulan oyuncuya (+100)
  pointsPerPlayerTricked: 100, // Blöfüne inandırdığı her rakip için (+100)
  pointsFriendsSubjectBonus: 100, // Arkadaş modunda arkadaşları bildiğinde konu oyuncuya

  maxAnswerLength: 80,
  minAnswerLength: 2,

  minPlayers: 2,
  maxPlayers: 12
};
