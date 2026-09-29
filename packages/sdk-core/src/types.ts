export interface PlayerInfo {
  id: string;
  nickname: string;
  avatar: string;
  isConnected: boolean;
}

export type RoomStatus = 'lobby' | 'game_select' | 'loading' | 'playing' | 'match_result' | 'session_end';

export interface SessionSettings {
  maxPlayers: number;
  isPrivate: boolean;
}

export interface GameState {
  [key: string]: any;
}

export interface RoundResult {
  winnerId?: string;
  scores: Record<string, number>;
}

export interface FinalResult {
  winnerId?: string;
  standings: Array<{ playerId: string; score: number }>;
}
