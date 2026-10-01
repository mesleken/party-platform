import { MatchConfig } from './types.js';

export const PITCH_CONFIG = {
  width: 56, // X axis: -28 to +28
  length: 90, // Z axis: -45 (Blue goal) to +45 (Red goal)
  goalWidth: 14,
  goalDepth: 5,
  goalHeight: 4.2,
  penaltyWidth: 26,
  penaltyLength: 15,
  centerRadius: 9,
  ballRadius: 0.55,
  playerRadius: 0.85
};

export const PHYSICS_CONFIG = {
  tickRate: 60,
  timeStep: 1 / 60,
  gravity: -18,
  ballFriction: 0.985,
  ballAirDrag: 0.994,
  ballBounce: 0.62,
  playerBaseSpeed: 14.5,
  playerSprintSpeed: 18.0,
  playerAcceleration: 45.0,
  playerDeceleration: 0.82,
  playerRotationSpeed: 12.0,

  // Soft Possession Zones
  possessionAttractRadius: 2.5, // Zone 2: soft pull
  possessionDribbleOffset: 1.1, // Zone 3: offset in front of player
  possessionBreakDistance: 3.2,

  // Actions
  tackleSpeed: 23.0,
  tackleDuration: 0.32,
  tackleCooldown: 1.1,
  tackleReach: 1.8,
  passSpeedMin: 18.0,
  passSpeedMax: 28.0,
  shotSpeedMin: 22.0,
  shotSpeedMax: 40.0,
  maxShotChargeTime: 0.9,

  // Match rules
  matchDuration: 180, // 3 minutes
  maxGoals: 5,
  goalCelebrationDuration: 3.0 // 3 seconds
};

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  fieldPlayersPerTeam: 2, // 2v2 default (scales 1v1 up to 5v5)
  matchDurationSeconds: 180,
  maxGoals: 5,
  pitchWidth: PITCH_CONFIG.width,
  pitchLength: PITCH_CONFIG.length,
  goalWidth: PITCH_CONFIG.goalWidth,
  goalDepth: PITCH_CONFIG.goalDepth
};
