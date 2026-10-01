export type BluffPhase =
  | 'submitting'
  | 'voting'
  | 'reveal'
  | 'round_result'
  | 'game_over';

export type BluffCategory =
  | 'genel'
  | 'cografya'
  | 'tarih'
  | 'spor'
  | 'sinema'
  | 'bilim'
  | 'arkadas';

export interface BluffSettings {
  category: BluffCategory;
  submittingTimeSeconds: number; // e.g. 20, 30, 45, 60
  votingTimeSeconds: number; // e.g. 15, 20, 30
  revealDurationSeconds: number; // e.g. 8, 12, 16
  totalRounds: number; // e.g. 3, 5, 7
}

export interface BluffQuestion {
  id: string;
  category: string;
  question: string;
  correctAnswer: string;
  defaultFakes?: string[];
  funFact?: string;
  isFriendQuestion?: boolean;
  subjectPlayerId?: string;
  subjectPlayerNickname?: string;
}

export interface PlayerAnswerRecord {
  sessionId: string;
  nickname: string;
  answerText: string;
  submittedAt: number;
}

export interface AnonymousChoice {
  id: string; // generated ID e.g. "opt_1", "opt_2"
  text: string;
  isReal: boolean;
  authorSessionId: string; // '' if real answer
  authorNickname: string; // '' if real answer
}

export interface VoteRecord {
  voterSessionId: string;
  voterNickname: string;
  choiceId: string;
  votedAt: number;
}

export interface RevealItem {
  id: string;
  text: string;
  isCorrect: boolean;
  authorName: string;
  authorSessionId: string;
  votes: number;
  voters: string[];
}

export interface RoundScoringResult {
  round: number;
  correctAnswer: string;
  reveals: RevealItem[];
  playerScores: Map<string, { correctGained: number; trickGained: number; totalRound: number }>;
  bluffMasterName: string;
  bluffMasterCount: number;
}

/**
 * Türkçe baş harf büyütme / Title Case formatlayıcı
 * Örn: "istanbul" -> "İstanbul", "ANKARA" -> "Ankara", "kırmızı araba" -> "Kırmızı Araba"
 */
export function formatBluffAnswer(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .split(' ')
    .map((word) => {
      if (!word) return '';
      const first = word.charAt(0).toLocaleUpperCase('tr-TR');
      const rest = word.slice(1).toLocaleLowerCase('tr-TR');
      return first + rest;
    })
    .join(' ');
}

/**
 * Benzerlik ve mükerrerlik karşılaştırması için metni normalize eder
 * (Türkçe ve İngilizce klavye i/I/İ/ı farklarını da hoşgörülü eşitler)
 */
export function normalizeForComparison(str: string): string {
  return (str || '')
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/['".,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ');
}
