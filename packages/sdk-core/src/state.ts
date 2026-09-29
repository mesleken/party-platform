import { schema, t } from '@colyseus/schema';

export const PlayerState = schema({
  id: t.string(),
  nickname: t.string(),
  avatar: t.string(),
  isConnected: t.boolean(),
  isReady: t.boolean(),
  isHost: t.boolean(),
  seat: t.number(),
  score: t.number(),
  lastReactionTime: t.number(),
  hasPressed: t.boolean(),
  rank: t.number(),
  selectedOption: t.number(), // -1: henüz seçmedi, 0: A, 1: B, 2: C, 3: D
  isCorrect: t.boolean(),
  streak: t.number()
});

export const SessionState = schema({
  roomCode: t.string(),
  status: t.string(), // 'lobby' | 'countdown' | 'red' | 'green' | 'quiz_question' | 'quiz_result' | 'round_result' | 'game_over'
  activeGameId: t.string(), // Şu an oynanan oyun ('reaction-rush' | 'quiz-arena')
  selectedGameId: t.string(), // Lobide seçili olan oyun
  currentRound: t.number(),
  totalRounds: t.number(),
  countdown: t.number(),
  greenTimestamp: t.number(),
  winnerNickname: t.string(),

  // Quiz Arena Spesifik State
  quizQuestion: t.string(),
  quizCategory: t.string(),
  quizOptionA: t.string(),
  quizOptionB: t.string(),
  quizOptionC: t.string(),
  quizOptionD: t.string(),
  quizCorrectIndex: t.number(), // -1: gizli, 0-3: açıklandı
  quizTimeLeft: t.number(),

  players: t.map(PlayerState)
});

export type PlayerStateType = InstanceType<typeof PlayerState>;
export type SessionStateType = InstanceType<typeof SessionState>;
