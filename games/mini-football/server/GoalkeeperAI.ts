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
    const upfieldZ = gk.team === 'blue' ? 1 : -1;
    const goalLineZ = (PITCH_CONFIG.length / 2 - 2.8) * dir;
    const goalHalfWidth = PITCH_CONFIG.goalWidth / 2 - 0.7;
    const maxGkX = PITCH_CONFIG.goalWidth / 2 + 1.8; // Max 8.8m from center (strictly stays in front of goal)

    // Strict Goalkeeper Safe Box Enclosure (CANNOT ever wander towards corners or sidelines)
    gk.x = Math.max(-maxGkX, Math.min(maxGkX, gk.x));
    if (dir === -1) {
      gk.z = Math.max(goalLineZ - 0.5, Math.min(goalLineZ + 9.0, gk.z));
    } else {
      gk.z = Math.min(goalLineZ + 0.5, Math.max(goalLineZ - 9.0, gk.z));
    }

    // Manage dive visual posture
    let diveTime = this.diveTimers.get(gk.id) || 0;
    if (diveTime > 0) {
      diveTime -= dt;
      this.diveTimers.set(gk.id, diveTime);
      if (diveTime <= 0) {
        gk.isTackling = false;
      }
    }

    // ── CASE 1: Goalkeeper has the ball (Hold & Distribute Upfield - NEVER Dribble) ──
    if (this.ball.possessorId === gk.id) {
      // Freeze all movement immediately (Goalkeeper must never slide or dribble)
      gk.vx = 0;
      gk.vz = 0;
      this.controller.applyAIVelocity(gk, 0, 0, dt);

      // Face directly upfield
      gk.angle = upfieldZ === 1 ? 0 : Math.PI;

      let holdTimer = this.gkHoldTimers.get(gk.id) || 0;
      holdTimer += dt;
      this.gkHoldTimers.set(gk.id, holdTimer);

      if (holdTimer >= 0.4) {
        this.gkHoldTimers.set(gk.id, 0);

        // Find best open outfield teammate positioned ahead
        let bestMate: FootballPlayerEntityType | null = null;
        let bestScore = -Infinity;

        if (this.players) {
          for (const mate of this.players.values()) {
            if (mate.team !== gk.team || mate.isGoalkeeper || mate.isStunned) continue;

            const dist = Math.hypot(mate.x - gk.x, mate.z - gk.z);
            if (dist < 5.0 || dist > 55.0) continue;

            // Only consider teammates in the attacking half / ahead of keeper
            const forwardDistance = (mate.z - gk.z) * upfieldZ;
            if (forwardDistance <= 0) continue;

            const score = forwardDistance * 1.8 - Math.abs(mate.x) * 0.15;
            if (score > bestScore) {
              bestScore = score;
              bestMate = mate;
            }
          }
        }

        if (bestMate) {
          this.passingSystem.executePass(gk, bestMate.x - gk.x, bestMate.z - gk.z);
        } else {
          // Default clearance straight down the pitch into midfield
          const clearDirX = (Math.random() - 0.5) * 4.0;
          const clearDirZ = upfieldZ * 32.0;
          this.passingSystem.executePass(gk, clearDirX, clearDirZ);
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
            gk.vx = 0;
            gk.vz = 0;
          } else {
            // Spectacular Diving Parry / Deflection away from goal
            const deflectX = Math.sign(gk.x) * (14.0 + Math.random() * 6.0) || (Math.random() > 0.5 ? 14 : -14);
            const deflectZ = upfieldZ * (12.0 + Math.random() * 5.0);
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

    // ── CASE 3: Sweeper Keeper (Rush out for loose ball ONLY inside goal box) ──
    const inPenaltyZ =
      gk.team === 'blue'
        ? this.ball.z < -PITCH_CONFIG.length / 2 + 10.0
        : this.ball.z > PITCH_CONFIG.length / 2 - 10.0;

    const inGkBoxX = Math.abs(this.ball.x) <= maxGkX;

    if (!this.ball.possessorId && inPenaltyZ && inGkBoxX && distToBall < 8.0) {
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
        gk.vx = 0;
        gk.vz = 0;
      }

      gk.angle = Math.atan2(this.ball.x - gk.x, this.ball.z - gk.z);
      return;
    }

    // ── CASE 4: Positional Lateral Tracking & Angle Narrowing ──
    // Step out off the goal line by 0.6m to 1.8m to narrow shooting cone when attacker approaches
    const distToGoalZ = Math.abs(goalLineZ - this.ball.z);
    const stepOut = Math.min(1.8, Math.max(0.3, (35 - distToGoalZ) * 0.08));
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
