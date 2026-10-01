export type TeamId = 'blue' | 'red';
export type PlayerRole = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export type MatchPhase = 'countdown' | 'kickoff' | 'playing' | 'goal' | 'match_end';
export type SpecialMoveType = 'rainbow_flick' | 'elastico' | 'roulette';

export interface FootballInput {
  moveX: number;
  moveY: number;
  pass: boolean;
  shoot: boolean;
  shootPower?: number; // 0 to 1
  tackle: boolean;
  switchPlayer: boolean;
  special: boolean;
  seq?: number;
}

export interface PlayerStats {
  speed: number;
  acceleration: number;
  passing: number;
  shooting: number;
  tackle: number;
  special: SpecialMoveType;
}

export interface MatchConfig {
  fieldPlayersPerTeam: number; // 1 to 5
  matchDurationSeconds: number; // 180s
  maxGoals: number; // 5
  pitchWidth: number; // e.g. 60
  pitchLength: number; // e.g. 100
  goalWidth: number; // e.g. 14
  goalDepth: number; // e.g. 4
}
