import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType, FootballBallEntityType } from '@platform/sdk-core';
import type { PlayerControllerSystem } from './PlayerControllerSystem.js';
import type { PassingSystem } from './PassingSystem.js';
import type { ShootingSystem } from './ShootingSystem.js';
import type { TackleSystem } from './TackleSystem.js';
import type { GoalkeeperAI } from './GoalkeeperAI.js';

interface AIDecisionState {
  aiPassTimer: number;
}

export class AIManager {
  private controller: PlayerControllerSystem;
  private passingSystem: PassingSystem;
  private shootingSystem: ShootingSystem;
  private tackleSystem: TackleSystem;
  private goalkeeperAI: GoalkeeperAI;
  private ball: FootballBallEntityType;
  private players: Map<string, FootballPlayerEntityType>;
  private aiStates = new Map<string, AIDecisionState>();

  constructor(
    controller: PlayerControllerSystem,
    passingSystem: PassingSystem,
    shootingSystem: ShootingSystem,
    tackleSystem: TackleSystem,
    goalkeeperAI: GoalkeeperAI,
    ball: FootballBallEntityType,
    players: Map<string, FootballPlayerEntityType>
  ) {
    this.controller = controller;
    this.passingSystem = passingSystem;
    this.shootingSystem = shootingSystem;
    this.tackleSystem = tackleSystem;
    this.goalkeeperAI = goalkeeperAI;
    this.ball = ball;
    this.players = players;
  }

  public update(dt: number) {
    // 1. Determine which field player on each team is closest to the ball (for pressing)
    const closestBlue = this.findClosestFieldPlayerToBall('blue');
    const closestRed = this.findClosestFieldPlayerToBall('red');

    for (const player of this.players.values()) {
      if (player.isStunned) continue;

      // Goalkeepers handled by specialized GoalkeeperAI
      if (player.isGoalkeeper) {
        this.goalkeeperAI.update(player, dt);
        continue;
      }

      // If player is controlled by human, skip AI movement
      if (player.controlledBySessionId) {
        continue;
      }

      // AI Field Player Behavior
      this.updateFieldAI(player, player === closestBlue || player === closestRed, dt);
    }
  }

  private updateFieldAI(player: FootballPlayerEntityType, isPresser: boolean, dt: number) {
    const oppGoalZ = player.team === 'blue' ? PITCH_CONFIG.length / 2 : -PITCH_CONFIG.length / 2;
    const distToGoal = Math.abs(oppGoalZ - player.z);

    // ── CASE A: AI has the ball ──
    if (this.ball.possessorId === player.id) {
      let state = this.aiStates.get(player.id);
      if (!state) {
        state = { aiPassTimer: 0 };
        this.aiStates.set(player.id, state);
      }
      state.aiPassTimer += dt;

      // 1. In shooting range? Shoot!
      if (distToGoal <= 26) {
        const aimX = (Math.random() - 0.5) * 0.8;
        const power = 0.5 + Math.random() * 0.4;
        this.shootingSystem.executeShot(player, aimX, 0, power);
        state.aiPassTimer = 0;
        return;
      }

      // 2. Opponent pressing close or held ball for > 1.2s? Pass to teammate!
      const oppClose = this.isOpponentNear(player, 3.5);
      if ((oppClose || state.aiPassTimer > 1.4) && Math.random() < 0.25) {
        const forwardDirZ = player.team === 'blue' ? 1 : -1;
        this.passingSystem.executePass(player, 0, forwardDirZ);
        state.aiPassTimer = 0;
        return;
      }

      // 3. Otherwise: dribble forward towards opponent goal
      const forwardDirZ = player.team === 'blue' ? 1 : -1;
      const speed = PHYSICS_CONFIG.playerBaseSpeed * 0.85;
      this.controller.applyAIVelocity(player, 0, forwardDirZ * speed, dt);
      return;
    }

    // ── CASE B: AI does NOT have the ball ──
    const possessor = this.ball.possessorId ? this.players.get(this.ball.possessorId) : null;

    // 1. If opponent has the ball nearby, attempt tackle
    if (possessor && possessor.team !== player.team) {
      const distToPossessor = Math.hypot(possessor.x - player.x, possessor.z - player.z);
      if (distToPossessor < 2.2 && !player.isTackling) {
        this.tackleSystem.executeTackle(player);
        return;
      }
    }

    // 2. If designated presser or free ball is close: chase the ball!
    const distToBall = Math.hypot(this.ball.x - player.x, this.ball.z - player.z);
    if (isPresser || (!this.ball.possessorId && distToBall < 18)) {
      const dx = this.ball.x - player.x;
      const dz = this.ball.z - player.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.5) {
        const speed = PHYSICS_CONFIG.playerBaseSpeed * 0.95;
        this.controller.applyAIVelocity(player, (dx / dist) * speed, (dz / dist) * speed, dt);
      }
      return;
    }

    // 3. Positional support: stay in role zone shifted by ball position
    const teamDir = player.team === 'blue' ? 1 : -1;
    let targetX = 0;
    let targetZ = 0;

    if (player.role === 'forward') {
      targetX = player.team === 'blue' ? 8 : -8;
      targetZ = oppGoalZ * 0.45 + this.ball.z * 0.3;
    } else if (player.role === 'midfielder') {
      targetX = (player.number % 2 === 0 ? 1 : -1) * 12;
      targetZ = this.ball.z * 0.6;
    } else {
      // Defender: stay between ball and own goal
      const ownGoalZ = -oppGoalZ;
      targetX = this.ball.x * 0.5;
      targetZ = ownGoalZ * 0.6 + this.ball.z * 0.2;
    }

    const dx = targetX - player.x;
    const dz = targetZ - player.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 1.5) {
      const speed = Math.min(PHYSICS_CONFIG.playerBaseSpeed * 0.7, dist * 3.0);
      this.controller.applyAIVelocity(player, (dx / dist) * speed, (dz / dist) * speed, dt);
    } else {
      this.controller.applyAIVelocity(player, 0, 0, dt);
    }
  }

  private findClosestFieldPlayerToBall(team: 'blue' | 'red'): FootballPlayerEntityType | null {
    let closest: FootballPlayerEntityType | null = null;
    let minDist = Infinity;

    for (const player of this.players.values()) {
      if (player.team !== team || player.isGoalkeeper || player.isStunned) continue;
      const dist = Math.hypot(this.ball.x - player.x, this.ball.z - player.z);
      if (dist < minDist) {
        minDist = dist;
        closest = player;
      }
    }
    return closest;
  }

  private isOpponentNear(player: FootballPlayerEntityType, radius: number): boolean {
    for (const opp of this.players.values()) {
      if (opp.team === player.team) continue;
      const dist = Math.hypot(opp.x - player.x, opp.z - player.z);
      if (dist < radius) return true;
    }
    return false;
  }
}
