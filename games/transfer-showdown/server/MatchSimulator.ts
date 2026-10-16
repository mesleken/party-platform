import {
  HighlightType,
  ManagerTactics,
  MatchHighlight,
  MatchStats,
  PlayerCard,
  TeamSynergy
} from '../shared/types.js';
import { calculateTeamSynergy, getStyleMatchupBonus } from '../shared/tactics.js';

export class MatchSimulator {
  private homeCards: PlayerCard[];
  private awayCards: PlayerCard[];
  private homeTactics: ManagerTactics;
  private awayTactics: ManagerTactics;
  private homeSynergy: TeamSynergy;
  private awaySynergy: TeamSynergy;

  private highlights: MatchHighlight[] = [];
  private currentScore: [number, number] = [0, 0];
  private scorersList: Array<{ name: string; minute: number; team: 0 | 1 }> = [];
  private matchStats: MatchStats | null = null;

  constructor(
    homeCards: PlayerCard[],
    awayCards: PlayerCard[],
    homeTactics: ManagerTactics,
    awayTactics: ManagerTactics
  ) {
    this.homeCards = homeCards;
    this.awayCards = awayCards;
    this.homeTactics = homeTactics;
    this.awayTactics = awayTactics;

    this.homeSynergy = calculateTeamSynergy(homeTactics, homeCards);
    this.awaySynergy = calculateTeamSynergy(awayTactics, awayCards);

    this.simulateFullMatch();
  }

  public updateTactics(team: 0 | 1, newTactics: ManagerTactics) {
    if (team === 0) {
      this.homeTactics = newTactics;
      this.homeSynergy = calculateTeamSynergy(newTactics, this.homeCards);
    } else {
      this.awayTactics = newTactics;
      this.awaySynergy = calculateTeamSynergy(newTactics, this.awayCards);
    }
  }

  public reSimulateSecondHalf() {
    // Sadece 45. dakikadan sonrasını yeni taktiklere göre tekrar hesapla
    const firstHalfHighlights = this.highlights.filter((h) => h.minute <= 45);
    const firstHalfScorers = this.scorersList.filter((s) => s.minute <= 45);

    let homeScore = 0;
    let awayScore = 0;
    firstHalfHighlights.forEach((h) => {
      homeScore = h.scoreHome;
      awayScore = h.scoreAway;
    });

    this.currentScore = [homeScore, awayScore];
    this.scorersList = [...firstHalfScorers];

    const secondHalfHighlights = this.generateHalfHighlights(46, 90, this.currentScore);
    this.highlights = [...firstHalfHighlights, ...secondHalfHighlights];
    this.buildFinalStats();
  }

  private simulateFullMatch() {
    this.highlights = [];
    this.currentScore = [0, 0];
    this.scorersList = [];

    const firstHalf = this.generateHalfHighlights(1, 45, this.currentScore);
    const secondHalf = this.generateHalfHighlights(46, 90, this.currentScore);

    this.highlights = [...firstHalf, ...secondHalf];
    this.buildFinalStats();
  }

  private generateHalfHighlights(
    startMin: number,
    endMin: number,
    runningScore: [number, number]
  ): MatchHighlight[] {
    const halfHighlights: MatchHighlight[] = [];
    const bonus = getStyleMatchupBonus(this.homeTactics.playstyle, this.awayTactics.playstyle);

    const homeStrength = this.homeSynergy.overall + bonus.homeAdvantage;
    const awayStrength = this.awaySynergy.overall + bonus.awayAdvantage;

    const totalStrength = homeStrength + awayStrength;
    const homeAttackProb = homeStrength / totalStrength;

    // Kullanıcı isteği: Maç simülasyonu 2-3 dakika olsun (her yarıda 8-9 pozisyon)
    const eventCount = 8 + Math.floor(Math.random() * 2);
    const minuteStep = Math.floor((endMin - startMin) / eventCount);

    for (let i = 0; i < eventCount; i++) {
      const min = startMin + i * minuteStep + Math.floor(Math.random() * (minuteStep - 2));
      const isHomeAttack = Math.random() < homeAttackProb;
      const attackingTeam: 0 | 1 = isHomeAttack ? 0 : 1;

      const attSynergy = isHomeAttack ? this.homeSynergy : this.awaySynergy;
      const defSynergy = isHomeAttack ? this.awaySynergy : this.homeSynergy;
      const attCards = isHomeAttack ? this.homeCards : this.awayCards;
      const defCards = isHomeAttack ? this.awayCards : this.homeCards;

      const fwdCards = attCards.filter((c) => c.position === 'FWD');
      const midCards = attCards.filter((c) => c.position === 'MID');
      const gkCard = defCards.find((c) => c.position === 'GK') || defCards[0];

      const striker = fwdCards.length > 0 ? fwdCards[Math.floor(Math.random() * fwdCards.length)] : attCards[0];
      const playmaker = midCards.length > 0 ? midCards[Math.floor(Math.random() * midCards.length)] : attCards[1] || attCards[0];

      // Gol İhtimali Hesaplama
      const goalProbability = Math.min(0.75, Math.max(0.15, (attSynergy.attack - defSynergy.defense * 0.7 - defSynergy.goalkeeping * 0.25 + 50) / 100));
      const roll = Math.random();

      let type: HighlightType;
      let commentary = '';
      let subText = '';
      let animType: MatchHighlight['animType'] = 'box_finish';

      if (roll < goalProbability) {
        // GOL!
        type = 'GOAL';
        runningScore[attackingTeam]++;
        this.scorersList.push({ name: striker.shortName, minute: min, team: attackingTeam });

        const variations = [
          {
            comm: `GOOOL! ${striker.name} ceza sahasında mükemmel bir voleyle fileleri havalandırdı!`,
            sub: `${playmaker.name}'ın adrese teslim ortası golle sonuçlandı.`,
            anim: 'box_finish' as const
          },
          {
            comm: `HARİKA GOL! ${striker.name} yaklaşık 25 metreden füze gibi vurdu, top 90'a gitti!`,
            sub: `${gkCard.name} çaresizce uzandı ama topu durduramadı.`,
            anim: 'long_shot' as const
          },
          {
            comm: `TOP AĞLARDA! ${playmaker.name} nefis ara pası attı, ${striker.name} kaleciyi geçip boş kaleye yuvarladı!`,
            sub: `Kusursuz bir hücum kombinasyonu.`,
            anim: 'counter_rush' as const
          },
          {
            comm: `KAFFA VE GOOOL! Kornerde iyi yükselen ${striker.name} köşeye bıraktı!`,
            sub: `Defans ve kaleci bu vuruşta çaresiz kaldı.`,
            anim: 'header' as const
          }
        ];
        const chosen = variations[Math.floor(Math.random() * variations.length)];
        commentary = chosen.comm;
        subText = chosen.sub;
        animType = chosen.anim;
      } else if (roll < goalProbability + 0.35) {
        // KALECİ KURTARIŞI
        type = 'SAVE';
        const saves = [
          {
            comm: `İNANILMAZ KURTARIŞ! ${gkCard.name} köşeye giden şutta devleşti!`,
            sub: `${striker.name}'ın sert plasesini parmaklarının ucuyla kornere çeldi.`,
            anim: 'keeper_dive' as const
          },
          {
            comm: `DEVLEŞTİ! ${striker.name} kaleciyle karşı karşıya kaldı, ancak ${gkCard.name} geçit vermedi!`,
            sub: `Birebir pozisyonda açıyı muazzam kapattı.`,
            anim: 'keeper_dive' as const
          }
        ];
        const chosen = saves[Math.floor(Math.random() * saves.length)];
        commentary = chosen.comm;
        subText = chosen.sub;
        animType = chosen.anim;
      } else if (roll < goalProbability + 0.5) {
        // DİREK
        type = 'WOODWORK';
        commentary = `DİREKTEN DÖNDÜ! ${striker.name}'ın muazzam şutunda üst direk sallandı!`;
        subText = `Stadyumda büyük heyecan, santimlerle gol kaçtı.`;
        animType = 'long_shot';
      } else {
        // DEFANS BLOKU VEYA DIŞARI
        type = 'TACKLE';
        commentary = `KRİTİK MÜDAHALE! ${striker.name} kaleyi tam cepheden gördü ancak savunma ayak koydu!`;
        subText = `Son anda yapılan müdahale mutlak bir tehlikeyi önledi.`;
        animType = 'defensive_block';
      }

      halfHighlights.push({
        id: `hl-${min}-${i}`,
        minute: min,
        attackingTeam,
        type,
        commentary,
        subText,
        scorerName: type === 'GOAL' ? striker.name : undefined,
        assistName: type === 'GOAL' ? playmaker.name : undefined,
        keeperName: gkCard.name,
        scoreHome: runningScore[0],
        scoreAway: runningScore[1],
        durationSec: 9, // Pozisyon başına 9 saniye
        animType
      });
    }

    return halfHighlights;
  }

  private buildFinalStats() {
    const homeGoals = this.currentScore[0];
    const awayGoals = this.currentScore[1];

    const homeMid = this.homeSynergy.midfield;
    const awayMid = this.awaySynergy.midfield;
    const homePossession = Math.round((homeMid / (homeMid + awayMid)) * 100);
    const awayPossession = 100 - homePossession;

    const homeShots = this.highlights.filter((h) => h.attackingTeam === 0).length + 3;
    const awayShots = this.highlights.filter((h) => h.attackingTeam === 1).length + 2;

    const homeShotsOnTarget = this.highlights.filter((h) => h.attackingTeam === 0 && (h.type === 'GOAL' || h.type === 'SAVE')).length;
    const awayShotsOnTarget = this.highlights.filter((h) => h.attackingTeam === 1 && (h.type === 'GOAL' || h.type === 'SAVE')).length;

    const homeSaves = this.highlights.filter((h) => h.attackingTeam === 1 && h.type === 'SAVE').length;
    const awaySaves = this.highlights.filter((h) => h.attackingTeam === 0 && h.type === 'SAVE').length;

    // xG Hesabı
    const homeXg = Number((homeGoals * 0.65 + homeShotsOnTarget * 0.25 + homeShots * 0.05).toFixed(2));
    const awayXg = Number((awayGoals * 0.65 + awayShotsOnTarget * 0.25 + awayShots * 0.05).toFixed(2));

    // MVP Belirleme
    let mvpCard: PlayerCard;
    let mvpTeam: 0 | 1 = 0;
    let mvpReason = 'Sahanın her yerinde liderlik sergiledi.';

    if (homeGoals > awayGoals) {
      mvpTeam = 0;
      mvpCard = this.homeCards.find((c) => this.scorersList.some((s) => s.team === 0 && s.name === c.shortName)) || this.homeCards[0];
      mvpReason = 'Attığı kritik gollerle takımını zafere taşıdı.';
    } else if (awayGoals > homeGoals) {
      mvpTeam = 1;
      mvpCard = this.awayCards.find((c) => this.scorersList.some((s) => s.team === 1 && s.name === c.shortName)) || this.awayCards[0];
      mvpReason = 'Hücumdaki üstün performansı galibiyeti getirdi.';
    } else {
      // Beraberlikte en yüksek OVR kart veya kurtarış yapan kaleci
      mvpTeam = homeSaves >= awaySaves ? 0 : 1;
      const teamCards = mvpTeam === 0 ? this.homeCards : this.awayCards;
      mvpCard = teamCards.reduce((prev, curr) => (curr.ovr > prev.ovr ? curr : prev));
      mvpReason = 'Zorlu düelloda yüksek performansıyla maçın dengesini korudu.';
    }

    let winnerTeamIndex: 0 | 1 | -1 = -1;
    if (homeGoals > awayGoals) winnerTeamIndex = 0;
    else if (awayGoals > homeGoals) winnerTeamIndex = 1;

    this.matchStats = {
      score: [homeGoals, awayGoals],
      xg: [homeXg, awayXg],
      possession: [homePossession, awayPossession],
      shots: [homeShots, awayShots],
      shotsOnTarget: [homeShotsOnTarget, awayShotsOnTarget],
      saves: [homeSaves, awaySaves],
      passAccuracy: [84 + Math.floor(Math.random() * 8), 83 + Math.floor(Math.random() * 8)],
      fouls: [5 + Math.floor(Math.random() * 6), 6 + Math.floor(Math.random() * 5)],
      scorers: this.scorersList,
      mvp: {
        name: mvpCard.name,
        rating: Number((8.5 + Math.random() * 1.3).toFixed(1)),
        team: mvpTeam,
        card: mvpCard,
        reason: mvpReason
      },
      winnerTeamIndex
    };
  }

  public getHighlights(): MatchHighlight[] {
    return this.highlights;
  }

  public getMatchStats(): MatchStats | null {
    return this.matchStats;
  }

  public getFinalScore(): [number, number] {
    return this.currentScore;
  }

  public getSynergies(): [TeamSynergy, TeamSynergy] {
    return [this.homeSynergy, this.awaySynergy];
  }
}
