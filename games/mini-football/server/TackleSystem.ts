import { PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType } from '@platform/sdk-core';
import type { PossessionSystem } from './PossessionSystem.js';

interface TackleState {
  tacklingTimer: number; // active tackle duration
  cooldownTimer: number; // cooldown before next tackle
}

export class TackleSystem {
  private possessionSystem: PossessionSystem;
  private players: Map<string, FootballPlayerEntityType>;
  private tackleStates = new Map<string, TackleState>();
  private stunnedTimers = new Map<string, number>();

  constructor(possessionSystem: PossessionSystem, players: Map<string, FootballPlayerEntityType>) {
    this.possessionSystem = possessionSystem;
    this.players = players;
  }

  public executeTackle(player: FootballPlayerEntityType): boolean {
    if (player.isStunned || player.isTackling) return false;

    const state = this.tackleStates.get(player.id) || { tacklingTimer: 0, cooldownTimer: 0 };
    if (state.cooldownTimer > 0) return false;

    // Start slide tackle
    player.isTackling = true;
    state.tacklingTimer = PHYSICS_CONFIG.tackleDuration;
    state.cooldownTimer = PHYSICS_CONFIG.tackleCooldown;
    this.tackleStates.set(player.id, state);

    // Forward burst
    player.vx = Math.sin(player.angle) * PHYSICS_CONFIG.tackleSpeed;
    player.vz = Math.cos(player.angle) * PHYSICS_CONFIG.tackleSpeed;

    return true;
  }

  public update(dt: number) {
    // 1. Update stunned players
    for (const [id, timer] of this.stunnedTimers.entries()) {
      const remaining = timer - dt;
      const player = this.players.get(id);

      if (remaining <= 0) {
        this.stunnedTimers.delete(id);
        if (player) player.isStunned = false;
      } else {
        this.stunnedTimers.set(id, remaining);
        if (player) {
          player.isStunned = true;
          // Decelerate while stunned
          player.vx *= 0.85;
          player.vz *= 0.85;
        }
      }
    }

    // 2. Update tackling players and detect contact
    for (const [id, state] of this.tackleStates.entries()) {
      const player = this.players.get(id);
      if (!player) continue;

      if (state.cooldownTimer > 0) {
        state.cooldownTimer -= dt;
      }

      if (state.tacklingTimer > 0) {
        state.tacklingTimer -= dt;

        // Slide deceleration
        player.vx *= 0.95;
        player.vz *= 0.95;

        // Check contact with opponents
        for (const target of this.players.values()) {
          if (target.id === player.id || target.team === player.team) continue;

          const dx = target.x - player.x;
          const dz = target.z - player.z;
          const dist = Math.hypot(dx, dz);

          if (dist < PHYSICS_CONFIG.tackleReach) {
            // Hit opponent!
            if (target.hasBall) {
              // Strip ball!
              this.possessionSystem.stripPossession(
                target,
                Math.sin(player.angle) * 8.0,
                Math.cos(player.angle) * 8.0
              );
              this.stunPlayer(target, 0.75); // Stun the victim
            } else {
              this.stunPlayer(target, 0.4); // Mild stumble
            }
          }
        }

        if (state.tacklingTimer <= 0) {
          player.isTackling = false;
        }
      }
    }
  }

  public stunPlayer(player: FootballPlayerEntityType, durationSeconds: number) {
    player.isStunned = true;
    player.isTackling = false;
    this.stunnedTimers.set(player.id, durationSeconds);
  }
}
