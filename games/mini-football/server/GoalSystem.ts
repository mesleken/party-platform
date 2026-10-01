import { PITCH_CONFIG } from '../shared/config.js';
import type { FootballBallEntityType, FootballPlayerEntityType } from '@platform/sdk-core';

export interface GoalEvent {
  scoringTeam: 'blue' | 'red';
  scorerPlayerId: string;
  scorerName: string;
}

export class GoalSystem {
  private ball: FootballBallEntityType;
  private players: Map<string, FootballPlayerEntityType>;

  constructor(ball: FootballBallEntityType, players: Map<string, FootballPlayerEntityType>) {
    this.ball = ball;
    this.players = players;
  }

  /**
   * Checks if ball has crossed into either goal.
   * Red goal is at Z = +45 (Blue scores).
   * Blue goal is at Z = -45 (Red scores).
   */
  public checkGoal(): GoalEvent | null {
    const halfLength = PITCH_CONFIG.length / 2;
    const goalHalfWidth = PITCH_CONFIG.goalWidth / 2;

    // Check if ball is beyond goal line, within posts, and under crossbar
    if (Math.abs(this.ball.x) <= goalHalfWidth && this.ball.y <= PITCH_CONFIG.goalHeight) {
      if (this.ball.z > halfLength) {
        // Entered Red's goal -> Blue scores!
        return this.createGoalEvent('blue');
      } else if (this.ball.z < -halfLength) {
        // Entered Blue's goal -> Red scores!
        return this.createGoalEvent('red');
      }
    }

    return null;
  }

  private createGoalEvent(scoringTeam: 'blue' | 'red'): GoalEvent {
    let scorerPlayerId = this.ball.lastPossessorId;
    let scorerName = scoringTeam === 'blue' ? 'Mavi Takım' : 'Kırmızı Takım';

    if (scorerPlayerId) {
      const p = this.players.get(scorerPlayerId);
      if (p) {
        scorerName = p.controlledByName || p.name || `#${p.number}`;
      }
    }

    return {
      scoringTeam,
      scorerPlayerId,
      scorerName
    };
  }
}
