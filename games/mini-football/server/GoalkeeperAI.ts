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
  private players?: Map<string, FootballPlayerEntityType>;
  private gkHoldTimers = new Map<string, number>();
  private diveTimers = new Map<string, number>();

  constructor(
    controller: PlayerControllerSystem,
    passingSystem: PassingSystem,
    possessionSystem: PossessionSystem,
    ball: FootballBallEntityType,
    players?: Map<string, FootballPlayerEntityType>
  ) {
    this.controller = controller;
    this.passingSystem = passingSystem;
    this.possessionSystem = possessionSystem;
    this.ball = ball;
    this.players = players;
  }

  public update(gk: FootballPlayerEntityType, dt: number) {
    if (!gk.isGoalkeeper || gk.isStunned) return;

    const dir = gk.team === 'blue' ? -1 : 1;
    const goalLineZ = (PITCH_CONFIG.length / 2 - 2.8) * dir;
    const goalHalfWidth = PITCH_CONFIG.goalWidth / 2 - 0.7;

    // Manage dive visual posture
    let diveTime = this.diveTimers.get(gk.id) || 0;
    if (diveTime > 0) {
      diveTime -= dt;
      this.diveTimers.set(gk.id, diveTime);
      if (diveTime <= 0) {
        gk.isTackling = false;
      }
    }

    // ── CASE 1: Goalkeeper has the ball (Intelligent Distribution) ──
    if (this.ball.possessorId === gk.id) {
      let holdTimer = this.gkHoldTimers.get(gk.id) || 0;
      holdTimer += dt;
      this.gkHoldTimers.set(gk.id, holdTimer);

      if (holdTimer >= 0.7) {
        this.gkHoldTimers.set(gk.id, 0);

        // Find best open teammate on the wing or forward to pass to
        let bestMate: FootballPlayerEntityType | null = null;
        let bestScore = -Infinity;

        if (this.players) {
          for (const mate of this.players.values()) {
            if (mate.team !== gk.team || mate.isGoalkeeper || mate.isStunned) continue;

            const dist = Math.hypot(mate.x - gk.x, mate.z - gk.z);
            if (dist < 5.0 || dist > 45.0) continue;

            // Forward advancement score
            const forwardZ = (mate.z - gk.z) * (gk.team === 'blue' ? 1 : -1);
            const score = forwardZ * 1.5 - Math.abs(mate.x) * 0.2;

            if (score > bestScore) {
              bestScore = score;
              bestMate = mate;
            }
          }
        }

        if (bestMate) {
          this.passingSystem.executePass(gk, bestMate.x - gk.x, bestMate.z - gk.z);
        } else {
          // Default upfield clear
          const upfieldZ = gk.team === 'blue' ? 1 : -1;
          this.passingSystem.executePass(gk, (Math.random() - 0.5) * 8.0, upfieldZ * 20.0);
        }
      }
      return;
    }

    this.gkHoldTimers.set(gk.id, 0);

    const distToBall = Math.hypot(this.ball.x - gk.x, this.ball.z - gk.z);

    // ── CASE 2: Shot on Target / Trajectory Anticipation & Diving Save ──
    const isShotTowardsMe =
      (gk.team === 'blue' && this.ball.vz < -6.0) ||
      (gk.team === 'red' && this.ball.vz > 6.0);

    if (isShotTowardsMe) {
      const timeToGoal = (goalLineZ - this.ball.z) / this.ball.vz;

      if (timeToGoal > 0 && timeToGoal < 2.0) {
        // Calculate exact predicted intersection X on the goal line
        const predictedX = this.ball.x + this.ball.vx * timeToGoal;
        const clampedTargetX = Math.max(-goalHalfWidth, Math.min(goalHalfWidth, predictedX));

        const dx = clampedTargetX - gk.x;
        const dz = goalLineZ - gk.z;
        const dist = Math.hypot(dx, dz);

        // High-speed reflex dive reaction towards ball trajectory
        const diveSpeed = PHYSICS_CONFIG.playerSprintSpeed * 1.45;
        if (dist > 0.15) {
          this.controller.applyAIVelocity(gk, (dx / dist) * diveSpeed, (dz / dist) * diveSpeed, dt);
        }

        // SAVE INTERCEPTION CHECK
        if (distToBall <= 3.2 && this.ball.y <= PITCH_CONFIG.goalHeight + 0.5) {
          gk.isTackling = true;
          this.diveTimers.set(gk.id, 0.45);

          const shotPower = Math.hypot(this.ball.vx, this.ball.vz);

          if (shotPower < 26.0) {
            // Secure Catch
            this.possessionSystem.takePossession(gk);
          } else {
            // Spectacular Diving Parry / Deflection away from goal
            const deflectX = Math.sign(gk.x) * (14.0 + Math.random() * 6.0) || (Math.random() > 0.5 ? 14 : -14);
            const deflectZ = (gk.team === 'blue' ? 1 : -1) * (12.0 + Math.random() * 5.0);
            this.ball.vx = deflectX;
            this.ball.vz = deflectZ;
            this.ball.vy = 3.5;
            this.ball.lastTouchTeam = gk.team;
          }
          return;
        }

        gk.angle = Math.atan2(this.ball.x - gk.x, this.ball.z - gk.z);
        return;
      }
    }

    // ── CASE 3: Sweeper Keeper (Rush out for loose ball in penalty box) ──
    const inPenaltyZ =
      gk.team === 'blue'
        ? this.ball.z < -PITCH_CONFIG.length / 2 + PITCH_CONFIG.penaltyLength
        : this.ball.z > PITCH_CONFIG.length / 2 - PITCH_CONFIG.penaltyLength;

    const inPenaltyX = Math.abs(this.ball.x) <= PITCH_CONFIG.penaltyWidth / 2;

    if (!this.ball.possessorId && inPenaltyZ && inPenaltyX && distToBall < 12.0) {
      // Rush out directly to collect or clear
      const dx = this.ball.x - gk.x;
      const dz = this.ball.z - gk.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.5) {
        const rushSpeed = PHYSICS_CONFIG.playerSprintSpeed * 1.15;
        this.controller.applyAIVelocity(gk, (dx / dist) * rushSpeed, (dz / dist) * rushSpeed, dt);
      }

      if (distToBall <= 2.8 && this.ball.y <= PITCH_CONFIG.goalHeight) {
        this.possessionSystem.takePossession(gk);
      }

      gk.angle = Math.atan2(this.ball.x - gk.x, this.ball.z - gk.z);
      return;
    }

    // ── CASE 4: Positional Lateral Tracking & Angle Narrowing ──
    // Step out off the goal line by 1.2m to 2.2m to narrow shooting cone when attacker approaches
    const distToGoalZ = Math.abs(goalLineZ - this.ball.z);
    const stepOut = Math.min(2.4, Math.max(0.4, (35 - distToGoalZ) * 0.1));
    const targetZ = goalLineZ - dir * stepOut;

    // Lateral tracking along goal width
    const targetX = Math.max(-goalHalfWidth, Math.min(goalHalfWidth, this.ball.x * 0.72));

    const dx = targetX - gk.x;
    const dz = targetZ - gk.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.25) {
      const speed = Math.min(PHYSICS_CONFIG.playerBaseSpeed * 1.05, dist * 7.5);
      this.controller.applyAIVelocity(gk, (dx / dist) * speed, (dz / dist) * speed, dt);
    } else {
      this.controller.applyAIVelocity(gk, 0, 0, dt);
    }

    // Always face towards the ball
    gk.angle = Math.atan2(this.ball.x - gk.x, this.ball.z - gk.z);
  }
}
