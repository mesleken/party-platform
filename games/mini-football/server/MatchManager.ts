import { PITCH_CONFIG, PHYSICS_CONFIG, DEFAULT_MATCH_CONFIG } from '../shared/config.js';
import { getFormation } from '../shared/teams.js';
import type {
  FootballMatchStateType,
  FootballPlayerEntityType,
  SessionStateType
} from '@platform/sdk-core';
import { FootballPlayerEntity } from '@platform/sdk-core';
import { BallSystem } from './BallSystem.js';
import { PossessionSystem } from './PossessionSystem.js';
import { PlayerControllerSystem } from './PlayerControllerSystem.js';
import { PassingSystem } from './PassingSystem.js';
import { ShootingSystem } from './ShootingSystem.js';
import { TackleSystem } from './TackleSystem.js';
import { PlayerSwitchSystem } from './PlayerSwitchSystem.js';
import { GoalkeeperAI } from './GoalkeeperAI.js';
import { AIManager } from './AIManager.js';
import { GoalSystem } from './GoalSystem.js';
import type { FootballInput } from '../shared/types.js';

export class MatchManager {
  public matchState: FootballMatchStateType;
  public playersMap = new Map<string, FootballPlayerEntityType>();

  public ballSystem: BallSystem;
  public possessionSystem: PossessionSystem;
  public controllerSystem: PlayerControllerSystem;
  public passingSystem: PassingSystem;
  public shootingSystem: ShootingSystem;
  public tackleSystem: TackleSystem;
  public switchSystem: PlayerSwitchSystem;
  public goalkeeperAI: GoalkeeperAI;
  public aiManager: AIManager;
  public goalSystem: GoalSystem;

  private onMatchEndCallback?: (winnerTeam: 'blue' | 'red' | 'draw') => void;

  constructor(matchState: FootballMatchStateType) {
    this.matchState = matchState;

    this.ballSystem = new BallSystem(this.matchState.ball);
    this.possessionSystem = new PossessionSystem(this.ballSystem, this.playersMap);
    this.controllerSystem = new PlayerControllerSystem(this.playersMap);
    this.passingSystem = new PassingSystem(this.ballSystem, this.possessionSystem, this.playersMap);
    this.shootingSystem = new ShootingSystem(this.ballSystem, this.possessionSystem);
    this.tackleSystem = new TackleSystem(this.possessionSystem, this.playersMap);
    this.switchSystem = new PlayerSwitchSystem(this.playersMap, this.matchState.ball);

    this.goalkeeperAI = new GoalkeeperAI(
      this.controllerSystem,
      this.passingSystem,
      this.possessionSystem,
      this.matchState.ball
    );

    this.aiManager = new AIManager(
      this.controllerSystem,
      this.passingSystem,
      this.shootingSystem,
      this.tackleSystem,
      this.goalkeeperAI,
      this.matchState.ball,
      this.playersMap
    );

    this.goalSystem = new GoalSystem(this.matchState.ball, this.playersMap);
  }

  public initMatch(
    fieldPlayersPerTeam: number = 2,
    onEnd?: (winnerTeam: 'blue' | 'red' | 'draw') => void
  ) {
    this.onMatchEndCallback = onEnd;
    this.playersMap.clear();
    this.matchState.footballPlayers.clear();

    const count = Math.max(1, Math.min(5, fieldPlayersPerTeam));

    // 1. Create Blue Team
    const blueFormation = getFormation('blue', count);
    blueFormation.forEach((spot, idx) => {
      const p = new FootballPlayerEntity();
      p.id = `blue_${idx}`;
      p.team = 'blue';
      p.role = spot.role;
      p.isGoalkeeper = Boolean(spot.isGoalkeeper);
      p.controlledBySessionId = '';
      p.controlledByName = '';
      p.x = spot.homeX;
      p.y = 0;
      p.z = spot.homeZ;
      p.vx = 0;
      p.vz = 0;
      p.angle = 0; // Blue faces +Z
      p.isSprinting = false;
      p.isTackling = false;
      p.isStunned = false;
      p.hasBall = false;
      p.number = spot.isGoalkeeper ? 1 : idx + 1;
      p.name = spot.isGoalkeeper ? 'GK Mavi' : `Mavi #${p.number}`;

      this.playersMap.set(p.id, p);
      this.matchState.footballPlayers.set(p.id, p);
    });

    // 2. Create Red Team
    const redFormation = getFormation('red', count);
    redFormation.forEach((spot, idx) => {
      const p = new FootballPlayerEntity();
      p.id = `red_${idx}`;
      p.team = 'red';
      p.role = spot.role;
      p.isGoalkeeper = Boolean(spot.isGoalkeeper);
      p.controlledBySessionId = '';
      p.controlledByName = '';
      p.x = spot.homeX;
      p.y = 0;
      p.z = spot.homeZ;
      p.vx = 0;
      p.vz = 0;
      p.angle = Math.PI; // Red faces -Z
      p.isSprinting = false;
      p.isTackling = false;
      p.isStunned = false;
      p.hasBall = false;
      p.number = spot.isGoalkeeper ? 1 : idx + 1;
      p.name = spot.isGoalkeeper ? 'GK Kırmızı' : `Kırmızı #${p.number}`;

      this.playersMap.set(p.id, p);
      this.matchState.footballPlayers.set(p.id, p);
    });

    // Reset scores & match clock
    this.matchState.blueScore = 0;
    this.matchState.redScore = 0;
    this.matchState.timeRemaining = PHYSICS_CONFIG.matchDuration;
    this.matchState.lastScorerName = '';
    this.matchState.lastScorerTeam = '';

    this.startKickoffCountdown('blue');
  }

  public startKickoffCountdown(kickoffTeam: 'blue' | 'red') {
    this.matchState.phase = 'countdown';
    this.matchState.phaseTimer = 3.0; // 3 second countdown

    this.resetPositionsToKickoff(kickoffTeam);
  }

  public resetPositionsToKickoff(kickoffTeam: 'blue' | 'red') {
    const fieldPlayersCount = (this.playersMap.size - 2) / 2;
    const blueFormation = getFormation('blue', fieldPlayersCount);
    const redFormation = getFormation('red', fieldPlayersCount);

    blueFormation.forEach((spot, idx) => {
      const p = this.playersMap.get(`blue_${idx}`);
      if (p) {
        p.x = spot.homeX;
        p.y = 0;
        p.z = spot.homeZ;
        p.vx = 0;
        p.vz = 0;
        p.angle = 0;
        p.isTackling = false;
        p.isStunned = false;
        p.hasBall = false;
      }
    });

    redFormation.forEach((spot, idx) => {
      const p = this.playersMap.get(`red_${idx}`);
      if (p) {
        p.x = spot.homeX;
        p.y = 0;
        p.z = spot.homeZ;
        p.vx = 0;
        p.vz = 0;
        p.angle = Math.PI;
        p.isTackling = false;
        p.isStunned = false;
        p.hasBall = false;
      }
    });

    // Reset ball to center
    this.ballSystem.reset(kickoffTeam);
  }

  public handlePlayerInput(sessionId: string, input: FootballInput, dt: number) {
    // Find player controlled by this session
    let controlled: FootballPlayerEntityType | null = null;
    for (const p of this.playersMap.values()) {
      if (p.controlledBySessionId === sessionId) {
        controlled = p;
        break;
      }
    }

    if (!controlled || controlled.isStunned) return;

    // Movement
    this.controllerSystem.applyHumanInput(controlled, input, dt);

    // Actions
    if (this.matchState.phase === 'playing') {
      if (input.pass) {
        this.passingSystem.executePass(controlled, input.moveX, input.moveY);
      } else if (input.shoot) {
        this.shootingSystem.executeShot(
          controlled,
          input.moveX,
          input.moveY,
          input.shootPower || 0.6
        );
      } else if (input.tackle) {
        this.tackleSystem.executeTackle(controlled);
      }
    }
  }

  public update(dt: number) {
    // 1. Countdown Phase
    if (this.matchState.phase === 'countdown') {
      this.matchState.phaseTimer -= dt;
      if (this.matchState.phaseTimer <= 0) {
        this.matchState.phase = 'playing';
      }
      return;
    }

    // 2. Goal Celebration Phase
    if (this.matchState.phase === 'goal') {
      this.matchState.phaseTimer -= dt;
      this.ballSystem.update(dt);
      this.controllerSystem.updatePositions(dt);

      if (this.matchState.phaseTimer <= 0) {
        // Check if game over by score (5 goals)
        if (
          this.matchState.blueScore >= PHYSICS_CONFIG.maxGoals ||
          this.matchState.redScore >= PHYSICS_CONFIG.maxGoals
        ) {
          this.endMatch();
        } else {
          // Restart kickoff for conceding team
          const concedingTeam = this.matchState.lastScorerTeam === 'blue' ? 'red' : 'blue';
          this.startKickoffCountdown(concedingTeam);
        }
      }
      return;
    }

    // 3. Match End Phase
    if (this.matchState.phase === 'match_end') {
      return;
    }

    // 4. Playing Phase
    if (this.matchState.phase === 'playing') {
      // Countdown match clock
      this.matchState.timeRemaining = Math.max(0, this.matchState.timeRemaining - dt);
      if (this.matchState.timeRemaining <= 0) {
        this.endMatch();
        return;
      }

      // Update Tackles & Stuns
      this.tackleSystem.update(dt);

      // Update AI (Goalkeepers & Field AI)
      this.aiManager.update(dt);

      // Update positions & physics
      this.controllerSystem.updatePositions(dt);
      this.ballSystem.update(dt);
      this.possessionSystem.update(dt);

      // Check Goal
      const goalEvent = this.goalSystem.checkGoal();
      if (goalEvent) {
        this.matchState.phase = 'goal';
        this.matchState.phaseTimer = PHYSICS_CONFIG.goalCelebrationDuration;
        this.matchState.lastScorerName = goalEvent.scorerName;
        this.matchState.lastScorerTeam = goalEvent.scoringTeam;

        if (goalEvent.scoringTeam === 'blue') {
          this.matchState.blueScore++;
        } else {
          this.matchState.redScore++;
        }
      }
    }
  }

  private endMatch() {
    this.matchState.phase = 'match_end';
    let winner: 'blue' | 'red' | 'draw' = 'draw';
    if (this.matchState.blueScore > this.matchState.redScore) {
      winner = 'blue';
    } else if (this.matchState.redScore > this.matchState.blueScore) {
      winner = 'red';
    }

    if (this.onMatchEndCallback) {
      this.onMatchEndCallback(winner);
    }
  }
}
