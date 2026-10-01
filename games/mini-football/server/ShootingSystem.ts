import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType } from '@platform/sdk-core';
import type { BallSystem } from './BallSystem.js';
import type { PossessionSystem } from './PossessionSystem.js';

export class ShootingSystem {
  private ballSystem: BallSystem;
  private possessionSystem: PossessionSystem;

  constructor(ballSystem: BallSystem, possessionSystem: PossessionSystem) {
    this.ballSystem = ballSystem;
    this.possessionSystem = possessionSystem;
  }

  public executeShot(
    player: FootballPlayerEntityType,
    aimX: number,
    aimZ: number,
    powerRatio: number = 0.5
  ): boolean {
    if (this.ballSystem.ball.possessorId !== player.id) return false;

    const clampedPower = Math.max(0.1, Math.min(1.0, powerRatio));

    // Opponent goal Z: Blue attacks +45, Red attacks -45
    const targetGoalZ = player.team === 'blue' ? PITCH_CONFIG.length / 2 : -PITCH_CONFIG.length / 2;

    // Goal aiming: default towards goal center with steer from joystick
    const goalHalfWidth = PITCH_CONFIG.goalWidth / 2 - 1.2;
    let targetX = 0;

    if (Math.abs(aimX) > 0.1) {
      targetX = Math.sign(aimX) * Math.min(goalHalfWidth, Math.abs(aimX) * goalHalfWidth);
    } else {
      // Slight random variation to keep it dynamic
      targetX = (Math.random() - 0.5) * 4.0;
    }

    const toGoalX = targetX - player.x;
    const toGoalZ = targetGoalZ - player.z;
    const distToGoal = Math.hypot(toGoalX, toGoalZ);

    const speed =
      PHYSICS_CONFIG.shotSpeedMin +
      (PHYSICS_CONFIG.shotSpeedMax - PHYSICS_CONFIG.shotSpeedMin) * clampedPower;

    const shotVx = (toGoalX / distToGoal) * speed;
    const shotVz = (toGoalZ / distToGoal) * speed;

    // Upward angle based on power (0 to 1 -> 1.5 to 6.5 m/s)
    const shotVy = 1.2 + clampedPower * 5.0;

    this.possessionSystem.clearPossession();
    this.ballSystem.launch(shotVx, shotVy, shotVz, player.id, player.team);
    return true;
  }
}
