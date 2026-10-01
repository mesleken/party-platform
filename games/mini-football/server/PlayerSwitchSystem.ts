import type { FootballPlayerEntityType, FootballBallEntityType } from '@platform/sdk-core';

export class PlayerSwitchSystem {
  private players: Map<string, FootballPlayerEntityType>;
  private ball: FootballBallEntityType;

  constructor(players: Map<string, FootballPlayerEntityType>, ball: FootballBallEntityType) {
    this.players = players;
    this.ball = ball;
  }

  /**
   * Switches human user's controlled player to the best available teammate.
   * Excludes goalkeepers and players currently controlled by other humans.
   */
  public switchControlledPlayer(
    sessionId: string,
    userNickname: string,
    team: 'blue' | 'red'
  ): FootballPlayerEntityType | null {
    // Find currently controlled player for this user
    let currentControlled: FootballPlayerEntityType | null = null;
    for (const player of this.players.values()) {
      if (player.controlledBySessionId === sessionId) {
        currentControlled = player;
        break;
      }
    }

    // Find candidate teammates
    const candidates: FootballPlayerEntityType[] = [];
    for (const player of this.players.values()) {
      // Must be same team
      if (player.team !== team) continue;
      // Cannot switch to goalkeeper (goalkeepers are always AI)
      if (player.isGoalkeeper) continue;
      // Cannot switch to a player controlled by another human
      if (player.controlledBySessionId && player.controlledBySessionId !== sessionId) continue;
      // Prefer not switching to self if there are alternatives
      if (currentControlled && player.id === currentControlled.id) continue;

      candidates.push(player);
    }

    // If only self is available or no other candidates
    if (candidates.length === 0) {
      return currentControlled;
    }

    // Rank candidates by distance to ball (or if teammate has ball, that player is priority 1!)
    let bestCandidate: FootballPlayerEntityType = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      let score = 0;
      if (candidate.hasBall) {
        score += 1000; // Priority if teammate already possesses the ball!
      }

      const distToBall = Math.hypot(candidate.x - this.ball.x, candidate.z - this.ball.z);
      score -= distToBall; // Closer to ball has higher score

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    // Relinquish previous player to AI
    if (currentControlled) {
      currentControlled.controlledBySessionId = '';
      currentControlled.controlledByName = '';
    }

    // Assign new player to human
    bestCandidate.controlledBySessionId = sessionId;
    bestCandidate.controlledByName = userNickname;

    return bestCandidate;
  }

  /**
   * Auto-assigns an initial player for a newly joined human or at kickoff
   */
  public assignInitialPlayer(
    sessionId: string,
    userNickname: string,
    team: 'blue' | 'red'
  ): FootballPlayerEntityType | null {
    for (const player of this.players.values()) {
      if (player.team === team && !player.isGoalkeeper && !player.controlledBySessionId) {
        player.controlledBySessionId = sessionId;
        player.controlledByName = userNickname;
        return player;
      }
    }
    return null;
  }

  /**
   * Clears assignment when human disconnects
   */
  public unassignSession(sessionId: string) {
    for (const player of this.players.values()) {
      if (player.controlledBySessionId === sessionId) {
        player.controlledBySessionId = '';
        player.controlledByName = '';
      }
    }
  }
}
