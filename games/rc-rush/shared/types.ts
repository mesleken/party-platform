export type PowerupType = 'rocket' | 'turbo' | 'shield' | 'oil';

export interface RcRushInput {
  steer: number; // -1.0 (full left) to +1.0 (full right)
  throttle: number; // 0.0 to 1.0 (forward drive)
  brake: number; // 0.0 to 1.0 (braking / reverse)
  handbrake?: boolean; // Drift / Handbrake button
  boost: boolean; // turbo active
  useItem: boolean; // trigger carried item
  recover?: boolean; // respawn back on track
}

export interface CarSnapshot {
  id: string;
  nickname: string;
  color: string;
  carModel: string; // 'buggy' | 'sport' | 'truck' | 'formula'
  x: number;
  y: number;
  z: number;
  rotation: number; // Y heading angle (radians)
  pitch: number;
  roll: number;
  wheelSteer: number; // front wheel angle
  wheelRotation: number; // wheel spin progress
  speed: number; // KM/H
  boostMeter: number; // 0 - 100
  isBoosting: boolean;
  isDrifting: boolean;
  isSpinning: boolean;
  item: PowerupType | null;
  lap: number; // 1-indexed
  checkpointIndex: number;
  position: number; // 1st, 2nd, 3rd, etc.
  lapTimeMs: number;
  bestLapMs: number;
  totalTimeMs: number;
  finished: boolean;
  isWrongWay: boolean;
  gapToLeaderSec: number;
  slipRatio: number; // 0.0 - 1.0 (Drift ve lastik kayma oranı)
  rpmNormalized: number; // 0.0 - 1.0 (LED Takometre için devir)
  trackProgress: number; // Toplam metre ilerlemesi
  distanceToAheadM: number; // Öndeki araçla metre farkı (örn. -12)
  distanceToBehindM: number; // Arkadaki araçla metre farkı (örn. +8)
  aheadRacerName?: string;
  behindRacerName?: string;
}

export interface PickupSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
}

export interface ProjectileSnapshot {
  id: string;
  type: 'rocket' | 'oil';
  ownerId: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
}

export type RaceEventType =
  | 'RACE_START'
  | 'COUNTDOWN_TICK'
  | 'OVERTAKE'
  | 'BOOST'
  | 'ITEM_PICKED'
  | 'ITEM_USED'
  | 'ROCKET_HIT'
  | 'OIL_SLIP'
  | 'FINAL_LAP'
  | 'WRONG_WAY'
  | 'CRASH'
  | 'FINISH';

export interface RaceEvent {
  type: RaceEventType;
  playerId?: string;
  playerName?: string;
  targetId?: string;
  targetName?: string;
  item?: PowerupType;
  newPosition?: number;
  gap?: number;
  timestamp: number;
}

export interface TrackWaypoint {
  x: number;
  z: number;
  radius: number;
}

export interface TrackDecoration {
  type: 'book' | 'block' | 'mug' | 'battery' | 'pencil' | 'can' | 'domino' | 'wrench' | 'box' | 'eraser';
  x: number;
  z: number;
  rotation: number;
  scale: number;
  color?: string;
  label?: string;
}

export interface RcRushSnapshot {
  phase: 'countdown' | 'racing' | 'completed';
  countdown: number; // 3, 2, 1, 0
  elapsedMs: number;
  totalLaps: number;
  cars: CarSnapshot[];
  pickups: PickupSnapshot[];
  projectiles: ProjectileSnapshot[];
  winnerNickname?: string;
  trackName: string;
}
