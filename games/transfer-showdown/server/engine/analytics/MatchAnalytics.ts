import { MatchStats, PlayerCard } from '../../../shared/types.js';
import { EnginePlayerRuntime, EngineTeamRuntime } from '../MatchState.js';
import { MatchEventLog } from './MatchEventLog.js';
import { PossessionTracker } from './PossessionTracker.js';

export class MatchAnalytics {
  private eventLog: MatchEventLog;
  private possessionTracker: PossessionTracker;
  private scorersList: Array<{ name: string; minute: number; team: 0 | 1 }> = [];

  constructor(eventLog: MatchEventLog, possessionTracker: PossessionTracker) {
    this.eventLog = eventLog;
    this.possessionTracker = possessionTracker;
  }

  public recordGoal(scorerName: string, minute: number, team: 0 | 1) {
    this.scorersList.push({ name: scorerName, minute, team });
  }

  public getScorers() {
    return this.scorersList;
  }

  public buildMatchStats(
    teams: [EngineTeamRuntime, EngineTeamRuntime],
    players: EnginePlayerRuntime[],
    homeCards: PlayerCard[],
    awayCards: PlayerCard[]
  ): MatchStats {
    const pos = this.possessionTracker.getPercentages();
    const t0 = teams[0];
    const t1 = teams[1];

    let winnerIdx: 0 | 1 | -1 = -1;
    if (t0.goals > t1.goals) winnerIdx = 0;
    else if (t1.goals > t0.goals) winnerIdx = 1;

    // MVP Seçimi: En yüksek rating'e sahip oyuncu
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    const topPlayer = sortedPlayers[0];
    const topCard = (topPlayer.teamIndex === 0 ? homeCards : awayCards).find((c) => c.id === topPlayer.id) || homeCards[0];

    const passAcc0 = t0.passesAttempted > 0
      ? Math.round((t0.passesCompleted / t0.passesAttempted) * 100)
      : 84;
    const passAcc1 = t1.passesAttempted > 0
      ? Math.round((t1.passesCompleted / t1.passesAttempted) * 100)
      : 82;

    return {
      score: [t0.goals, t1.goals],
      xg: [Number(t0.xg.toFixed(2)), Number(t1.xg.toFixed(2))],
      possession: [pos[0], pos[1]],
      shots: [t0.shots, t1.shots],
      shotsOnTarget: [t0.shotsOnTarget, t1.shotsOnTarget],
      saves: [t0.saves, t1.saves],
      passAccuracy: [passAcc0, passAcc1],
      fouls: [t0.fouls, t1.fouls],
      scorers: this.scorersList,
      mvp: {
        name: topPlayer ? topPlayer.name : 'Futbolcu',
        rating: Number((topPlayer?.rating || 8.2).toFixed(1)),
        team: topPlayer?.teamIndex || 0,
        card: topCard,
        reason: topPlayer?.goals
          ? 'Attığı kritik gollerle maçın kaderini değiştirdi.'
          : (topPlayer?.assists ? 'Yaptığı kilit asistlerle takımını hücumda sırtladı.' : 'Orta alanda üstün liderlik ve pas dağıtımı sergiledi.')
      },
      winnerTeamIndex: winnerIdx
    };
  }
}
