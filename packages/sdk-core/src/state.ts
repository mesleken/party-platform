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
  streak: t.number(),
  // Football alanları
  team: t.string(), // 'blue' | 'red' | ''
  controlledPlayerId: t.string(), // Saha oyuncusunun ID'si (ör. 'blue_1')
  // Bluff Trivia alanları
  bluffAnswer: t.string(),
  bluffSubmitted: t.boolean(),
  hasVotedBluff: t.boolean(),
  votedBluffId: t.string(),
  roundBluffGains: t.number(),
  trickedCount: t.number()
});


export const FootballPlayerEntity = schema({
  id: t.string(),
  team: t.string(), // 'blue' | 'red'
  role: t.string(), // 'goalkeeper' | 'defender' | 'midfielder' | 'forward'
  isGoalkeeper: t.boolean(),
  controlledBySessionId: t.string(), // İnsan ise sessionId, AI ise ''
  controlledByName: t.string(),
  x: t.number(),
  y: t.number(),
  z: t.number(),
  vx: t.number(),
  vz: t.number(),
  angle: t.number(), // Radyan cinsinden bakış açısı
  isSprinting: t.boolean(),
  isTackling: t.boolean(),
  isStunned: t.boolean(),
  hasBall: t.boolean(),
  number: t.number(),
  name: t.string()
});

export const FootballBallEntity = schema({
  x: t.number(),
  y: t.number(),
  z: t.number(),
  vx: t.number(),
  vy: t.number(),
  vz: t.number(),
  possessorId: t.string(),
  lastPossessorId: t.string(),
  lastTouchTeam: t.string()
});

export const FootballMatchState = schema({
  phase: t.string(), // 'countdown' | 'playing' | 'goal' | 'match_end'
  phaseTimer: t.number(),
  timeRemaining: t.number(), // 180 saniye
  blueScore: t.number(),
  redScore: t.number(),
  lastScorerName: t.string(),
  lastScorerTeam: t.string(),
  ball: t.ref(FootballBallEntity),
  footballPlayers: t.map(FootballPlayerEntity)
});

export const BluffChoiceEntity = schema({
  id: t.string(),
  text: t.string()
});

export const BluffRevealEntity = schema({
  id: t.string(),
  text: t.string(),
  isCorrect: t.boolean(),
  authorName: t.string(),
  authorSessionId: t.string(),
  votes: t.number(),
  votersList: t.string() // "Ahmet, Mehmet"
});

export const BluffTriviaMatchState = schema({
  phase: t.string(), // 'submitting' | 'voting' | 'reveal' | 'round_result' | 'game_over'
  round: t.number(),
  totalRounds: t.number(),
  timeLeft: t.number(),
  questionId: t.string(),
  questionText: t.string(),
  questionCategory: t.string(),
  submittedCount: t.number(),
  votedCount: t.number(),
  totalPlayersCount: t.number(),
  bluffMasterName: t.string(),
  bluffMasterCount: t.number(),
  subjectPlayerName: t.string(),
  subjectPlayerId: t.string(),
  isFriendsMode: t.boolean(),
  choices: t.map(BluffChoiceEntity),
  reveals: t.map(BluffRevealEntity)
});

export const SessionState = schema({
  roomCode: t.string(),
  status: t.string(), // 'lobby' | 'countdown' | 'red' | 'green' | 'quiz_question' | 'quiz_result' | 'round_result' | 'game_over' | 'football_countdown' | 'football_playing' | 'football_goal' | 'football_game_over' | 'bluff_playing'
  activeGameId: t.string(), // Şu an oynanan oyun ('reaction-rush' | 'quiz-arena' | 'mini-football' | 'bluff-trivia')
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

  // Mini Football Spesifik State
  footballMatch: t.ref(FootballMatchState),

  // Bluff Trivia Spesifik State
  bluffTriviaMatch: t.ref(BluffTriviaMatchState),

  players: t.map(PlayerState)
});

export type PlayerStateType = InstanceType<typeof PlayerState>;
export type FootballPlayerEntityType = InstanceType<typeof FootballPlayerEntity>;
export type FootballBallEntityType = InstanceType<typeof FootballBallEntity>;
export type FootballMatchStateType = InstanceType<typeof FootballMatchState>;
export type BluffChoiceEntityType = InstanceType<typeof BluffChoiceEntity>;
export type BluffRevealEntityType = InstanceType<typeof BluffRevealEntity>;
export type BluffTriviaMatchStateType = InstanceType<typeof BluffTriviaMatchState>;
export type SessionStateType = InstanceType<typeof SessionState>;



