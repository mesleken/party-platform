import type { PlayerInfo, RoomStatus, RoundResult, FinalResult } from './types.js';

export type ClientMessage =
  | { type: 'PING'; t: number }
  | { type: 'JOIN'; roomCode: string; nickname: string; avatar: string }
  | { type: 'READY' }
  | { type: 'UNREADY' }
  | { type: 'START_GAME' }
  | { type: 'SELECT_GAME'; gameId: string }
  | { type: 'INPUT'; seq: number; payload: Record<string, unknown> }
  | { type: 'RECONNECT'; token: string };

export type ServerMessage =
  | { type: 'PONG'; t: number; serverTime: number }
  | { type: 'WELCOME'; playerId: string; sessionToken: string; serverTime: number }
  | { type: 'ROOM_STATE'; players: PlayerInfo[]; status: RoomStatus }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'PLAYER_LEFT'; playerId: string; reason: string }
  | { type: 'GAME_LOADING'; gameId: string; progress: number }
  | { type: 'GAME_START'; initialState: unknown }
  | { type: 'STATE'; tick: number; state: unknown }
  | { type: 'PERSONAL_STATE'; state: unknown }
  | { type: 'ROUND_START'; round: number }
  | { type: 'ROUND_END'; results: RoundResult }
  | { type: 'GAME_END'; finalResults: FinalResult }
  | { type: 'VIEW_CHANGE'; view: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'COUNTDOWN'; seconds: number }
  | { type: 'KICK'; reason: string }
  | { type: 'RECONNECTED'; state: unknown };
