export type CharacterRole = 'milo' | 'nia' | 'spectator';

export type LostAndFoundPhase = 'intro' | 'playing' | 'minigame' | 'completed';

export interface PlayerInput {
  moveX: number; // -1 to 1
  jump?: boolean;
  interact?: boolean;
  abilityActive?: boolean;
  aimAngle?: number; // radians
  miniGameInput?: {
    tunerValue?: number; // 0 - 100 (for Milo)
    phaseAngle?: number; // 0 - 360 (for Nia)
  };
}

export interface PlayerSnapshot {
  id: string;
  nickname: string;
  role: 'milo' | 'nia';
  x: number;
  y: number;
  vx: number;
  vy: number;
  isGrounded: boolean;
  facingRight: boolean;
  abilityActive: boolean;
  abilityTarget?: { x: number; y: number; active: boolean };
  score: number;
}

export interface PhysicsCrate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  isMetal: boolean;
  isHeld: boolean;
}

export interface PowerCore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHeld: boolean;
  isInserted: boolean;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'static' | 'moving_v' | 'moving_h' | 'piston' | 'gate';
  minCoord?: number;
  maxCoord?: number;
  speed?: number;
  isOpen?: boolean;
  active?: boolean;
}

export interface PressurePlate {
  id: string;
  x: number;
  y: number;
  width: number;
  isPressed: boolean;
}

export interface Lever {
  id: string;
  x: number;
  y: number;
  isOn: boolean;
}

export interface AnchorRing {
  id: string;
  x: number;
  y: number;
}

export interface MiniGameSession {
  targetFrequency: number; // 0 - 100
  targetPhase: number; // 0 - 360
  miloFrequency: number;
  niaPhase: number;
  syncProgress: number; // 0 to 100
  isUnlocked: boolean;
}

export interface LostAndFoundSnapshot {
  gameId: 'lost-and-found';
  phase: LostAndFoundPhase;
  tick: number;
  elapsedMs: number;
  objectiveText: string;
  players: PlayerSnapshot[];
  crates: PhysicsCrate[];
  powerCore: PowerCore;
  platforms: Platform[];
  pressurePlates: PressurePlate[];
  levers: Lever[];
  anchorRings: AnchorRing[];
  miniGame: MiniGameSession;
  vaultDoorOpen: boolean;
  completionTimeMs?: number;
}

export interface LostAndFoundConfig {
  gravity: number;
  jumpVelocity: number;
  moveSpeed: number;
  magnetRange: number;
  grappleRange: number;
  physicsTickMs: number;
  snapshotIntervalMs: number;
}

export const DEFAULT_CONFIG: LostAndFoundConfig = {
  gravity: -28,
  jumpVelocity: 14.5,
  moveSpeed: 9.5,
  magnetRange: 16,
  grappleRange: 18,
  physicsTickMs: 50,
  snapshotIntervalMs: 50,
};
