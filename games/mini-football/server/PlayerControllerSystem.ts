import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType } from '@platform/sdk-core';
import type { FootballInput } from '../shared/types.js';

export class PlayerControllerSystem {
  private players: Map<string, FootballPlayerEntityType>;

  constructor(players: Map<string, FootballPlayerEntityType>) {
    this.players = players;
  }

  public applyHumanInput(player: FootballPlayerEntityType, input: FootballInput, dt: number) {
    if (player.isStunned || player.isTackling) return;

    const moveX = input.moveX || 0;
    const moveZ = input.moveY || 0; // joystick Y maps to Z axis on pitch
    const inputLen = Math.hypot(moveX, moveZ);

    if (inputLen > 0.1) {
      // Facing angle (0 = +Z, PI = -Z, PI/2 = +X, -PI/2 = -X)
      const targetAngle = Math.atan2(moveX, moveZ);
      player.angle = targetAngle;

      const speed = player.isSprinting ? PHYSICS_CONFIG.playerSprintSpeed : PHYSICS_CONFIG.playerBaseSpeed;
      const targetVx = (moveX / Math.max(1, inputLen)) * speed;
      const targetVz = (moveZ / Math.max(1, inputLen)) * speed;

      // Accelerate towards target velocity
      const accel = PHYSICS_CONFIG.playerAcceleration * dt;
      player.vx += (targetVx - player.vx) * Math.min(1, accel);
      player.vz += (targetVz - player.vz) * Math.min(1, accel);
    } else {
      // Decelerate when no joystick input
      const decel = Math.pow(PHYSICS_CONFIG.playerDeceleration, dt * 60);
      player.vx *= decel;
      player.vz *= decel;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
      if (Math.abs(player.vz) < 0.1) player.vz = 0;
    }
  }

  public applyAIVelocity(player: FootballPlayerEntityType, targetVx: number, targetVz: number, dt: number) {
    if (player.isStunned || player.isTackling) return;

    const targetSpeed = Math.hypot(targetVx, targetVz);
    if (targetSpeed > 0.1) {
      player.angle = Math.atan2(targetVx, targetVz);
    }

    const accel = PHYSICS_CONFIG.playerAcceleration * dt;
    player.vx += (targetVx - player.vx) * Math.min(1, accel);
    player.vz += (targetVz - player.vz) * Math.min(1, accel);
  }

  public updatePositions(dt: number) {
    const halfWidth = PITCH_CONFIG.width / 2 - PITCH_CONFIG.playerRadius;
    const halfLength = PITCH_CONFIG.length / 2 - PITCH_CONFIG.playerRadius;

    for (const player of this.players.values()) {
      if (player.isStunned) {
        player.vx *= 0.85;
        player.vz *= 0.85;
      }

      player.x += player.vx * dt;
      player.z += player.vz * dt;

      // Pitch boundaries clamping
      if (player.x < -halfWidth) {
        player.x = -halfWidth;
        player.vx = 0;
      } else if (player.x > halfWidth) {
        player.x = halfWidth;
        player.vx = 0;
      }

      if (player.z < -halfLength) {
        player.z = -halfLength;
        player.vz = 0;
      } else if (player.z > halfLength) {
        player.z = halfLength;
        player.vz = 0;
      }
    }
  }
}
