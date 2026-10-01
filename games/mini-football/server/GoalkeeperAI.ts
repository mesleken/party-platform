import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType, FootballBallEntityType } from '@platform/sdk-core';
import type { PlayerControllerSystem } from './PlayerControllerSystem.js';
import type { PassingSystem } from './PassingSystem.js';
import type { PossessionSystem } from './PossessionSystem.js';

export class GoalkeeperAI {
  private controller: PlayerControllerSystem;
  private passingSystem: PassingSystem;
  private possessionSystem: PossessionSystem;
  private ball: FootballBallEntityType;
  private gkHoldTimers = new Map<string, number>();

  constructor(
    controller: PlayerControllerSystem,
    passingSystem: PassingSystem,
    possessionSystem: PossessionSystem,
    ball: FootballBallEntityType
  ) {
    this.controller = controller;
    this.passingSystem = passingSystem;
    this.possessionSystem = possessionSystem;
    this.ball = ball;
  }

  public update(gk: FootballPlayerEntityType, dt: number) {
    if (!gk.isGoalkeeper || gk.isStunned) return;

    const dir = gk.team === 'blue' ? -1 : 1;
    const goalLineZ = (PITCH_CONFIG.length / 2 - 3.5) * dir;
    const goalHalfWidth = PITCH_CONFIG.goalWidth / 2 - 1.0;

    // 1. If Goalkeeper has the ball
    if (this.ball.possessorId === gk.id) {
      let holdTimer = this.gkHoldTimers.get(gk.id) || 0;
      holdTimer += dt;
      this.gkHoldTimers.set(gk.id, holdTimer);

      if (holdTimer >= 0.5) {
        // Clear or pass upfield
        this.gkHoldTimers.set(gk.id, 0);
        const upfieldZ = gk.team === 'blue' ? 1 : -1;
        this.passingSystem.executePass(gk, 0, upfieldZ);
      }
      return;
    }

    this.gkHoldTimers.set(gk.id, 0);

    // 2. Ball positioning logic
    // Lateral tracking along goal line
    const targetX = Math.max(-goalHalfWidth, Math.min(goalHalfWidth, this.ball.x * 0.8));
    let targetZ = goalLineZ;

    // Check if free ball is dangerously close in penalty area (rush out)
    const distToBall = Math.hypot(this.ball.x - gk.x, this.ball.z - gk.z);
    const inPenaltyZ =
      gk.team === 'blue'
        ? this.ball.z < -PITCH_CONFIG.length / 2 + PITCH_CONFIG.penaltyLength
        : this.ball.z > PITCH_CONFIG.length / 2 - PITCH_CONFIG.penaltyLength;

    if (!this.ball.possessorId && inPenaltyZ && distToBall < 10) {
      // Rush out towards ball!
      targetZ = this.ball.z;
    }

    const dx = targetX - gk.x;
    const dz = targetZ - gk.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.4) {
      const speed = Math.min(PHYSICS_CONFIG.playerBaseSpeed * 0.9, dist * 6.0);
      const vx = (dx / dist) * speed;
      const vz = (dz / dist) * speed;
      this.controller.applyAIVelocity(gk, vx, vz, dt);
    } else {
      this.controller.applyAIVelocity(gk, 0, 0, dt);
    }

    // GK faces towards the pitch center / ball
    gk.angle = Math.atan2(this.ball.x - gk.x, this.ball.z - gk.z);
  }
}
