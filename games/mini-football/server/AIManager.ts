import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballPlayerEntityType, FootballBallEntityType } from '@platform/sdk-core';
import type { PlayerControllerSystem } from './PlayerControllerSystem.js';
import type { PassingSystem } from './PassingSystem.js';
import type { ShootingSystem } from './ShootingSystem.js';
import type { TackleSystem } from './TackleSystem.js';
import type { GoalkeeperAI } from './GoalkeeperAI.js';

interface AIDecisionState {
  aiPassTimer: number;
  dribbleTimer: number;
  evadeDirX: number;
  lastDecisionTime: number;
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
    // 1. Identify pressers for each team
    const closestBlue = this.findClosestFieldPlayerToBall('blue');
    const closestRed = this.findClosestFieldPlayerToBall('red');

    for (const player of this.players.values()) {
      if (player.isStunned) continue;

      // Goalkeepers handled by specialized GoalkeeperAI
      if (player.isGoalkeeper) {
        this.goalkeeperAI.update(player, dt);
        continue;
      }

      // Skip human-controlled players
      if (player.controlledBySessionId) {
        continue;
      }

      // AI Field Player Behavior
      this.updateFieldAI(player, player === closestBlue || player === closestRed, dt);
    }
  }

  private updateFieldAI(player: FootballPlayerEntityType, isPresser: boolean, dt: number) {
    const forwardDirZ = player.team === 'blue' ? 1 : -1;
    const oppGoalZ = (PITCH_CONFIG.length / 2) * forwardDirZ;
    const ownGoalZ = -oppGoalZ;
    const distToGoal = Math.abs(oppGoalZ - player.z);

    let state = this.aiStates.get(player.id);
    if (!state) {
      state = {
        aiPassTimer: 0,
        dribbleTimer: Math.random() * 10,
        evadeDirX: Math.random() > 0.5 ? 1 : -1,
        lastDecisionTime: 0
      };
      this.aiStates.set(player.id, state);
    }
    state.dribbleTimer += dt;

    // ═══════════════════════════════════════════════════════════
    // CASE A: AI HAS THE BALL (Dribbling, Evading, Passing, Shooting)
    // ═══════════════════════════════════════════════════════════
    if (this.ball.possessorId === player.id) {
      state.aiPassTimer += dt;

      // 1. In Shooting Range? Aim for corners away from Goalkeeper!
      if (distToGoal <= 28.0) {
        // Find opponent goalkeeper to place shot in opposite corner
        const oppGk = this.findOpponentGoalkeeper(player.team);
        const goalHalfWidth = PITCH_CONFIG.goalWidth / 2 - 1.2;

        let targetCornerX = 0;
        if (oppGk) {
          // If GK is on left, aim for right post; if GK on right, aim for left post
          targetCornerX = oppGk.x < 0 ? goalHalfWidth * 0.85 : -goalHalfWidth * 0.85;
        } else {
          targetCornerX = (Math.random() > 0.5 ? 1 : -1) * goalHalfWidth * 0.75;
        }

        const aimDirX = targetCornerX - player.x;
        const aimDirZ = oppGoalZ - player.z;
        const shotPower = Math.min(1.0, 0.6 + (distToGoal / 28.0) * 0.35);

        this.shootingSystem.executeShot(player, aimDirX, aimDirZ, shotPower);
        state.aiPassTimer = 0;
        return;
      }

      // 2. Intelligent Passing: Search for open, forward teammates
      const oppClose = this.isOpponentNear(player, 3.2);
      const shouldLookForPass = oppClose || state.aiPassTimer > 1.2;

      if (shouldLookForPass) {
        const bestPass = this.findBestTeammateToPass(player);
        if (bestPass) {
          const toMateX = bestPass.x - player.x;
          const toMateZ = bestPass.z - player.z;
          this.passingSystem.executePass(player, toMateX, toMateZ);
          state.aiPassTimer = 0;
          return;
        }
      }

      // 3. Dynamic Dribble & Juke / Slalom (No More Running Straight!)
      const baseSpeed = PHYSICS_CONFIG.playerBaseSpeed;

      // Check if defender is directly in front
      const defenderInFront = this.findOpponentInFront(player, 5.5);
      let lateralVx = 0;

      if (defenderInFront) {
        // Cut left or right away from the defender
        const avoidSide = player.x > defenderInFront.x ? 1 : -1;
        state.evadeDirX = avoidSide;
        lateralVx = avoidSide * 8.5; // Sharp sidestep / juke
        player.isSprinting = true;
      } else {
        // Rhythmic athletic slalom body-feints (weaves left and right)
        const weave = Math.sin(state.dribbleTimer * 3.8) * 3.6;

        // Cut inward if wide on the wing
        const cutInward = Math.abs(player.x) > 12.0 ? -Math.sign(player.x) * 4.0 : 0;
        lateralVx = weave + cutInward;
        player.isSprinting = false;
      }

      const forwardVz = forwardDirZ * (player.isSprinting ? PHYSICS_CONFIG.playerSprintSpeed : baseSpeed);

      // Clamp lateral velocity to keep inside pitch
      const halfW = PITCH_CONFIG.width / 2 - 2.0;
      if (player.x < -halfW && lateralVx < 0) lateralVx = 2.0;
      if (player.x > halfW && lateralVx > 0) lateralVx = -2.0;

      this.controller.applyAIVelocity(player, lateralVx, forwardVz, dt);
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // CASE B: AI DOES NOT HAVE THE BALL (Pressing, Marking, Off-ball Runs)
    // ═══════════════════════════════════════════════════════════
    const possessor = this.ball.possessorId ? this.players.get(this.ball.possessorId) : null;
    const teamHasBall = possessor && possessor.team === player.team;
    const oppHasBall = possessor && possessor.team !== player.team;

    // 1. Sliding Tackle against opponent possessor
    if (oppHasBall && possessor) {
      const distToPossessor = Math.hypot(possessor.x - player.x, possessor.z - player.z);
      if (distToPossessor < 2.3 && !player.isTackling) {
        this.tackleSystem.executeTackle(player);
        return;
      }
    }

    // 2. Presser / Chaser (Interception path rather than straight pursuit)
    const distToBall = Math.hypot(this.ball.x - player.x, this.ball.z - player.z);
    if (isPresser || (!this.ball.possessorId && distToBall < 18.0)) {
      // Predict ball movement lead for smart interception
      const leadTime = Math.min(0.35, distToBall / PHYSICS_CONFIG.playerSprintSpeed);
      const targetBallX = this.ball.x + (this.ball.vx || 0) * leadTime;
      const targetBallZ = this.ball.z + (this.ball.vz || 0) * leadTime;

      const dx = targetBallX - player.x;
      const dz = targetBallZ - player.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0.4) {
        const sprintSpeed = PHYSICS_CONFIG.playerSprintSpeed;
        player.isSprinting = true;
        this.controller.applyAIVelocity(player, (dx / dist) * sprintSpeed, (dz / dist) * sprintSpeed, dt);
      }
      return;
    }

    // 3. Off-The-Ball Tactical Movement:
    // A) If team has ball: Make attacking runs and create passing triangles
    if (teamHasBall && possessor) {
      player.isSprinting = false;
      let targetX = 0;
      let targetZ = 0;

      if (player.role === 'forward') {
        // Forwards make diagonal runs into the box / behind defense
        const flank = player.number % 2 === 0 ? 1 : -1;
        targetX = flank * (10.0 + Math.sin(state.dribbleTimer * 2.0) * 4.0);
        targetZ = oppGoalZ * 0.72 + forwardDirZ * 4.0;
      } else if (player.role === 'midfielder') {
        // Midfielders spread wide on the wing to receive crosses
        const flank = player.number % 2 === 0 ? 1 : -1;
        targetX = flank * 18.0;
        targetZ = possessor.z + forwardDirZ * 5.0;
      } else {
        // Defenders push up towards halfway to support team shape
        targetX = possessor.x * 0.5;
        targetZ = Math.min(10.0, Math.max(-10.0, possessor.z * 0.6));
      }

      const dx = targetX - player.x;
      const dz = targetZ - player.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.2) {
        const speed = Math.min(PHYSICS_CONFIG.playerBaseSpeed * 0.85, dist * 3.5);
        this.controller.applyAIVelocity(player, (dx / dist) * speed, (dz / dist) * speed, dt);
      } else {
        this.controller.applyAIVelocity(player, 0, 0, dt);
      }
      return;
    }

    // B) If opponent has ball: Compact defensive marking (Block passing lanes)
    if (oppHasBall && possessor) {
      let targetX = 0;
      let targetZ = 0;

      if (player.role === 'defender') {
        // Defenders position strictly between the ball and own goal
        targetX = (this.ball.x * 0.6 + (player.number % 2 === 0 ? 4 : -4));
        targetZ = ownGoalZ * 0.75 + this.ball.z * 0.2;
      } else {
        // Midfielders / Forwards track back to form a 2nd defensive line
        targetX = this.ball.x * 0.7;
        targetZ = ownGoalZ * 0.35 + this.ball.z * 0.4;
      }

      const dx = targetX - player.x;
      const dz = targetZ - player.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.0) {
        const speed = Math.min(PHYSICS_CONFIG.playerBaseSpeed * 0.9, dist * 4.0);
        this.controller.applyAIVelocity(player, (dx / dist) * speed, (dz / dist) * speed, dt);
      } else {
        this.controller.applyAIVelocity(player, 0, 0, dt);
      }
      return;
    }

    // C) Neutral / Loose Ball Positional Home Zone
    const teamDir = player.team === 'blue' ? 1 : -1;
    let homeX = (player.number % 2 === 0 ? 1 : -1) * 8.0;
    let homeZ = this.ball.z * 0.5;

    const dx = homeX - player.x;
    const dz = homeZ - player.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 1.5) {
      const speed = Math.min(PHYSICS_CONFIG.playerBaseSpeed * 0.7, dist * 3.0);
      this.controller.applyAIVelocity(player, (dx / dist) * speed, (dz / dist) * speed, dt);
    } else {
      this.controller.applyAIVelocity(player, 0, 0, dt);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TACTICAL EVALUATION HELPERS
  // ═══════════════════════════════════════════════════════════

  private findBestTeammateToPass(passer: FootballPlayerEntityType): FootballPlayerEntityType | null {
    let bestMate: FootballPlayerEntityType | null = null;
    let bestScore = -Infinity;
    const forwardDirZ = passer.team === 'blue' ? 1 : -1;

    for (const mate of this.players.values()) {
      if (mate.team !== passer.team || mate.id === passer.id || mate.isGoalkeeper || mate.isStunned) {
        continue;
      }

      const dist = Math.hypot(mate.x - passer.x, mate.z - passer.z);
      if (dist < 6.0 || dist > 32.0) continue;

      // How far ahead is the teammate towards the opponent goal?
      const forwardAdvancement = (mate.z - passer.z) * forwardDirZ;

      // Check how marked the teammate is (distance to nearest opponent)
      let minDistToOpp = Infinity;
      for (const opp of this.players.values()) {
        if (opp.team === passer.team) continue;
        const oppDist = Math.hypot(opp.x - mate.x, opp.z - mate.z);
        if (oppDist < minDistToOpp) minDistToOpp = oppDist;
      }

      // We want teammates that are open (> 3.5m from defenders) and upfield
      const opennessScore = Math.min(10.0, minDistToOpp);
      const score = forwardAdvancement * 2.2 + opennessScore * 1.5 - Math.abs(dist - 16.0) * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestMate = mate;
      }
    }

    return bestScore > 2.0 ? bestMate : null;
  }

  private findOpponentInFront(player: FootballPlayerEntityType, maxDist: number): FootballPlayerEntityType | null {
    const forwardDirZ = player.team === 'blue' ? 1 : -1;
    let closestOpp: FootballPlayerEntityType | null = null;
    let minDist = maxDist;

    for (const opp of this.players.values()) {
      if (opp.team === player.team) continue;

      const dz = (opp.z - player.z) * forwardDirZ;
      const dx = Math.abs(opp.x - player.x);

      // In front of the dribbler and within collision cone
      if (dz > 0.5 && dz < minDist && dx < 2.5) {
        minDist = dz;
        closestOpp = opp;
      }
    }
    return closestOpp;
  }

  private findOpponentGoalkeeper(myTeam: string): FootballPlayerEntityType | null {
    for (const p of this.players.values()) {
      if (p.team !== myTeam && p.isGoalkeeper) return p;
    }
    return null;
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
