import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballBallEntityType } from '@platform/sdk-core';

export class BallSystem {
  public ball: FootballBallEntityType;

  constructor(ball: FootballBallEntityType) {
    this.ball = ball;
    this.reset();
  }

  public reset(kickoffTeam?: 'blue' | 'red') {
    this.ball.x = 0;
    this.ball.y = PITCH_CONFIG.ballRadius;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.possessorId = '';
    this.ball.lastPossessorId = '';
    this.ball.lastTouchTeam = kickoffTeam || '';
  }

  public update(dt: number) {
    // If possessed, ball position is locked to possessor dribble position
    if (this.ball.possessorId) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
      return;
    }

    // Free physics
    this.ball.vy += PHYSICS_CONFIG.gravity * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.z += this.ball.vz * dt;

    // Ground bounce & friction
    if (this.ball.y <= PITCH_CONFIG.ballRadius) {
      this.ball.y = PITCH_CONFIG.ballRadius;
      if (this.ball.vy < -1.0) {
        this.ball.vy = -this.ball.vy * PHYSICS_CONFIG.ballBounce;
      } else {
        this.ball.vy = 0;
      }

      const friction = Math.pow(PHYSICS_CONFIG.ballFriction, dt * 60);
      this.ball.vx *= friction;
      this.ball.vz *= friction;

      if (Math.abs(this.ball.vx) < 0.05) this.ball.vx = 0;
      if (Math.abs(this.ball.vz) < 0.05) this.ball.vz = 0;
    } else {
      const airDrag = Math.pow(PHYSICS_CONFIG.ballAirDrag, dt * 60);
      this.ball.vx *= airDrag;
      this.ball.vz *= airDrag;
    }

    // Sideline collisions
    const halfWidth = PITCH_CONFIG.width / 2 - PITCH_CONFIG.ballRadius;
    if (this.ball.x < -halfWidth) {
      this.ball.x = -halfWidth;
      this.ball.vx = -this.ball.vx * 0.5;
    } else if (this.ball.x > halfWidth) {
      this.ball.x = halfWidth;
      this.ball.vx = -this.ball.vx * 0.5;
    }

    // Goal line & Net collisions
    const halfLength = PITCH_CONFIG.length / 2;
    const goalHalfWidth = PITCH_CONFIG.goalWidth / 2 - PITCH_CONFIG.ballRadius;

    // Check Z bounds
    if (Math.abs(this.ball.z) > halfLength) {
      // Inside goal posts and under crossbar?
      const inGoalMouth = Math.abs(this.ball.x) <= goalHalfWidth && this.ball.y <= PITCH_CONFIG.goalHeight;

      if (inGoalMouth) {
        // Inside goal net area
        const maxNetDepth = halfLength + PITCH_CONFIG.goalDepth - PITCH_CONFIG.ballRadius;
        if (Math.abs(this.ball.z) > maxNetDepth) {
          this.ball.z = Math.sign(this.ball.z) * maxNetDepth;
          this.ball.vz = -this.ball.vz * 0.2;
          this.ball.vx *= 0.3;
        }
      } else {
        // Hit the back line (not in goal) - bounce back into pitch
        const boundaryZ = halfLength - PITCH_CONFIG.ballRadius;
        this.ball.z = Math.sign(this.ball.z) * boundaryZ;
        this.ball.vz = -this.ball.vz * 0.5;
      }
    }
  }

  public launch(vx: number, vy: number, vz: number, kickerId: string, kickerTeam: string) {
    this.ball.possessorId = '';
    this.ball.lastPossessorId = kickerId;
    this.ball.lastTouchTeam = kickerTeam;
    this.ball.vx = vx;
    this.ball.vy = vy;
    this.ball.vz = vz;
  }
}
