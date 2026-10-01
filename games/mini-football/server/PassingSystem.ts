import { PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType } from '@platform/sdk-core';
import type { BallSystem } from './BallSystem.js';
import type { PossessionSystem } from './PossessionSystem.js';

export class PassingSystem {
  private ballSystem: BallSystem;
  private possessionSystem: PossessionSystem;
  private players: Map<string, FootballPlayerEntityType>;

  constructor(
    ballSystem: BallSystem,
    possessionSystem: PossessionSystem,
    players: Map<string, FootballPlayerEntityType>
  ) {
    this.ballSystem = ballSystem;
    this.possessionSystem = possessionSystem;
    this.players = players;
  }

  public executePass(player: FootballPlayerEntityType, aimX: number, aimZ: number): boolean {
    if (this.ballSystem.ball.possessorId !== player.id) return false;

    // Normalizing aim direction
    let aimDirX = aimX;
    let aimDirZ = aimZ;
    const aimLen = Math.hypot(aimDirX, aimDirZ);

    if (aimLen < 0.1) {
      // Use player facing angle if joystick is not pushed
      aimDirX = Math.sin(player.angle);
      aimDirZ = Math.cos(player.angle);
    } else {
      aimDirX /= aimLen;
      aimDirZ /= aimLen;
    }

    // Find best teammate in the pass cone
    let bestTeammate: FootballPlayerEntityType | null = null;
    let bestScore = -Infinity;

    for (const mate of this.players.values()) {
      if (mate.id === player.id || mate.team !== player.team || mate.isGoalkeeper) continue;

      const toMateX = mate.x - player.x;
      const toMateZ = mate.z - player.z;
      const dist = Math.hypot(toMateX, toMateZ);

      if (dist < 1.0) continue;

      const normX = toMateX / dist;
      const normZ = toMateZ / dist;
      const dot = normX * aimDirX + normZ * aimDirZ;

      // Must be roughly in front of aim direction (within ~70 deg cone)
      if (dot > 0.35) {
        // Preference for teammates well aligned and at good passing distance (10-30m)
        const score = dot * 2.0 - dist * 0.03;
        if (score > bestScore) {
          bestScore = score;
          bestTeammate = mate;
        }
      }
    }

    let passVx = 0;
    let passVz = 0;
    const passVy = 0.8; // Low bouncing ground pass

    if (bestTeammate) {
      // Pass with slight lead towards teammate's running path
      const leadTime = 0.25;
      const targetX = bestTeammate.x + bestTeammate.vx * leadTime;
      const targetZ = bestTeammate.z + bestTeammate.vz * leadTime;
      const targetDist = Math.hypot(targetX - player.x, targetZ - player.z);

      const speed = Math.min(
        PHYSICS_CONFIG.passSpeedMax,
        Math.max(PHYSICS_CONFIG.passSpeedMin, targetDist * 1.8)
      );

      passVx = ((targetX - player.x) / targetDist) * speed;
      passVz = ((targetZ - player.z) / targetDist) * speed;
    } else {
      // Directional pass
      const speed = PHYSICS_CONFIG.passSpeedMin;
      passVx = aimDirX * speed;
      passVz = aimDirZ * speed;
    }

    this.possessionSystem.clearPossession();
    this.ballSystem.launch(passVx, passVy, passVz, player.id, player.team);
    return true;
  }
}
