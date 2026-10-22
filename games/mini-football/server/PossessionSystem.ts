import { PITCH_CONFIG, PHYSICS_CONFIG } from '../shared/config.js';
import type { FootballBallEntityType, FootballPlayerEntityType } from '@platform/sdk-core';
import type { BallSystem } from './BallSystem.js';

export class PossessionSystem {
  private ballSystem: BallSystem;
  private ball: FootballBallEntityType;
  private players: Map<string, FootballPlayerEntityType>;

  private kickCooldownPlayerId = '';
  private kickCooldownTimer = 0;

  constructor(ballSystem: BallSystem, players: Map<string, FootballPlayerEntityType>) {
    this.ballSystem = ballSystem;
    this.ball = ballSystem.ball;
    this.players = players;
  }

  public setKickCooldown(playerId: string, durationSec = 0.65) {
    this.kickCooldownPlayerId = playerId;
    this.kickCooldownTimer = durationSec;
  }

  public update(dt: number) {
    if (this.kickCooldownTimer > 0) {
      this.kickCooldownTimer -= dt;
      if (this.kickCooldownTimer <= 0) {
        this.kickCooldownPlayerId = '';
      }
    }

    const currentPossessor = this.ball.possessorId ? this.players.get(this.ball.possessorId) : null;

    // 1. If currently possessed
    if (currentPossessor) {
      // If possessor was stunned or tackling or inactive, strip possession
      if (currentPossessor.isStunned) {
        this.stripPossession(currentPossessor);
        return;
      }

      // Update ball position in front of player
      const dribbleOffset = PHYSICS_CONFIG.possessionDribbleOffset;
      const targetX = currentPossessor.x + Math.sin(currentPossessor.angle) * dribbleOffset;
      const targetZ = currentPossessor.z + Math.cos(currentPossessor.angle) * dribbleOffset;

      // Smoothly track towards dribble position
      this.ball.x = targetX;
      this.ball.z = targetZ;
      this.ball.y = PITCH_CONFIG.ballRadius;
      this.ball.vx = currentPossessor.vx;
      this.ball.vz = currentPossessor.vz;
      this.ball.vy = 0;
      this.ball.lastTouchTeam = currentPossessor.team;
      return;
    }

    // 2. Not possessed: check soft possession zones for all players
    // Only field players or goalkeepers who are not stunned can acquire possession
    let closestCandidate: FootballPlayerEntityType | null = null;
    let closestDistSq = Infinity;

    for (const player of this.players.values()) {
      if (player.isStunned) continue;

      // Kicker immunity cooldown (prevents catching own pass/shot immediately)
      if (player.id === this.kickCooldownPlayerId && this.kickCooldownTimer > 0) {
        continue;
      }

      const dx = this.ball.x - player.x;
      const dz = this.ball.z - player.z;
      const distSq = dx * dx + dz * dz;

      // Goalkeeper can catch balls up to goal height inside their zone
      const maxY = player.isGoalkeeper ? PITCH_CONFIG.goalHeight : 2.2;

      if (this.ball.y <= maxY && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestCandidate = player;
      }
    }

    if (!closestCandidate) return;

    const dist = Math.sqrt(closestDistSq);
    const reach = closestCandidate.isGoalkeeper
      ? 2.8 // Goalkeepers have extended dive and catch reach
      : PHYSICS_CONFIG.possessionDribbleOffset + 0.35;

    // Zone 3: Full possession
    if (dist <= reach) {
      this.takePossession(closestCandidate);
    } 
    // Zone 2: Soft attraction (nudge towards player)
    else if (dist <= (closestCandidate.isGoalkeeper ? 4.5 : PHYSICS_CONFIG.possessionAttractRadius)) {
      const pullSpeed = closestCandidate.isGoalkeeper ? 6.0 : 4.0;
      const dirX = (closestCandidate.x - this.ball.x) / dist;
      const dirZ = (closestCandidate.z - this.ball.z) / dist;

      this.ball.vx += dirX * pullSpeed * dt * 10;
      this.ball.vz += dirZ * pullSpeed * dt * 10;
    }
  }

  public takePossession(player: FootballPlayerEntityType) {
    // Clear ball possession from any other player
    for (const p of this.players.values()) {
      p.hasBall = false;
    }

    // Possession changes to a player: clear kicker cooldown
    if (player.id !== this.kickCooldownPlayerId) {
      this.kickCooldownPlayerId = '';
      this.kickCooldownTimer = 0;
    }

    player.hasBall = true;
    this.ball.possessorId = player.id;
    this.ball.lastPossessorId = player.id;
    this.ball.lastTouchTeam = player.team;
  }

  public stripPossession(player: FootballPlayerEntityType, knockX = 0, knockZ = 0) {
    player.hasBall = false;
    this.ball.possessorId = '';
    this.ball.lastPossessorId = player.id;
    this.ball.lastTouchTeam = player.team;

    // Small knock-away impulse
    this.ball.vx = knockX || (Math.random() - 0.5) * 6;
    this.ball.vz = knockZ || (Math.random() - 0.5) * 6;
    this.ball.vy = 2.0;
  }

  public clearPossession() {
    for (const p of this.players.values()) {
      p.hasBall = false;
    }
    this.ball.possessorId = '';
  }
}
