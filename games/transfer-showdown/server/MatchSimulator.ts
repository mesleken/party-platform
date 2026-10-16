import {
  HighlightType,
  ManagerBudgetState,
  ManagerTactics,
  MatchHighlight,
  MatchStats,
  PlayerCard,
  TeamSynergy
} from '../shared/types.js';
import { calculateTeamSynergy } from '../shared/tactics.js';
import { FMMatchEngine } from './FMMatchEngine.js';
import { MatchRunner } from './engine/MatchRunner.js';

/**
 * MatchSimulator — FMMatchEngine Çekirdeği Üzerinde Çalışan Hızlı Simülasyon Uyumluluk Katmanı.
 * İki ayrı kural motoru yerine aynı deterministik FMMatchEngine'i headless çalıştırır.
 */
export class MatchSimulator {
  private homeCards: PlayerCard[];
  private awayCards: PlayerCard[];
  private homeTactics: ManagerTactics;
  private awayTactics: ManagerTactics;
  private homeSynergy: TeamSynergy;
  private awaySynergy: TeamSynergy;

  private engine: FMMatchEngine;
  private matchStats: MatchStats;
  private highlights: MatchHighlight[] = [];

  constructor(
    homeCards: PlayerCard[],
    awayCards: PlayerCard[],
    homeTactics: ManagerTactics,
    awayTactics: ManagerTactics,
    seed: number = 20261016
  ) {
    this.homeCards = [...homeCards];
    this.awayCards = [...awayCards];
    this.homeTactics = { ...homeTactics };
    this.awayTactics = { ...awayTactics };

    this.homeSynergy = calculateTeamSynergy(homeTactics, homeCards);
    this.awaySynergy = calculateTeamSynergy(awayTactics, awayCards);

    const homeManager: ManagerBudgetState = {
      sessionId: 'sim-home',
      nickname: 'Ev Sahibi Menajer',
      avatar: '👔',
      teamIndex: 0,
      budget: 100,
      cards: this.homeCards,
      rosterCount: this.homeCards.length,
      availableMaxBid: 90,
      positionCounts: { GK: 1, DEF: 4, MID: 3, FWD: 3 },
      isSquadFull: true,
      hasPassedCurrentLot: false
    };

    const awayManager: ManagerBudgetState = {
      sessionId: 'sim-away',
      nickname: 'Deplasman Menajer',
      avatar: '👔',
      teamIndex: 1,
      budget: 100,
      cards: this.awayCards,
      rosterCount: this.awayCards.length,
      availableMaxBid: 90,
      positionCounts: { GK: 1, DEF: 4, MID: 3, FWD: 3 },
      isSquadFull: true,
      hasPassedCurrentLot: false
    };

    this.engine = new FMMatchEngine(
      this.homeCards,
      this.awayCards,
      this.homeTactics,
      this.awayTactics,
      homeManager,
      awayManager,
      { seed }
    );

    this.simulateFullMatch();
    this.matchStats = this.engine.getFinalStats();
  }

  public updateTactics(team: 0 | 1, newTactics: ManagerTactics) {
    if (team === 0) {
      this.homeTactics = { ...newTactics };
      this.homeSynergy = calculateTeamSynergy(newTactics, this.homeCards);
    } else {
      this.awayTactics = { ...newTactics };
      this.awaySynergy = calculateTeamSynergy(newTactics, this.awayCards);
    }

    this.engine.updateLiveTactics(team, {
      playstyle: newTactics.playstyle,
      defensiveLine: newTactics.defensiveLine
    });
  }

  public reSimulateSecondHalf() {
    this.engine.startSecondHalf();
    MatchRunner.runHeadlessToCompletion(this.engine, 0.05);
    this.matchStats = this.engine.getFinalStats();
    this.extractHighlights();
  }

  private simulateFullMatch() {
    // 1. Yarı
    MatchRunner.runHeadlessToCompletion(this.engine, 0.05);
    if (!this.engine.isFinished()) {
      this.engine.startSecondHalf();
      MatchRunner.runHeadlessToCompletion(this.engine, 0.05);
    }
    this.extractHighlights();
  }

  private extractHighlights() {
    const snap = this.engine.getSnapshotState();
    const timeline = snap.timelineMarkers || [];
    this.highlights = timeline.map((m, idx) => ({
      id: `hl-${m.minute}-${idx}`,
      minute: m.minute,
      attackingTeam: m.teamIndex,
      type: m.type === 'GOAL' ? 'GOAL' : (m.type === 'SAVE' ? 'SAVE' : (m.type === 'WOODWORK' ? 'WOODWORK' : 'TACKLE')),
      commentary: m.label,
      subText: m.type === 'GOAL' ? 'Kusursuz hücum kombinasyonu ile top ağlarda!' : 'Kritik pozisyon.',
      scorerName: m.type === 'GOAL' ? m.label.replace('⚽ ', '') : undefined,
      keeperName: 'Kaleci',
      scoreHome: snap.matchScore[0],
      scoreAway: snap.matchScore[1],
      durationSec: 4.0,
      animType: m.type === 'GOAL' ? 'box_finish' : 'keeper_dive'
    }));
  }

  public getHighlights(): MatchHighlight[] {
    return this.highlights;
  }

  public getMatchStats(): MatchStats {
    return this.engine.getFinalStats();
  }

  public getFinalScore(): [number, number] {
    return this.engine.getFinalStats().score;
  }

  public getScorers(): Array<{ name: string; minute: number; team: 0 | 1 }> {
    return this.engine.getFinalStats().scorers;
  }

  public getSynergies(): [TeamSynergy, TeamSynergy] {
    return [this.homeSynergy, this.awaySynergy];
  }
}
