import type { Room, Client } from '@colyseus/core';
import type { SessionStateType, PlayerStateType } from '@platform/sdk-core';
import { FootballMatchState, FootballBallEntity } from '@platform/sdk-core';
import { MatchManager } from './MatchManager.js';
import type { FootballInput } from '../shared/types.js';

export class MiniFootballGame {
  private room: Room<{ state: SessionStateType }>;
  public matchManager: MatchManager;
  private tickInterval?: NodeJS.Timeout;
  private lastTickTime = 0;

  constructor(room: Room<{ state: SessionStateType }>) {
    this.room = room;

    // Ensure footballMatch state is instantiated
    if (!this.room.state.footballMatch) {
      this.room.state.footballMatch = new FootballMatchState();
      this.room.state.footballMatch.ball = new FootballBallEntity();
    }

    this.matchManager = new MatchManager(this.room.state.footballMatch);
  }

  public start() {
    this.stop();

    // 1. Balance connected players into Blue and Red teams
    const connectedPlayers: PlayerStateType[] = [];
    this.room.state.players.forEach((p) => {
      if (p.isConnected) connectedPlayers.push(p);
    });

    let blueCount = 0;
    let redCount = 0;

    connectedPlayers.forEach((p, idx) => {
      if (!p.team) {
        // Alternate assignments
        p.team = idx % 2 === 0 ? 'blue' : 'red';
      }
      if (p.team === 'blue') blueCount++;
      else redCount++;
    });

    // Determine field players per team (max of human counts or min 2)
    const fieldPlayersPerTeam = Math.max(2, Math.max(blueCount, redCount));

    // Initialize the match with calculated team size
    this.matchManager.initMatch(fieldPlayersPerTeam, (winner) => {
      this.handleMatchFinished(winner);
    });

    // Assign initial field player to each human player
    connectedPlayers.forEach((p) => {
      const assigned = this.matchManager.switchSystem.assignInitialPlayer(
        p.id,
        p.nickname,
        (p.team as 'blue' | 'red') || 'blue'
      );
      p.controlledPlayerId = assigned ? assigned.id : '';
    });

    // 2. Start 60Hz authoritative loop
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - this.lastTickTime) / 1000);
      this.lastTickTime = now;

      this.matchManager.update(dt);
    }, 1000 / 60);

    console.log(
      `[MiniFootballGame] Maç başladı! (${fieldPlayersPerTeam}v${fieldPlayersPerTeam}, Mavi: ${blueCount}, Kırmızı: ${redCount})`
    );
  }

  public handleInput(client: Client, input: FootballInput) {
    if (this.room.state.activeGameId !== 'mini-football') return;

    const dt = 1 / 60;
    this.matchManager.handlePlayerInput(client.sessionId, input, dt);
  }

  public handleSwitch(client: Client) {
    if (this.room.state.activeGameId !== 'mini-football') return;

    const player = this.room.state.players.get(client.sessionId);
    if (!player) return;

    const switched = this.matchManager.switchSystem.switchControlledPlayer(
      client.sessionId,
      player.nickname,
      (player.team as 'blue' | 'red') || 'blue'
    );

    if (switched) {
      player.controlledPlayerId = switched.id;
    }
  }

  public handleChooseTeam(client: Client, team: 'blue' | 'red') {
    const player = this.room.state.players.get(client.sessionId);
    if (player) {
      player.team = team;
    }
  }

  public handlePlayerLeave(client: Client) {
    this.matchManager.switchSystem.unassignSession(client.sessionId);
  }

  private handleMatchFinished(winner: 'blue' | 'red' | 'draw') {
    this.stop();

    let winnerText = 'Berabere!';
    if (winner === 'blue') winnerText = 'Mavi Takım Kazandı! 🏆';
    if (winner === 'red') winnerText = 'Kırmızı Takım Kazandı! 🏆';

    this.room.state.winnerNickname = winnerText;
    this.room.state.status = 'game_over';

    console.log(`[MiniFootballGame] Maç Bitti! Sonuç: ${winnerText}`);
  }

  public stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }
}
