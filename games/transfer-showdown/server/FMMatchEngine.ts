import {
  CardPosition,
  DefensiveLineType,
  HighlightType,
  LiveTickerMessage,
  ManagerBudgetState,
  ManagerTactics,
  MatchHighlight,
  MatchPlayPhase,
  MatchStats,
  MentalityType,
  PitchBallState,
  PitchPlayerState,
  PlayerCard,
  PlaystyleType,
  TimelineMarker,
  TouchlineShoutType
} from '../shared/types.js';
import { getFormationSlots } from '../shared/formations.js';
import { calculateTeamSynergy, getStyleMatchupBonus } from '../shared/tactics.js';

// Modular Engine Systems
import { SeededRandom } from './engine/random/SeededRandom.js';
import {
  EnginePlayerRuntime,
  EngineTeamRuntime,
  MatchClockState,
  MatchEngineConfig,
  PassContext,
  ShotContext,
  Vec2
} from './engine/MatchState.js';
import { MatchRunner } from './engine/MatchRunner.js';
import { getRoleGroup, getRoleProfile, isFlankPlayer } from './engine/tactics/RoleBehavior.js';
import { PositioningSystem } from './engine/tactics/PositioningSystem.js';
import {
  chooseAttackPlan,
  computeTeamStyle,
  describeMentality
} from './engine/tactics/TeamTactics.js';
import { MovementSystem } from './engine/systems/MovementSystem.js';
import { BallSystem } from './engine/systems/BallSystem.js';
import { PassingSystem } from './engine/systems/PassingSystem.js';
import { ShootingSystem } from './engine/systems/ShootingSystem.js';
import { DuelSystem } from './engine/systems/DuelSystem.js';
import { OffsideRule } from './engine/rules/OffsideRule.js';
import { RestartSystem } from './engine/rules/RestartSystem.js';
import { MatchEventLog } from './engine/analytics/MatchEventLog.js';
import { PossessionTracker } from './engine/analytics/PossessionTracker.js';
import { MatchAnalytics } from './engine/analytics/MatchAnalytics.js';
import { clamp, dist, fromOwn, toOwn } from './engine/util/Geometry.js';

export class FMMatchEngine {
  private config: MatchEngineConfig;
  private rng: SeededRandom;
  private runner: MatchRunner;

  private homeTeam: EngineTeamRuntime;
  private awayTeam: EngineTeamRuntime;
  private homeCards: PlayerCard[];
  private awayCards: PlayerCard[];

  // 22 Oyuncu ve Merkezi Top Sistemi
  private players: EnginePlayerRuntime[] = [];
  private ballSystem: BallSystem;

  // Durum Makinesi & Saat
  private playPhase: MatchPlayPhase = 'KICK_OFF';
  private phaseTimer = 0;
  private clock: MatchClockState;
  private isMatchFinished = false;

  // Analitik & Olay Günlüğü
  private eventLog: MatchEventLog;
  private possessionTracker: PossessionTracker;
  private analytics: MatchAnalytics;

  // Momentum, Vurgu ve Geçiş Takibi
  private momentum = 0;
  private momentumHistory: number[] = [];
  private currentHighlight: MatchHighlight | null = null;
  private lastCompletedPass: PassContext | null = null;
  private lastPossessionTeam: 0 | 1 = 0;
  private secondsSincePossessionChange = 10;

  // Top taşıyıcının tekil sürüş mesafesi, süresi ve çalım sayısı (sonsuz driplingi engellemek için)
  private currentCarrierId: string | null = null;
  private currentCarrierDistance = 0;
  private currentCarrierDribblesCount = 0;
  private currentCarrierDurationSec = 0;
  private consecutiveCarriesCount = 0;

  constructor(
    homeCards: PlayerCard[],
    awayCards: PlayerCard[],
    homeTactics: ManagerTactics,
    awayTactics: ManagerTactics,
    homeManager: ManagerBudgetState,
    awayManager: ManagerBudgetState,
    config: MatchEngineConfig = {}
  ) {
    this.config = {
      seed: config.seed ?? 20261016,
      fixedStepSec: config.fixedStepSec ?? 0.05,
      timeMultiplierNormal: config.timeMultiplierNormal ?? 22,
      timeMultiplierDanger: config.timeMultiplierDanger ?? 6
    };

    this.rng = new SeededRandom(this.config.seed);
    this.runner = new MatchRunner(this.config.fixedStepSec);
    this.homeCards = [...homeCards];
    this.awayCards = [...awayCards];

    const homeMentality: MentalityType = homeTactics.mentality || 'balanced';
    const awayMentality: MentalityType = awayTactics.mentality || 'balanced';

    this.homeTeam = {
      index: 0,
      manager: homeManager,
      tactics: { ...homeTactics, mentality: homeMentality },
      synergy: calculateTeamSynergy(homeTactics, homeCards),
      mentality: homeMentality,
      style: computeTeamStyle(homeTactics, homeMentality),
      plan: null,
      attackDirection: 1, // 1. yarıda soldan sağa (x = 100'e hücum)
      goals: 0,
      shots: 0,
      shotsOnTarget: 0,
      saves: 0,
      passesCompleted: 0,
      passesAttempted: 0,
      fouls: 0,
      xg: 0
    };

    this.awayTeam = {
      index: 1,
      manager: awayManager,
      tactics: { ...awayTactics, mentality: awayMentality },
      synergy: calculateTeamSynergy(awayTactics, awayCards),
      mentality: awayMentality,
      style: computeTeamStyle(awayTactics, awayMentality),
      plan: null,
      attackDirection: -1, // 1. yarıda sağdan sola (x = 0'a hücum)
      goals: 0,
      shots: 0,
      shotsOnTarget: 0,
      saves: 0,
      passesCompleted: 0,
      passesAttempted: 0,
      fouls: 0,
      xg: 0
    };

    this.clock = {
      matchSecond: 0,
      simulationSecond: 0,
      simulationStep: 0,
      half: 1,
      isStoppageTime: false
    };

    this.ballSystem = new BallSystem(0);
    this.eventLog = new MatchEventLog();
    this.possessionTracker = new PossessionTracker();
    this.analytics = new MatchAnalytics(this.eventLog, this.possessionTracker);

    this.initPlayers();
    this.setupKickoff(0);
  }

  /**
   * 22 Oyuncunun formasyon koordinatlarını ve efektif reytinglerini (effStats / effOvr) hesaplayarak sahaya yerleştirir.
   */
  private initPlayers() {
    this.players = [];
    this.buildTeamPlayers(this.homeTeam, this.homeCards);
    this.buildTeamPlayers(this.awayTeam, this.awayCards);
  }

  private buildTeamPlayers(team: EngineTeamRuntime, cards: PlayerCard[]) {
    const slots = getFormationSlots(team.tactics.formation);
    const cardMap = new Map<string, PlayerCard>();
    cards.forEach((c) => cardMap.set(c.id, c));

    for (let i = 0; i < 11; i++) {
      const slot = slots[i] || { slotIndex: i, role: 'CM', requiredPosition: 'MID', x: 50, y: 50 };
      const cardId = team.tactics.lineup[slot.slotIndex];
      const card = (cardId ? cardMap.get(cardId) : null) || cards[i] || this.createFallbackCard(slot.requiredPosition, i);

      const anchor = PositioningSystem.calculateAnchorPosition(slot, team.attackDirection);
      const roleGroup = getRoleGroup(slot.role);
      const { effStats, effOvr } = this.computeEffectiveRatings(card, slot.requiredPosition, slot.role, team);

      this.players.push({
        id: card.id,
        cardId: card.id,
        slotIndex: slot.slotIndex,
        role: slot.role,
        roleGroup,
        name: card.name,
        shortName: card.shortName || card.name.split(' ').pop() || card.name,
        number: slot.requiredPosition === 'GK' ? 1 : i + 1,
        position: slot.requiredPosition,
        teamIndex: team.index,
        baseX: anchor.x,
        baseY: anchor.y,
        x: anchor.x,
        y: anchor.y,
        targetX: anchor.x,
        targetY: anchor.y,
        stamina: 100,
        rating: 6.7 + this.rng.range(0.0, 0.35),
        goals: 0,
        assists: 0,
        action: 'IDLE',
        photoUrl: card.photoUrl,
        ovr: card.ovr,
        effOvr,
        stats: { ...card.stats },
        effStats,
        card: { ...card },
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        heading: team.attackDirection === 1 ? 0 : Math.PI,
        maxSpeed: 13.5,
        maxAcceleration: 28.0,
        urgency: 0.75,
        tackleCooldownSec: 0,
        noClaimUntil: 0,
        stunSec: 0,
        thinkTimerSec: 0,
        attackDirection: team.attackDirection
      });
    }
  }

  /**
   * Oyuncunun OVR ve alt niteliklerini (pac, sho, pas, dri, def, phy) mevki uyumu ve takım sinerjisiyle ölçekler.
   * Böylece yıldız oyuncular (88-94 OVR) kendi mevkilerinde oynadığında hız, pas vizyonu, çalım ve bitiricilikte belirgin fark yaratır.
   */
  private computeEffectiveRatings(
    card: PlayerCard,
    requiredPosition: CardPosition,
    slotRole: string,
    team: EngineTeamRuntime
  ): { effStats: PlayerCard['stats']; effOvr: number } {
    let posFactor = 1.0;
    if (card.position === requiredPosition) {
      posFactor = 1.0;
      if (card.specificRole === slotRole) {
        posFactor = 1.02;
      }
    } else if (card.position === 'GK' || requiredPosition === 'GK') {
      posFactor = 0.62;
    } else {
      // Yakın roller arası geçiş (örn: LW -> LM, RW -> RM, CAM -> CM) daha az ceza alır
      const isCompatibleFlank =
        (card.specificRole === 'LW' && slotRole === 'LM') ||
        (card.specificRole === 'RW' && slotRole === 'RM') ||
        (card.specificRole === 'LM' && slotRole === 'LW') ||
        (card.specificRole === 'RM' && slotRole === 'RW');
      posFactor = isCompatibleFlank ? 0.97 : 0.93;
    }

    const synergyBoost = clamp((team.synergy.overall - 76) * 0.12, -2.5, 3.5);
    const ovrBoost = (card.ovr - 80) * 0.14; // Yüksek OVR'li oyunculara ekstra kalite çarpanı

    const scaleStat = (val: number) =>
      Math.round(clamp((val + ovrBoost) * posFactor + synergyBoost, 48, 99));

    return {
      effOvr: Math.round(clamp(card.ovr * posFactor + synergyBoost, 50, 99)),
      effStats: {
        pac: scaleStat(card.stats.pac),
        sho: scaleStat(card.stats.sho),
        pas: scaleStat(card.stats.pas),
        dri: scaleStat(card.stats.dri),
        def: scaleStat(card.stats.def),
        phy: scaleStat(card.stats.phy)
      }
    };
  }

  private refreshTeamEffectiveRatings(team: EngineTeamRuntime) {
    team.style = computeTeamStyle(team.tactics, team.mentality, team.activeShout?.shout);
    const slots = getFormationSlots(team.tactics.formation);
    for (const p of this.players) {
      if (p.teamIndex !== team.index) continue;
      const slot = slots[p.slotIndex] || { slotIndex: p.slotIndex, role: p.role, requiredPosition: p.position, x: 50, y: 50 };
      p.role = slot.role;
      p.roleGroup = getRoleGroup(slot.role);
      const { effStats, effOvr } = this.computeEffectiveRatings(p.card, slot.requiredPosition, slot.role, team);
      p.effStats = effStats;
      p.effOvr = effOvr;
    }
  }

  private createFallbackCard(pos: CardPosition, idx: number): PlayerCard {
    return {
      id: `fallback-${pos}-${idx}`,
      name: `${pos} Oyuncusu ${idx + 1}`,
      shortName: `${pos} ${idx + 1}`,
      position: pos,
      specificRole: pos,
      category: 'active',
      nationality: 'Türkiye',
      countryFlag: '🇹🇷',
      club: 'Akademi',
      ovr: 78,
      startingPrice: 1,
      stats: { pac: 75, sho: 72, pas: 75, dri: 74, def: 72, phy: 74 },
      accentColor: '#38bdf8'
    };
  }

  public updateLiveTactics(
    teamIdx: 0 | 1,
    update: { mentality?: MentalityType; playstyle?: PlaystyleType; defensiveLine?: DefensiveLineType }
  ) {
    const team = teamIdx === 0 ? this.homeTeam : this.awayTeam;
    if (update.mentality) {
      team.mentality = update.mentality;
      team.tactics.mentality = update.mentality;
    }
    if (update.playstyle) team.tactics.playstyle = update.playstyle;
    if (update.defensiveLine) team.tactics.defensiveLine = update.defensiveLine;

    const cards = teamIdx === 0 ? this.homeCards : this.awayCards;
    team.synergy = calculateTeamSynergy(team.tactics, cards);
    team.style = computeTeamStyle(team.tactics, team.mentality, team.activeShout?.shout);
    team.plan = null; // Yeni taktiksel anlayışa uygun hücum planı hemen devreye girsin
    this.refreshTeamEffectiveRatings(team);

    this.eventLog.logEvent({
      type: 'SHOUT',
      teamIndex: teamIdx,
      matchSecond: Math.floor(this.clock.matchSecond),
      commentary: `📋 ${team.manager.nickname} taktik değiştirdi: [${describeMentality(team.mentality)} • ${team.tactics.playstyle.toUpperCase()}]`
    });
  }

  public triggerTouchlineShout(teamIdx: 0 | 1, shout: TouchlineShoutType) {
    const team = teamIdx === 0 ? this.homeTeam : this.awayTeam;
    const shoutTexts: Record<TouchlineShoutType, string> = {
      push_forward: '🔥 Takım öne çıkıyor! Bütün hatlarla baskı!',
      tighten_up: '🛡️ Savunma hattı kapandı! Disiplini elden bırakmayın!',
      play_creative: '🎯 Yaratıcı oynayın! Hücumda risk alın!',
      demand_more: '⚡ Daha fazla enerji! Mücadeleyi bırakmayın!'
    };

    team.activeShout = {
      shout,
      text: shoutTexts[shout] || 'Talimat verildi',
      expiresAtSec: this.clock.matchSecond + 180
    };
    team.style = computeTeamStyle(team.tactics, team.mentality, team.activeShout.shout);

    this.eventLog.logEvent({
      type: 'SHOUT',
      teamIndex: teamIdx,
      matchSecond: Math.floor(this.clock.matchSecond),
      commentary: `📣 ${team.manager.nickname}: "${team.activeShout.text}"`
    });
  }

  /**
   * İkinci yarı başlangıcı: Takımlar kurallara göre hücum yönlerini karşılıklı değiştirir.
   */
  public startSecondHalf() {
    this.clock.half = 2;
    this.clock.matchSecond = 2700;

    this.homeTeam.attackDirection = -1;
    this.awayTeam.attackDirection = 1;
    this.homeTeam.style = computeTeamStyle(this.homeTeam.tactics, this.homeTeam.mentality, this.homeTeam.activeShout?.shout);
    this.awayTeam.style = computeTeamStyle(this.awayTeam.tactics, this.awayTeam.mentality, this.awayTeam.activeShout?.shout);
    this.homeTeam.plan = null;
    this.awayTeam.plan = null;

    for (const p of this.players) {
      const team = p.teamIndex === 0 ? this.homeTeam : this.awayTeam;
      p.attackDirection = team.attackDirection;
      const slots = getFormationSlots(team.tactics.formation);
      const slot = slots[p.slotIndex] || { slotIndex: p.slotIndex, role: p.role, requiredPosition: p.position, x: 50, y: 50 };
      const newAnchor = PositioningSystem.calculateAnchorPosition(slot, team.attackDirection);
      p.baseX = newAnchor.x;
      p.baseY = newAnchor.y;
      p.role = slot.role;
      p.roleGroup = getRoleGroup(slot.role);
    }

    this.refreshTeamEffectiveRatings(this.homeTeam);
    this.refreshTeamEffectiveRatings(this.awayTeam);

    this.setupKickoff(1);
    this.eventLog.logEvent({
      type: 'RESTART',
      teamIndex: -1,
      matchSecond: 2700,
      commentary: 'Hakem 2. yarıyı başlatan düdüğü çaldı! Takımlar sahaları değiştirdi.'
    });
  }

  private setupKickoff(startingTeam: 0 | 1) {
    this.playPhase = 'KICK_OFF';
    this.phaseTimer = 1.8;
    const restart = RestartSystem.createKickOffRestart(startingTeam, this.players, this.clock.half);
    this.ballSystem.setRestart(restart);
    this.lastPossessionTeam = startingTeam;
    this.secondsSincePossessionChange = 0;
  }

  public step(deltaRealSec: number) {
    if (this.isMatchFinished) return;
    this.runner.advance(deltaRealSec, this);
  }

  /**
   * Deterministik Sabit Zaman Adımı (Fixed Step: 0.05s / 20Hz)
   */
  public stepFixed(dt: number) {
    if (this.isMatchFinished) return;

    this.clock.simulationStep++;
    this.clock.simulationSecond += dt;

    const isDangerous =
      this.playPhase === 'BOX_DANGER' ||
      this.playPhase === 'SHOT_ON_GOAL' ||
      this.playPhase === 'GOAL_CELEBRATION' ||
      this.playPhase === 'SET_PIECE_CORNER';

    const timeMult = isDangerous ? (this.config.timeMultiplierDanger ?? 6) : (this.config.timeMultiplierNormal ?? 26);
    this.clock.matchSecond += dt * timeMult;

    if (this.clock.half === 1 && this.clock.matchSecond >= 2700) {
      this.clock.matchSecond = 2700;
      return;
    }
    if (this.clock.half === 2 && this.clock.matchSecond >= 5400) {
      this.clock.matchSecond = 5400;
      this.isMatchFinished = true;
      this.eventLog.logEvent({
        type: 'RESTART',
        teamIndex: -1,
        matchSecond: 5400,
        commentary: `Maç sona erdi! Final skoru: ${this.homeTeam.manager.nickname} ${this.homeTeam.goals} - ${this.awayTeam.goals} ${this.awayTeam.manager.nickname}`
      });
      return;
    }

    // Kenar Talimatı Süre Kontrolü
    if (this.homeTeam.activeShout && this.clock.matchSecond >= this.homeTeam.activeShout.expiresAtSec) {
      this.homeTeam.activeShout = undefined;
      this.homeTeam.style = computeTeamStyle(this.homeTeam.tactics, this.homeTeam.mentality);
    }
    if (this.awayTeam.activeShout && this.clock.matchSecond >= this.awayTeam.activeShout.expiresAtSec) {
      this.awayTeam.activeShout = undefined;
      this.awayTeam.style = computeTeamStyle(this.awayTeam.tactics, this.awayTeam.mentality);
    }

    if (this.phaseTimer > 0) {
      this.phaseTimer -= dt;
    }

    // Top sahipliği değişim sayacı
    const currentPoss = this.ballSystem.getPossessionTeam();
    if (currentPoss !== this.lastPossessionTeam) {
      this.lastPossessionTeam = currentPoss;
      this.secondsSincePossessionChange = 0;
      this.homeTeam.plan = null;
      this.awayTeam.plan = null;
    } else {
      this.secondsSincePossessionChange += dt;
    }

    // 1. FİZİKSEL TOP SİSTEMİ GÜNCELLEMESİ
    this.ballSystem.updatePhysics(
      dt,
      this.players,
      (pass, receiver) => this.onPassArrived(pass, receiver),
      (shot) => this.onShotArrived(shot),
      this.clock.simulationSecond,
      (spot, lastTouchTeam) => this.handleBallOutOfBounds(spot, lastTouchTeam)
    );

    // 1.1 Uçuş halindeki paslarda savunmacıların fiziksel pas arası (interception) kontrolü
    const ballStateAfterPhysics = this.ballSystem.getState();
    if (ballStateAfterPhysics.mode === 'IN_FLIGHT_PASS' && ballStateAfterPhysics.pass.elapsedSec > 0.12) {
      this.checkInFlightPassInterception(ballStateAfterPhysics.pass, ballStateAfterPhysics.position, ballStateAfterPhysics.height);
    }

    // 2. TAKTİKSEL DİZİLİŞ, BÖLGE KORUMA, KOŞU VE PRES SİSTEMİ
    this.updateTacticalShapeAndPress(dt);

    // 3. OYUNCU HAREKETLERİ & HIZ VEKTÖRÜ FİZİĞİ
    MovementSystem.updateMovement(
      this.players,
      [this.homeTeam, this.awayTeam],
      this.ballSystem.getPossessionTeam(),
      dt
    );

    // 4. DURUM MAKİNESİ (Yalnızca top kontrol altındayken veya duran top zamanlayıcısı çalışırken!)
    // Top LOOSE veya IN_FLIGHT iken sahte taşıyıcı üzerinden pas başlatılmasını kesin olarak engeller.
    const ballMode = this.ballSystem.getState().mode;
    if (ballMode === 'CONTROLLED' || ballMode === 'RESTART' || this.playPhase === 'GOAL_CELEBRATION') {
      this.stepStateMachine(dt);
    }

    // 5. TOPA SAHİP OLMA & MOMENTUM
    const isBallActive =
      this.playPhase !== 'GOAL_CELEBRATION' &&
      this.playPhase !== 'FREE_KICK_OFFSIDE' &&
      this.playPhase !== 'FREE_KICK' &&
      this.playPhase !== 'THROW_IN' &&
      this.playPhase !== 'SET_PIECE_CORNER' &&
      this.playPhase !== 'GOAL_KICK';
    this.possessionTracker.advance(dt * timeMult, this.ballSystem.getPossessionTeam(), isBallActive);
    this.updateMomentum();
  }

  private checkInFlightPassInterception(pass: PassContext, ballPos: Vec2, ballHeight: number) {
    const defTeamIdx = (1 - pass.attackingTeam) as 0 | 1;
    const defenders = this.players.filter((p) => p.teamIndex === defTeamIdx && p.roleGroup !== 'GK');
    for (const def of defenders) {
      if (DuelSystem.canInterceptPassInFlight(def, ballPos, ballHeight, this.rng)) {
        def.rating = Math.min(10.0, def.rating + 0.15);
        this.interceptBall(
          defTeamIdx,
          `⚡ ${def.shortName} pas açısını harika okudu ve araya girerek topu kesti!`,
          def
        );
        return;
      }
    }
  }

  private updateTacticalShapeAndPress(dt: number) {
    const ballState = this.ballSystem.getState();
    const ballPos = this.ballSystem.getPosition();
    const ballVel = this.ballSystem.getVelocity();
    const possessionTeam = this.ballSystem.getPossessionTeam();
    const carrierId = this.ballSystem.getCarrierId();
    if (carrierId !== this.currentCarrierId) {
      this.currentCarrierId = carrierId;
      this.currentCarrierDistance = 0;
      this.currentCarrierDribblesCount = 0;
      this.currentCarrierDurationSec = 0;
      this.consecutiveCarriesCount = 0;
    }
    const carrier = carrierId ? (this.players.find((p) => p.id === carrierId) || null) : null;

    const attTeam = possessionTeam === 0 ? this.homeTeam : this.awayTeam;
    const defTeam = possessionTeam === 0 ? this.awayTeam : this.homeTeam;

    // Hücum eden takımın taktiksel hücum planını seç veya güncelle
    if (
      carrier &&
      carrier.roleGroup !== 'GK' &&
      (!attTeam.plan || this.clock.simulationSecond >= attTeam.plan.expiresSec)
    ) {
      const startOwnP = toOwn(carrier.x, attTeam.attackDirection);
      attTeam.plan = chooseAttackPlan(
        attTeam,
        {
          startOwnP,
          startY: carrier.y,
          wonBallInMidfield: startOwnP >= 34 && startOwnP <= 72 && this.secondsSincePossessionChange < 2.5,
          isRestartOrKeeper: this.playPhase === 'KICK_OFF' || this.playPhase === 'GOAL_KICK'
        },
        this.rng,
        this.clock.simulationSecond
      );
    }

    // Motorun o an doğrudan yönettiği oyuncular (taşıyıcı, uçan pas alıcısı ve şuta uzanan kaleci)
    const locked = new Set<string>();
    if (carrier) locked.add(carrier.id);
    if (ballState.mode === 'IN_FLIGHT_PASS') {
      locked.add(ballState.pass.receiverId);
    }
    if (ballState.mode === 'IN_FLIGHT_SHOT') {
      const defTeamIdx = (1 - ballState.shot.attackingTeam) as 0 | 1;
      const defGk = this.players.find((p) => p.teamIndex === defTeamIdx && p.roleGroup === 'GK');
      if (defGk) {
        locked.add(defGk.id);
        this.updateGoalkeeperDive(defGk, ballState.shot, dt);
      }
    }

    // Taşıyıcı dripling ilerlemesi: Önündeki boş koridora doğru akıcı top sürme
    if (carrier && carrier.action === 'CARRY' && this.playPhase !== 'KICK_OFF' && this.playPhase !== 'GOAL_KICK') {
      this.advanceCarrierDribble(carrier, attTeam, defTeam, dt);
    }

    // PositioningSystem: 22 oyuncunun kendi mevki sınırları içinde taktiksel hedeflerini hesaplar
    PositioningSystem.update({
      players: this.players,
      teams: [this.homeTeam, this.awayTeam],
      ball: ballPos,
      ballVel,
      ballMode: ballState.mode,
      possessionTeam,
      carrier,
      passFlight:
        ballState.mode === 'IN_FLIGHT_PASS'
          ? {
              receiverId: ballState.pass.receiverId,
              target: ballState.pass.target,
              origin: ballState.pass.origin,
              attackingTeam: ballState.pass.attackingTeam,
              passType: ballState.pass.passType
            }
          : null,
      restart: ballState.mode === 'RESTART' ? ballState.restart : null,
      simSec: this.clock.simulationSecond,
      locked,
      secondsSincePossessionChange: this.secondsSincePossessionChange
    });
  }

  /**
   * Şut çekildiğinde kalecinin şutun varış noktasına doğru dinamik uzanması / uçuşu.
   * Kalecinin yerinde sabit kalmasını ve topun kaleciye ışınlanmasını engeller.
   */
  private updateGoalkeeperDive(gk: EnginePlayerRuntime, shot: ShotContext, dt: number) {
    const eff = gk.effStats || gk.stats;
    const dir = gk.teamIndex === 0 ? this.homeTeam.attackDirection : this.awayTeam.attackDirection;
    const goalX = fromOwn(4.5, dir);

    gk.action = 'GK_DIVE';
    gk.urgency = 1.0;

    // Şutun hedeflendiği Y koordinatına doğru kalecinin dinamik uzanması
    const shotTargetY = clamp(shot.targetPosition.y, 28.5, 35.5);
    gk.targetX = goalX;
    gk.targetY = shotTargetY;

    // Kaleci refleks ve uzanma hızına göre şut hedefine doğru uçar
    const diveLateralSpeed = 8.8 + (eff.dri - 70) * 0.10 + (eff.phy - 70) * 0.08;
    const dy = shotTargetY - gk.y;
    if (Math.abs(dy) > 0.08) {
      const moveStep = Math.sign(dy) * Math.min(Math.abs(dy), diveLateralSpeed * dt);
      gk.y = clamp(gk.y + moveStep, 28.0, 36.0);
      gk.heading = dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    gk.x = goalX;
  }

  /**
   * Top taşıyıcı oyuncunun kendi mevkisine, hızına/dripling yeteneğine ve önündeki boşluğa göre top sürmesini sağlar.
   * Dümdüz koşuyu engeller; çapraz kat etme, slalom feintler ve savunmacının etrafından kavisli geçiş uygular.
   * Tekil mesafe limitini aşınca top sürmeyi bitirir.
   */
  private advanceCarrierDribble(
    carrier: EnginePlayerRuntime,
    attTeam: EngineTeamRuntime,
    defTeam: EngineTeamRuntime,
    dt: number
  ) {
    if (carrier.roleGroup === 'GK') {
      // Kaleci topla ceza sahası dışına çıkmaz
      const gkP = clamp(toOwn(carrier.x, attTeam.attackDirection) + 1.5 * dt, 4.5, 13.5);
      carrier.targetX = fromOwn(gkP, attTeam.attackDirection);
      carrier.targetY = clamp(carrier.y, 24.0, 40.0);
      return;
    }

    const dir = attTeam.attackDirection;
    const eff = carrier.effStats || carrier.stats;
    const carrierP = toOwn(carrier.x, dir);

    // Taşıyıcının bu pozisyondaki koştuğu mesafeyi ve süreyi güncelle
    const stepDist = Math.hypot(carrier.vx, carrier.vy) * dt;
    this.currentCarrierDistance += stepDist;
    this.currentCarrierDurationSec += dt;

    // Rol grubuna göre maksimum tekil dripling menzili (orta sahadan kaleye tek başına gidişi engeller)
    const maxCarryDist =
      carrier.roleGroup === 'CB'
        ? 7.0
        : carrier.roleGroup === 'DM' || carrier.roleGroup === 'CM'
          ? 11.0
          : carrier.roleGroup === 'AM' || carrier.roleGroup === 'ST'
            ? 15.0
            : 19.0;

    // Tekil taşıma menzili veya 2.0 saniye dolduğunda top sürme burst'ü biter, pas/şut değerlendirilir
    if (this.currentCarrierDistance >= maxCarryDist || this.currentCarrierDurationSec >= 2.0) {
      carrier.action = 'IDLE';
      this.phaseTimer = 0.04;
      return;
    }

    // Savunma baskısı altındaki taşıyıcı için top kaybı riski (yorgunluk ve dripling eksikliği)
    const defenders = this.players.filter((p) => p.teamIndex === defTeam.index && p.roleGroup !== 'GK');
    const closeOpp = defenders.find((d) => dist(d.x, d.y, carrier.x, carrier.y) < 2.2);
    if (closeOpp && carrierP > 35) {
      const fatigueFactor = Math.min(0.08, (this.currentCarrierDistance / 15.0) * 0.06);
      const baseTurnover = eff.dri < 76 ? (76 - eff.dri) * 0.012 : 0.025;
      if (this.rng.chance((baseTurnover + fatigueFactor) * dt * 4.0)) {
        carrier.stunSec = 0.35;
        this.interceptBall(defTeam.index, `🛡️ ${closeOpp.shortName}, topla fazla oynayan ${carrier.shortName}'dan topu söktü aldı!`, closeOpp);
        return;
      }
    }

    // Rol grubuna göre maksimum dripling tavanı
    const maxDribbleP =
      carrier.roleGroup === 'CB'
        ? 42
        : carrier.roleGroup === 'DM'
          ? 64
          : carrier.roleGroup === 'FB' || carrier.roleGroup === 'WB' || carrier.roleGroup === 'WM'
            ? 88
            : 94;

    if (carrierP >= maxDribbleP) {
      carrier.action = 'IDLE';
      this.phaseTimer = 0.04;
      return;
    }

    // Rakip kaleye veya kanat koridoruna doğru dinamik ve ÇAPRAZ yönelim (dümdüz koşuyu engeller)
    let desiredY = carrier.y;
    const isWide = carrier.y < 22 || carrier.y > 42;

    if (carrier.roleGroup === 'W' || carrier.roleGroup === 'AM') {
      if (isWide && carrierP > 52) {
        // Kanattan ceza sahasına çapraz kat etme (Cut-Inside: Robben / Vinicius / Salah tarzı)
        const targetHalfSpaceY = carrier.y < 32 ? 26.0 : 38.0;
        desiredY = carrier.y + (targetHalfSpaceY - carrier.y) * 0.38 * dt * 3.2;
      } else {
        // Merkezde savunma arasına çapraz koridor sürüşü
        const seamY = carrier.y < 32 ? 28.0 : 36.0;
        desiredY = carrier.y + (seamY - carrier.y) * 0.25 * dt * 2.2;
      }
    } else if (carrier.roleGroup === 'FB' || carrier.roleGroup === 'WB') {
      // Bekler çizgiyi kullanarak kanada doğru çapraz bindirir
      const flankY = carrier.baseY < 32 ? 8.5 : 55.5;
      desiredY = carrier.y + (flankY - carrier.y) * 0.30 * dt * 2.6;
    } else if (carrier.roleGroup === 'ST') {
      // Forvet kale direklerine / ceza sahası köşelerine doğru çapraz dalar
      const channelY = carrier.y < 32 ? 27.0 : 37.0;
      desiredY = carrier.y + (channelY - carrier.y) * 0.35 * dt * 2.8;
    }

    // Doğal vücut çalımı ve sağa-sola zikzak mikro salınım (Slalom)
    const jinkPeriod = 4.2;
    const jinkAmp = eff.dri >= 82 ? 1.4 : 0.8;
    const jinkOffset = Math.sin(this.clock.simulationSecond * jinkPeriod + carrier.slotIndex) * jinkAmp;
    desiredY += jinkOffset;

    // Önündeki savunmacıdan akıllı çapraz kaçınma (Slalom çalım açısı)
    for (const d of defenders) {
      const forwardDist = (d.x - carrier.x) * dir;
      const lateralDist = Math.abs(d.y - carrier.y);
      if (forwardDist > 0.5 && forwardDist < 5.0 && lateralDist < 3.8) {
        const evadeSign = carrier.y >= d.y ? 1 : -1;
        desiredY += evadeSign * 3.2 * dt * 4.0;
      }
    }

    // Hedef nokta: Dinamik 4.5 - 5.5 metre önü hedef alarak akıcı kıvrımlar oluştur (dümdüz koşuyu engeller)
    const forwardStep = Math.min(maxDribbleP - carrierP, 4.8 + (eff.pac - 70) * 0.03);
    const forwardRunwayP = carrierP + forwardStep;
    carrier.targetX = fromOwn(forwardRunwayP, dir);
    carrier.targetY = clamp(desiredY, 3.5, 60.5);
    carrier.urgency = 0.95;
  }

  private stepStateMachine(dt: number) {
    void dt;
    switch (this.playPhase) {
      case 'KICK_OFF':
        if (this.phaseTimer <= 0) {
          this.executeKickoffPass();
        }
        break;

      case 'SET_PIECE_CORNER':
        if (this.phaseTimer <= 0) {
          this.executeCornerKick();
        }
        break;

      case 'FREE_KICK_OFFSIDE':
      case 'FREE_KICK':
        if (this.phaseTimer <= 0) {
          this.executeFreeKick();
        }
        break;

      case 'GOAL_KICK':
        if (this.phaseTimer <= 0) {
          this.executeGoalKick();
        }
        break;

      case 'THROW_IN':
        if (this.phaseTimer <= 0) {
          this.executeThrowIn();
        }
        break;

      case 'GOAL_CELEBRATION':
        if (this.phaseTimer <= 0) {
          this.setupKickoff(this.ballSystem.getPossessionTeam());
        }
        break;

      case 'BUILD_UP':
      case 'MIDFIELD_BATTLE':
      case 'WING_ATTACK':
      case 'THROUGH_BALL':
      case 'COUNTER_ATTACK':
      case 'BOX_DANGER':
        if (this.phaseTimer <= 0) {
          this.resolveOpenPlayDecision();
        }
        break;
    }
  }

  /**
   * Açık oyunda (BUILD_UP, MIDFIELD_BATTLE, WING_ATTACK, THROUGH_BALL, COUNTER_ATTACK, BOX_DANGER)
   * top taşıyıcının gerçek zamanlı karar mekanizması.
   * Yalnızca gerçek bir top taşıyıcı (carrier) varsa çalışır!
   */
  private resolveOpenPlayDecision() {
    const carrierId = this.ballSystem.getCarrierId();
    if (!carrierId) return;

    const carrier = this.players.find((p) => p.id === carrierId);
    if (!carrier) return;

    const attTeamIdx = carrier.teamIndex;
    const currentTeam = attTeamIdx === 0 ? this.homeTeam : this.awayTeam;
    const defTeam = attTeamIdx === 0 ? this.awayTeam : this.homeTeam;
    const dir = currentTeam.attackDirection;
    const teammates = this.players.filter((p) => p.teamIndex === attTeamIdx && p.id !== carrier.id);
    const opponents = this.players.filter((p) => p.teamIndex === defTeam.index);

    const carrierOwnP = toOwn(carrier.x, dir);
    const oppGoalX = dir === 1 ? 97.5 : 2.5;
    const distToGoal = Math.abs(carrier.x - oppGoalX);
    const eff = carrier.effStats || carrier.stats;

    // 1. KALECİ AÇIK OYUNDA TOPLA BULUŞTUYSA: Asla ışınlama yapmadan güvenli kurulum pası ver
    if (carrier.roleGroup === 'GK') {
      const { target, passType } = PassingSystem.selectBestPassTarget(
        carrier,
        teammates,
        opponents,
        currentTeam,
        this.rng,
        this.lastCompletedPass?.passerId
      );
      this.startPass(carrier, target, passType);
      this.playPhase = 'BUILD_UP';
      this.phaseTimer = 0.5;
      return;
    }

    // 2. FİZİKSEL İKİLİ MÜCADELE (Yakında ve hamle süresi dolmuş savunmacı varsa)
    const activeTacklers = opponents
      .filter(
        (o) =>
          o.roleGroup !== 'GK' &&
          (o.stunSec ?? 0) <= 0 &&
          (o.tackleCooldownSec ?? 0) <= 0 &&
          dist(o.x, o.y, carrier.x, carrier.y) <= 3.15
      )
      .sort((a, b) => dist(a.x, a.y, carrier.x, carrier.y) - dist(b.x, b.y, carrier.x, carrier.y));

    if (activeTacklers.length > 0) {
      const tackler = activeTacklers[0];
      const duelRes = DuelSystem.resolveTackle(
        tackler,
        carrier,
        this.rng,
        this.clock.simulationSecond,
        this.currentCarrierDribblesCount
      );
      if (duelRes.isFoul) {
        defTeam.fouls++;
        this.triggerFoulFreeKick(attTeamIdx, { x: carrier.x, y: carrier.y }, duelRes.commentary);
        return;
      }
      if (duelRes.intercepted) {
        this.interceptBall(defTeam.index, duelRes.commentary, tackler);
        return;
      }
      // Çalım başarılı! Savunmacıyı geçen oyuncu ivmeyle ceza sahasına/rakip kaleye doğru topla akar
      this.currentCarrierDribblesCount++;
      carrier.action = 'CARRY';
      carrier.urgency = 0.88;
      this.playPhase = carrierOwnP >= 68 ? 'BOX_DANGER' : 'MIDFIELD_BATTLE';
      this.phaseTimer = 0.36;
      if (carrierOwnP > 55) {
        this.eventLog.logEvent({
          type: 'PASS_ATTEMPTED',
          teamIndex: attTeamIdx,
          matchSecond: Math.floor(this.clock.matchSecond),
          playerId: carrier.id,
          playerName: carrier.shortName,
          commentary: duelRes.commentary
        });
      }
      return;
    }

    // En yakın savunmacı mesafesi
    const nearestOppDist = opponents.reduce(
      (min, o) => (o.roleGroup === 'GK' ? min : Math.min(min, dist(o.x, o.y, carrier.x, carrier.y))),
      999.0
    );

    // Taşıyıcının tekil sürüş menzilini ve süresini kontrol et (orta sahadan kaleye tek başına koşuyu engeller)
    const maxCarryDist =
      carrier.roleGroup === 'CB'
        ? 7.0
        : carrier.roleGroup === 'DM' || carrier.roleGroup === 'CM'
          ? 11.0
          : carrier.roleGroup === 'AM' || carrier.roleGroup === 'ST'
            ? 15.0
            : 19.0;

    const hasExceededCarryLimit =
      this.currentCarrierDistance >= maxCarryDist ||
      this.currentCarrierDurationSec >= 2.0 ||
      this.consecutiveCarriesCount >= 2;

    // Önündeki koşu koridorunda (boş alanda) savunmacı var mı kontrol et
    const forwardCorridorDefenders = opponents.filter((o) => {
      if (o.roleGroup === 'GK') return false;
      const forwardDist = (o.x - carrier.x) * dir;
      const lateralDist = Math.abs(o.y - carrier.y);
      return forwardDist > 0.6 && forwardDist < 8.5 && lateralDist < 4.2;
    });
    const isLaneOpen = forwardCorridorDefenders.length === 0;

    // 3. ŞUT FIRSATI DEĞERLENDİRMESİ (Ceza sahası içi, karşı karşıya veya yay çevresinden şut)
    const inBox = carrierOwnP >= 80.5 && carrier.y >= 14.5 && carrier.y <= 49.5;
    const inGoodShootingZone =
      carrierOwnP >= 72.5 &&
      distToGoal <= 24.5 + currentTeam.style.shootRange &&
      Math.abs(carrier.y - 32.0) <= 18.5;

    // Ceza sahası yayında/çevresinde iken acele şut çekmek yerine topla ceza sahasına sokulmayı deneme
    const canDriveIntoBox =
      !inBox &&
      !hasExceededCarryLimit &&
      isLaneOpen &&
      carrierOwnP >= 72.0 &&
      carrierOwnP < 85.5 &&
      (carrier.roleGroup === 'ST' || carrier.roleGroup === 'W' || carrier.roleGroup === 'AM') &&
      nearestOppDist > 2.8 &&
      this.rng.chance(0.24 + (eff.dri - 75) * 0.006);

    if (canDriveIntoBox) {
      this.consecutiveCarriesCount++;
      carrier.action = 'CARRY';
      carrier.urgency = 0.94;
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.36;
      if (this.rng.chance(0.28)) {
        this.eventLog.logEvent({
          type: 'PASS_ATTEMPTED',
          teamIndex: attTeamIdx,
          matchSecond: Math.floor(this.clock.matchSecond),
          playerId: carrier.id,
          playerName: carrier.shortName,
          commentary: `⚡ ${carrier.shortName} topla hızla ceza sahasına sokuluyor!`
        });
      }
      return;
    }

    const shootDesire =
      (inBox ? 0.78 : inGoodShootingZone ? 0.44 : 0.0) +
      (currentTeam.style.shotEagerness - 1.0) * 0.35 +
      (eff.sho - 76) * 0.012 +
      (nearestOppDist > 3.0 ? 0.18 : -0.06);

    if ((inBox || inGoodShootingZone) && (this.playPhase === 'BOX_DANGER' || this.rng.chance(shootDesire))) {
      // Çizgiye çok yakın dar açıdaysa ve içeride daha müsait arkadaşı varsa Cutback (geri çıkarma) tercih et
      const isVeryTightAngle = carrierOwnP > 88 && (carrier.y < 17 || carrier.y > 47);
      const cutbackMate = teammates.find(
        (m) =>
          toOwn(m.x, dir) >= 78 &&
          m.y >= 20 &&
          m.y <= 44 &&
          dist(m.x, m.y, carrier.x, carrier.y) <= 22
      );

      if (isVeryTightAngle && cutbackMate && this.rng.chance(0.72)) {
        cutbackMate.action = 'SPRINT_RUN';
        this.startPass(carrier, cutbackMate, 'SHORT');
        this.playPhase = 'BOX_DANGER';
        this.phaseTimer = 0.32;
        this.eventLog.logEvent({
          type: 'PASS_ATTEMPTED',
          teamIndex: attTeamIdx,
          matchSecond: Math.floor(this.clock.matchSecond),
          commentary: `🔥 ${carrier.shortName} aut çizgisinden penaltı noktasına nefis çıkardı! ${cutbackMate.shortName} bomboş!`
        });
        return;
      }

      this.executeShotAttempt(carrier, currentTeam);
      return;
    }

    // 4. KANATTAN ORTA VEYA YERDEN KESME (Cutback / Cross)
    const isWideInFinalThird = carrierOwnP >= 70 && (carrier.y < 16.5 || carrier.y > 47.5);
    if (isWideInFinalThird) {
      const boxRunners = teammates
        .filter((m) => toOwn(m.x, dir) >= 74 && m.y >= 16 && m.y <= 48)
        .sort((a, b) => (b.effStats.sho + b.effStats.phy) - (a.effStats.sho + a.effStats.phy));

      if (boxRunners.length > 0 && this.rng.chance(0.66 + currentTeam.style.width * 0.15)) {
        const targetRunner = boxRunners[0];
        targetRunner.action = 'SPRINT_RUN';
        const isLowCutback = carrierOwnP >= 84 && dist(carrier.x, carrier.y, targetRunner.x, targetRunner.y) < 18;
        this.startPass(carrier, targetRunner, isLowCutback ? 'THROUGH' : 'CROSS');
        this.playPhase = 'BOX_DANGER';
        this.phaseTimer = 0.45;
        this.eventLog.logEvent({
          type: 'PASS_ATTEMPTED',
          teamIndex: attTeamIdx,
          matchSecond: Math.floor(this.clock.matchSecond),
          commentary: isLowCutback
            ? `⚡ ${carrier.shortName} çizgiye inip yerden sert kesti! ${targetRunner.shortName} kale ağzında!`
            : `🎯 ${carrier.shortName} ceza sahasına adrese teslim bir orta kesti! ${targetRunner.shortName} yükseliyor!`
        });
        return;
      }
    }

    // 5. ÖNÜ BOŞSA DRİPLİNGLE MESAFE KAT ETME (Yalnızca önü gerçekten boşsa ve menzil aşılmamışsa)
    const isForward = carrier.roleGroup === 'ST' || carrier.roleGroup === 'W';
    const isFullback = carrier.roleGroup === 'FB' || carrier.roleGroup === 'WB';
    const isMidfielder = carrier.roleGroup === 'AM' || carrier.roleGroup === 'WM' || carrier.roleGroup === 'CM';

    const maxDriveLimitP = isForward ? 94.0 : isFullback ? 88.0 : isMidfielder ? 80.0 : 65.0;
    const requiredSpace = isForward
      ? (carrierOwnP >= 70 ? 2.4 : 2.8)
      : isFullback
        ? 2.8
        : carrierOwnP >= 66
          ? 3.4
          : 4.0;

    let driveBaseChance: number;
    if (isForward) {
      // Forvetler: önü açıksa ceza sahasına ve kaleye doğru top sürmeyi dener
      driveBaseChance = 0.28 + (eff.dri - 75) * 0.007 + (eff.pac - 75) * 0.005 + currentTeam.style.forwardCommit * 0.08;
    } else if (isFullback) {
      // Bekler: kanatta önü açıldığında bindirip top sürmeyi dener
      driveBaseChance = 0.24 + (eff.dri - 72) * 0.006 + (eff.pac - 72) * 0.005 + currentTeam.style.forwardCommit * 0.06;
    } else if (isMidfielder) {
      driveBaseChance = 0.16 + (eff.dri - 72) * 0.005 + currentTeam.style.forwardCommit * 0.05;
    } else {
      driveBaseChance = 0.08;
    }

    // Zaten 1 kez top sürme burst'ü yaptıysa devam etme şansı ciddi oranda düşer (sonsuz koşuyu engeller)
    if (this.consecutiveCarriesCount >= 1) {
      driveBaseChance *= 0.35;
    }

    const canDriveForward =
      carrier.roleGroup !== 'CB' &&
      carrier.roleGroup !== 'GK' &&
      !hasExceededCarryLimit &&
      isLaneOpen &&
      carrierOwnP < maxDriveLimitP &&
      nearestOppDist > requiredSpace &&
      this.rng.chance(clamp(driveBaseChance, 0.06, 0.52));

    if (canDriveForward) {
      this.consecutiveCarriesCount++;
      carrier.action = 'CARRY';
      carrier.urgency = isForward ? 0.95 : carrierOwnP > 65 ? 0.92 : 0.85;
      this.playPhase =
        carrierOwnP > 68
          ? 'BOX_DANGER'
          : carrier.y < 16 || carrier.y > 48
            ? 'WING_ATTACK'
            : this.secondsSincePossessionChange < 4.0 && currentTeam.style.tempo > 1.05
              ? 'COUNTER_ATTACK'
              : 'MIDFIELD_BATTLE';
      this.phaseTimer = isForward || isFullback ? 0.34 : 0.40;
      return;
    }

    // 6. TAKTİKSEL PAS SEÇİMİ (Ara pası, verkaç, kanat bindirmesi, diyagonal oyun yönü değişimi)
    const { target, passType } = PassingSystem.selectBestPassTarget(
      carrier,
      teammates,
      opponents,
      currentTeam,
      this.rng,
      this.lastCompletedPass?.passerId
    );

    this.startPass(carrier, target, passType);

    const targetOwnP = toOwn(target.x, dir);
    if (passType === 'THROUGH' && targetOwnP >= 64) {
      this.playPhase = 'THROUGH_BALL';
      this.phaseTimer = 0.28;
      if ((eff.pas >= 84 || currentTeam.plan?.kind === 'HALF_SPACE' || currentTeam.plan?.kind === 'COUNTER_BREAK') && targetOwnP >= 72) {
        this.eventLog.logEvent({
          type: 'PASS_ATTEMPTED',
          teamIndex: attTeamIdx,
          matchSecond: Math.floor(this.clock.matchSecond),
          commentary: `✨ ${carrier.shortName} savunmanın arkasına harika bir kilit pas bıraktı! ${target.shortName} hareketlendi!`
        });
      }
    } else if (passType === 'CROSS') {
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.30;
    } else if (targetOwnP >= 74 && target.y >= 15 && target.y <= 49) {
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.24;
    } else if (target.y < 16 || target.y > 48 || isFlankPlayer(getRoleProfile(target.role))) {
      this.playPhase = 'WING_ATTACK';
      this.phaseTimer = 0.28;
    } else if (targetOwnP >= 42) {
      this.playPhase = 'MIDFIELD_BATTLE';
      this.phaseTimer = 0.28;
    } else {
      this.playPhase = 'BUILD_UP';
      this.phaseTimer = 0.30;
    }
  }

  private executeShotAttempt(shooter: EnginePlayerRuntime, currentTeam: EngineTeamRuntime) {
    const attTeamIdx = shooter.teamIndex;
    const defTeamIdx = (1 - attTeamIdx) as 0 | 1;
    const defPlayers = this.players.filter((p) => p.teamIndex === defTeamIdx);
    const dir = currentTeam.attackDirection;
    const shooterOwnP = toOwn(shooter.x, dir);

    let shotType: ShotContext['shotType'] = 'NORMAL';
    if (this.lastCompletedPass?.passType === 'CROSS') {
      shotType = this.rng.chance(0.65) ? 'HEADER' : 'VOLLEY';
    } else if (shooterOwnP < 80) {
      shotType = 'LONG_SHOT';
    }

    const isOneOnOne =
      this.playPhase === 'THROUGH_BALL' ||
      (shooterOwnP >= 84 &&
        defPlayers
          .filter((d) => d.roleGroup !== 'GK')
          .every((d) => dist(d.x, d.y, shooter.x, shooter.y) > 3.6));

    const eventId = `shot-${this.clock.simulationStep}`;
    const res = ShootingSystem.attemptShot(
      shooter,
      currentTeam,
      defPlayers,
      this.lastCompletedPass,
      isOneOnOne,
      shotType,
      eventId,
      this.rng
    );

    if (!res.allowed) {
      if (res.blockedByDefender) {
        if (res.blockedByDefender.toCorner) {
          this.setupCorner(defTeamIdx, res.blockedByDefender.commentary);
        } else {
          // Bloklanan şut savunmacının önünde seker (ışınlanmaz!)
          const def = res.blockedByDefender.defender;
          this.interceptBall(defTeamIdx, res.blockedByDefender.commentary, def);
        }
      } else {
        // Şut mesafesi uygun değilse en iyi pas opsiyonuna dön
        const teammates = this.players.filter((p) => p.teamIndex === attTeamIdx && p.id !== shooter.id);
        const { target, passType } = PassingSystem.selectBestPassTarget(
          shooter,
          teammates,
          defPlayers,
          currentTeam,
          this.rng,
          this.lastCompletedPass?.passerId
        );
        this.startPass(shooter, target, passType);
        this.playPhase = 'MIDFIELD_BATTLE';
        this.phaseTimer = 0.28;
      }
      return;
    }

    const shot = res.shotContext!;
    currentTeam.shots++;
    currentTeam.xg = Number((currentTeam.xg + shot.xgAtShot).toFixed(2));
    this.playPhase = 'SHOT_ON_GOAL';
    shooter.action = 'SHOOT';

    const gk = defPlayers.find((p) => p.roleGroup === 'GK');
    if (gk) {
      gk.action = 'GK_DIVE';
      gk.targetY = clamp(shot.targetPosition.y, 26.0, 38.0);
    }

    this.ballSystem.startShot(shot);
    this.eventLog.logEvent({
      type: 'SHOT_TAKEN',
      teamIndex: attTeamIdx,
      matchSecond: Math.floor(this.clock.matchSecond),
      playerId: shooter.id,
      playerName: shooter.shortName,
      xg: shot.xgAtShot,
      commentary: isOneOnOne
        ? `🔥 ${shooter.shortName} kaleciyle karşı karşıya kaldı ve vuruşunu yaptı! [xG: ${shot.xgAtShot}]`
        : `${shooter.shortName} kaleyi gördü ve sert vurdu! [xG: ${shot.xgAtShot}]`
    });
  }

  private executeKickoffPass() {
    const ballState = this.ballSystem.getState();
    const attTeamIdx = this.ballSystem.getPossessionTeam();
    const teammates = this.players.filter((p) => p.teamIndex === attTeamIdx);
    const takerId = ballState.mode === 'RESTART' ? ballState.restart.takerId : this.ballSystem.getCarrierId();
    const carrier = (takerId ? this.players.find((p) => p.id === takerId) : null) || teammates[9] || teammates[0];
    const mid =
      teammates.find((p) => (p.roleGroup === 'CM' || p.roleGroup === 'DM' || p.roleGroup === 'AM') && p.id !== carrier.id) ||
      teammates.find((p) => p.roleGroup !== 'GK' && p.id !== carrier.id) ||
      teammates[1];

    this.startPass(carrier, mid, 'SHORT');
    this.playPhase = 'BUILD_UP';
    this.phaseTimer = 0.30;
  }

  private onPassArrived(pass: PassContext, receiver: EnginePlayerRuntime) {
    const oppTeamIdx = (1 - pass.attackingTeam) as 0 | 1;
    const oppPlayers = this.players.filter((p) => p.teamIndex === oppTeamIdx);
    const nearestOppDist = oppPlayers.reduce((min, o) => Math.min(min, dist(o.x, o.y, receiver.x, receiver.y)), 999.0);

    const result = PassingSystem.resolvePassArrival(pass, receiver, nearestOppDist, this.rng);

    if (result.isOffside) {
      this.triggerOffside(receiver);
      return;
    }

    const attTeam = pass.attackingTeam === 0 ? this.homeTeam : this.awayTeam;
    attTeam.passesCompleted++;
    this.lastCompletedPass = pass;

    if (!result.success) {
      // İlk kontrol hatası: yalnızca gerçekten yakında (<= 3.8 birim) rakip varsa topu kapar, yoksa alıcı yine kontrol eder
      const closestOpp = oppPlayers.reduce((best, o) => {
        if (o.roleGroup === 'GK') return best;
        const d = dist(o.x, o.y, pass.target.x, pass.target.y);
        return !best || d < best.dist ? { player: o, dist: d } : best;
      }, null as { player: EnginePlayerRuntime; dist: number } | null);

      if (closestOpp && closestOpp.dist <= 3.8) {
        this.interceptBall(oppTeamIdx, result.commentary || 'Top kontrol hatasıyla rakibe geçti.', closestOpp.player);
        return;
      }
    }

    // Alıcı yakındaysa (<= 0.85 birim) ve yüzü topun geliş yönüne dönükse temiz kontrol
    const distToArrival = dist(receiver.x, receiver.y, pass.target.x, pass.target.y);
    const angleToArrival = Math.atan2(pass.target.y - receiver.y, pass.target.x - receiver.x);
    const headingDiff = Math.abs(
      Math.atan2(
        Math.sin(angleToArrival - (receiver.heading || 0)),
        Math.cos(angleToArrival - (receiver.heading || 0))
      )
    );
    const isFacingArrival = headingDiff <= Math.PI * 0.48; // ~85 derece ön görüş açısı

    if (distToArrival <= 0.85 && isFacingArrival) {
      this.ballSystem.setControlled(receiver);
    } else {
      // Top oyuncunun arkasında veya uzağında kaldıysa:
      // Top pasın orijinal geliş momentumuyla doğal şekilde yuvarlanır, asla oyuncunun sırtına doğru çekilmez!
      const passDx = pass.target.x - pass.origin.x;
      const passDy = pass.target.y - pass.origin.y;
      const passLen = Math.hypot(passDx, passDy) || 1;
      const residualSpeed = clamp(pass.speed * 0.16, 0.8, 2.6);
      const rollVx = (passDx / passLen) * residualSpeed;
      const rollVy = (passDy / passLen) * residualSpeed;

      this.ballSystem.setLoose({ x: pass.target.x, y: pass.target.y }, { x: rollVx, y: rollVy }, pass.attackingTeam);

      // Oyuncu durup geriye/yana doğru düşen topa döner ve topa doğru hareket eder
      receiver.targetX = pass.target.x;
      receiver.targetY = pass.target.y;
      receiver.heading = angleToArrival;
      receiver.urgency = 1.0;
      receiver.action = 'SUPPORT';
    }

    const dir = attTeam.attackDirection;
    const recOwnP = toOwn(receiver.x, dir);
    const isForwardOrFlank =
      receiver.roleGroup === 'ST' ||
      receiver.roleGroup === 'W' ||
      receiver.roleGroup === 'FB' ||
      receiver.roleGroup === 'WB';

    const hasSpaceAhead = nearestOppDist >= 3.4;

    if (pass.passType === 'CROSS' && recOwnP >= 72) {
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.12;
      receiver.action = 'SHOOT';
    } else if (pass.passType === 'THROUGH' && recOwnP >= 72) {
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.30;
      receiver.action = 'CARRY';
      receiver.urgency = 0.94;
    } else if (recOwnP >= 74 && receiver.y >= 15 && receiver.y <= 49) {
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.28;
      receiver.action = hasSpaceAhead ? 'CARRY' : 'IDLE';
      receiver.urgency = 0.92;
    } else if (
      ((isForwardOrFlank && recOwnP >= 48) ||
        ((receiver.roleGroup === 'FB' || receiver.roleGroup === 'WB') && recOwnP >= 34)) &&
      hasSpaceAhead &&
      this.rng.chance(0.44)
    ) {
      // Yalnızca önünde yeterli boşluk varsa ve dengeli bir olasılıkla top sürme burst'ü başlar
      this.playPhase = receiver.y < 16 || receiver.y > 48 ? 'WING_ATTACK' : 'BOX_DANGER';
      this.phaseTimer = 0.32;
      receiver.action = 'CARRY';
      receiver.urgency = 0.92;
    } else if (recOwnP >= 40) {
      this.playPhase = 'MIDFIELD_BATTLE';
      this.phaseTimer = 0.24;
      receiver.action = 'IDLE';
    } else {
      this.playPhase = 'BUILD_UP';
      this.phaseTimer = 0.26;
      receiver.action = 'IDLE';
    }
  }

  private onShotArrived(shot: ShotContext) {
    for (const p of this.players) {
      if (p.action === 'SHOOT' || p.action === 'GK_DIVE' || p.action === 'SPRINT_RUN') {
        p.action = 'IDLE';
      }
    }

    const res = ShootingSystem.resolveShot(shot, this.players, this.rng);
    const attTeam = shot.attackingTeam === 0 ? this.homeTeam : this.awayTeam;
    const defTeamIdx = (1 - shot.attackingTeam) as 0 | 1;
    const defTeam = defTeamIdx === 0 ? this.homeTeam : this.awayTeam;
    const minute = Math.min(90, Math.floor(this.clock.matchSecond / 60) + 1);

    if (res.outcome === 'GOAL') {
      attTeam.goals++;
      attTeam.shotsOnTarget++;
      this.analytics.recordGoal(res.shooter.shortName, minute, shot.attackingTeam);

      this.ballSystem.setRestart({
        type: 'KICK_OFF',
        takingTeam: defTeamIdx,
        takerId: null,
        spot: { ...shot.targetPosition },
        waitTimerSec: 3.2,
        elapsedSec: 0,
        reason: 'GOAL'
      });

      this.playPhase = 'GOAL_CELEBRATION';
      this.phaseTimer = 3.2;

      this.currentHighlight = {
        id: `goal-${this.clock.matchSecond}`,
        minute,
        attackingTeam: shot.attackingTeam,
        type: 'GOAL',
        commentary: res.commentary,
        subText: `${attTeam.manager.nickname} skoru değiştirdi!`,
        scorerName: res.shooter.shortName,
        assistName: res.assister?.shortName,
        keeperName: res.goalkeeper.shortName,
        scoreHome: this.homeTeam.goals,
        scoreAway: this.awayTeam.goals,
        durationSec: 3.2,
        animType: shot.shotType === 'HEADER' ? 'header' : 'box_finish'
      };

      this.eventLog.logEvent({
        type: 'GOAL',
        teamIndex: shot.attackingTeam,
        matchSecond: Math.floor(this.clock.matchSecond),
        playerId: res.shooter.id,
        playerName: res.shooter.shortName,
        assistPlayerId: res.assister?.id,
        assistPlayerName: res.assister?.shortName,
        xg: res.xg,
        commentary: res.commentary
      });
    } else if (res.outcome === 'SAVE_HELD') {
      // Kaleci topu tuttu: Kaleci kurtarış noktasına fiziksel olarak tam yerleşir ve oradan oyunu kurar (ışınlanma yok!)
      res.goalkeeper.y = clamp(shot.targetPosition.y, 28.2, 35.8);
      res.goalkeeper.targetY = res.goalkeeper.y;
      attTeam.shotsOnTarget++;
      defTeam.saves++;
      this.ballSystem.setControlled(res.goalkeeper);
      this.playPhase = 'BUILD_UP';
      this.phaseTimer = 0.75;

      this.eventLog.logEvent({
        type: 'SAVE',
        teamIndex: defTeamIdx,
        matchSecond: Math.floor(this.clock.matchSecond),
        playerId: res.goalkeeper.id,
        playerName: res.goalkeeper.shortName,
        commentary: res.commentary
      });
    } else if (res.outcome === 'SAVE_CORNER') {
      res.goalkeeper.y = clamp(shot.targetPosition.y, 28.2, 35.8);
      res.goalkeeper.targetY = res.goalkeeper.y;
      attTeam.shotsOnTarget++;
      defTeam.saves++;
      this.setupCorner(defTeamIdx, res.commentary);
      this.eventLog.logEvent({
        type: 'SAVE',
        teamIndex: defTeamIdx,
        matchSecond: Math.floor(this.clock.matchSecond),
        playerId: res.goalkeeper.id,
        playerName: res.goalkeeper.shortName,
        commentary: res.commentary
      });
    } else if (res.outcome === 'SAVE_REBOUND') {
      res.goalkeeper.y = clamp(shot.targetPosition.y, 28.2, 35.8);
      res.goalkeeper.targetY = res.goalkeeper.y;
      attTeam.shotsOnTarget++;
      defTeam.saves++;
      const reboundX = res.goalkeeper.x + (attTeam.attackDirection === 1 ? -5.5 : 5.5);
      const reboundY = clamp(res.goalkeeper.y + this.rng.range(-5.0, 5.0), 18.0, 46.0);
      this.ballSystem.setLoose(
        { x: reboundX, y: reboundY },
        { x: (attTeam.attackDirection === 1 ? -3.2 : 3.2), y: this.rng.range(-2.5, 2.5) },
        shot.attackingTeam
      );
      this.playPhase = 'BOX_DANGER';
      this.phaseTimer = 0.4;
      this.eventLog.logEvent({
        type: 'SAVE',
        teamIndex: defTeamIdx,
        matchSecond: Math.floor(this.clock.matchSecond),
        playerId: res.goalkeeper.id,
        playerName: res.goalkeeper.shortName,
        commentary: res.commentary
      });
    } else if (res.outcome === 'WOODWORK') {
      // Direkten dönen top ceza sahası içine seker
      const bounceX = res.goalkeeper.x + (attTeam.attackDirection === 1 ? -6.5 : 6.5);
      const bounceY = clamp(32.0 + this.rng.range(-6.0, 6.0), 18.0, 46.0);
      this.ballSystem.setLoose(
        { x: bounceX, y: bounceY },
        { x: (attTeam.attackDirection === 1 ? -4.0 : 4.0), y: this.rng.range(-3.0, 3.0) },
        defTeamIdx
      );
      this.playPhase = 'MIDFIELD_BATTLE';
      this.phaseTimer = 0.45;
      this.eventLog.logEvent({
        type: 'WOODWORK',
        teamIndex: shot.attackingTeam,
        matchSecond: Math.floor(this.clock.matchSecond),
        playerName: res.shooter.shortName,
        commentary: res.commentary
      });
    } else {
      // WIDE (Aut -> Kale Vuruşu): Kalecinin kendi altıpasından kale vuruşu başlatılır
      this.playPhase = 'GOAL_KICK';
      this.phaseTimer = 2.0;
      const restart = RestartSystem.createGoalKickRestart(defTeamIdx, this.players);
      this.ballSystem.setRestart(restart);
      this.eventLog.logEvent({
        type: 'SHOT_TAKEN',
        teamIndex: shot.attackingTeam,
        matchSecond: Math.floor(this.clock.matchSecond),
        playerName: res.shooter.shortName,
        commentary: res.commentary
      });
    }
  }

  private triggerOffside(receiver: EnginePlayerRuntime) {
    this.playPhase = 'FREE_KICK_OFFSIDE';
    this.phaseTimer = 2.0;

    const defTeamIdx = (1 - receiver.teamIndex) as 0 | 1;
    const restart = RestartSystem.createFreeKickRestart(defTeamIdx, { x: receiver.x, y: receiver.y }, this.players, 'OFFSIDE');
    this.ballSystem.setRestart(restart);

    this.eventLog.logEvent({
      type: 'OFFSIDE',
      teamIndex: receiver.teamIndex,
      matchSecond: Math.floor(this.clock.matchSecond),
      playerId: receiver.id,
      playerName: receiver.shortName,
      commentary: `🚩 OFSAYT! Yan hakemin bayrağı havada! ${receiver.shortName} ofsayt pozisyonunda yakalandı.`
    });
  }

  private triggerFoulFreeKick(takingTeamIdx: 0 | 1, spot: Vec2, commentary: string) {
    this.playPhase = 'FREE_KICK';
    this.phaseTimer = 2.0;

    const restart = RestartSystem.createFreeKickRestart(takingTeamIdx, spot, this.players, 'FOUL');
    this.ballSystem.setRestart(restart);

    this.eventLog.logEvent({
      type: 'FOUL',
      teamIndex: (1 - takingTeamIdx) as 0 | 1,
      matchSecond: Math.floor(this.clock.matchSecond),
      commentary
    });
  }

  private setupCorner(defendingTeamIdx: 0 | 1, commentary: string) {
    const attackingTeamIdx = (1 - defendingTeamIdx) as 0 | 1;
    this.playPhase = 'SET_PIECE_CORNER';
    this.phaseTimer = 2.2;

    const cornerY = this.ballSystem.getPosition().y;
    const restart = RestartSystem.createCornerRestart(attackingTeamIdx, this.players, cornerY);
    this.ballSystem.setRestart(restart);

    this.eventLog.logEvent({
      type: 'RESTART',
      teamIndex: defendingTeamIdx,
      matchSecond: Math.floor(this.clock.matchSecond),
      commentary
    });
  }

  private handleBallOutOfBounds(spot: Vec2, lastTouchTeam: 0 | 1) {
    const takingTeamIdx = (1 - lastTouchTeam) as 0 | 1;
    this.playPhase = 'THROW_IN';
    this.phaseTimer = 1.9;

    const restart = RestartSystem.createThrowInRestart(takingTeamIdx, spot, this.players);
    this.ballSystem.setRestart(restart);

    const takerName = restart.takerId ? this.players.find((p) => p.id === restart.takerId)?.shortName : 'Oyuncu';
    this.eventLog.logEvent({
      type: 'RESTART',
      teamIndex: takingTeamIdx,
      matchSecond: Math.floor(this.clock.matchSecond),
      commentary: `👟 TAÇ! Top taca çıktı. ${takerName} taç atışını kullanmak için kenara geldi.`
    });
  }

  private executeThrowIn() {
    const ballState = this.ballSystem.getState();
    const takingTeamIdx = this.ballSystem.getPossessionTeam();
    const team = takingTeamIdx === 0 ? this.homeTeam : this.awayTeam;
    const teamPlayers = this.players.filter((p) => p.teamIndex === takingTeamIdx);
    const oppPlayers = this.players.filter((p) => p.teamIndex !== takingTeamIdx);

    const spot = ballState.mode === 'RESTART' ? ballState.restart.spot : this.ballSystem.getPosition();
    const takerId = ballState.mode === 'RESTART' ? ballState.restart.takerId : null;
    const taker =
      (takerId ? teamPlayers.find((p) => p.id === takerId) : null) ||
      teamPlayers
        .filter((p) => p.roleGroup !== 'GK')
        .sort((a, b) => dist(a.x, a.y, spot.x, spot.y) - dist(b.x, b.y, spot.x, spot.y))[0] ||
      teamPlayers[0];

    taker.x = spot.x;
    taker.y = spot.y;

    const teammates = teamPlayers.filter((p) => p.id !== taker.id);
    const { target } = PassingSystem.selectBestPassTarget(taker, teammates, oppPlayers, team, this.rng);

    this.startPass(taker, target, 'SHORT');
    this.playPhase = 'BUILD_UP';
    this.phaseTimer = 0.5;
  }

  private executeCornerKick() {
    const ballState = this.ballSystem.getState();
    const attTeamIdx = this.ballSystem.getPossessionTeam();
    const attPlayers = this.players.filter((p) => p.teamIndex === attTeamIdx);
    const dir = (attTeamIdx === 0 ? this.homeTeam : this.awayTeam).attackDirection;

    const restartSpot = ballState.mode === 'RESTART' ? ballState.restart.spot : this.ballSystem.getPosition();
    const takerId = ballState.mode === 'RESTART' ? ballState.restart.takerId : null;
    const cornerTaker =
      (takerId ? attPlayers.find((p) => p.id === takerId) : null) ||
      attPlayers.find((p) => p.roleGroup === 'W' || p.roleGroup === 'WM' || p.roleGroup === 'AM') ||
      attPlayers[attPlayers.length - 1];

    // Korneri kullanan oyuncuyu köşe gönderine hizala (topun köşe gönderinden çıkmasını garanti et)
    cornerTaker.x = restartSpot.x;
    cornerTaker.y = restartSpot.y;

    // Ceza sahası içindeki en güçlü hava topu hedefini seç
    const aerialTargets = attPlayers
      .filter((p) => p.id !== cornerTaker.id && p.roleGroup !== 'GK' && toOwn(p.x, dir) >= 72)
      .sort((a, b) => (b.effStats.phy + b.effStats.sho) - (a.effStats.phy + a.effStats.sho));

    const target =
      aerialTargets[0] ||
      attPlayers.find((p) => p.roleGroup === 'ST' || p.roleGroup === 'CB') ||
      attPlayers[attPlayers.length - 1];

    target.action = 'SPRINT_RUN';
    this.startPass(cornerTaker, target, 'CROSS');
    this.playPhase = 'BOX_DANGER';
    this.phaseTimer = 0.65;
  }

  private executeGoalKick() {
    const ballState = this.ballSystem.getState();
    const defTeamIdx = this.ballSystem.getPossessionTeam();
    const team = defTeamIdx === 0 ? this.homeTeam : this.awayTeam;
    const defPlayers = this.players.filter((p) => p.teamIndex === defTeamIdx);
    const oppPlayers = this.players.filter((p) => p.teamIndex !== defTeamIdx);
    const gk = defPlayers.find((p) => p.roleGroup === 'GK') || defPlayers[0];

    if (ballState.mode === 'RESTART') {
      gk.x = ballState.restart.spot.x;
      gk.y = ballState.restart.spot.y;
    }

    const teammates = defPlayers.filter((p) => p.id !== gk.id);
    const { target, passType } = PassingSystem.selectBestPassTarget(gk, teammates, oppPlayers, team, this.rng);

    this.startPass(gk, target, passType === 'THROUGH' ? 'SHORT' : passType);
    this.playPhase = 'BUILD_UP';
    this.phaseTimer = 0.55;
  }

  private executeFreeKick() {
    const ballState = this.ballSystem.getState();
    const takingTeamIdx = this.ballSystem.getPossessionTeam();
    const team = takingTeamIdx === 0 ? this.homeTeam : this.awayTeam;
    const teamPlayers = this.players.filter((p) => p.teamIndex === takingTeamIdx);
    const oppPlayers = this.players.filter((p) => p.teamIndex !== takingTeamIdx);

    const spot = ballState.mode === 'RESTART' ? ballState.restart.spot : this.ballSystem.getPosition();
    const takerId = ballState.mode === 'RESTART' ? ballState.restart.takerId : null;
    const taker =
      (takerId ? teamPlayers.find((p) => p.id === takerId) : null) ||
      teamPlayers
        .filter((p) => p.roleGroup !== 'GK')
        .sort((a, b) => dist(a.x, a.y, spot.x, spot.y) - dist(b.x, b.y, spot.x, spot.y))[0] ||
      teamPlayers[1];

    // Vuruşun topun durduğu noktadan çıkmasını sağla (topun başka yere ışınlanmasını önler!)
    taker.x = spot.x;
    taker.y = spot.y;

    const teammates = teamPlayers.filter((p) => p.id !== taker.id);
    const { target, passType } = PassingSystem.selectBestPassTarget(taker, teammates, oppPlayers, team, this.rng);

    this.startPass(taker, target, passType);
    this.playPhase = toOwn(spot.x, team.attackDirection) > 55 ? 'MIDFIELD_BATTLE' : 'BUILD_UP';
    this.phaseTimer = 0.5;
  }

  private startPass(passer: EnginePlayerRuntime, receiver: EnginePlayerRuntime, passType: PassContext['passType']) {
    const dir = passer.attackDirection;
    const eventId = `pass-${this.clock.simulationStep}`;
    const defPlayers = this.players.filter((p) => p.teamIndex !== passer.teamIndex);

    const pass = PassingSystem.createPassContext(
      passer,
      receiver,
      passType,
      defPlayers,
      dir,
      eventId,
      Math.floor(this.clock.matchSecond)
    );

    const attTeam = passer.teamIndex === 0 ? this.homeTeam : this.awayTeam;
    attTeam.passesAttempted++;
    passer.action = 'PASS';
    receiver.action = passType === 'THROUGH' || passType === 'CROSS' ? 'SPRINT_RUN' : 'SUPPORT';

    this.ballSystem.startPass(pass);
  }

  private interceptBall(newTeamIdx: 0 | 1, comment: string, actualInterceptor?: EnginePlayerRuntime) {
    const newTeamPlayers = this.players.filter((p) => p.teamIndex === newTeamIdx);
    let interceptor = actualInterceptor;
    if (!interceptor) {
      const ballPos = this.ballSystem.getPosition();
      let minDist = 999.0;
      for (const p of newTeamPlayers) {
        const d = dist(p.x, p.y, ballPos.x, ballPos.y);
        if (d < minDist) {
          minDist = d;
          interceptor = p;
        }
      }
    }
    if (!interceptor) interceptor = newTeamPlayers[0];

    for (const p of this.players) {
      if (p.id !== interceptor.id && p.action !== 'IDLE') p.action = 'IDLE';
    }

    const ballPos = this.ballSystem.getPosition();
    const dToBall = dist(interceptor.x, interceptor.y, ballPos.x, ballPos.y);

    if (dToBall <= 0.85) {
      interceptor.heading = Math.atan2(ballPos.y - interceptor.y, ballPos.x - interceptor.x);
      this.ballSystem.setControlled(interceptor);
    } else {
      // Araya girildiğinde savunmacı hemen topla fiziksel temas noktasında değilse top sekerek gevşer, savunmacı koşar (ışınlanma engeli)
      const vel = this.ballSystem.getVelocity();
      const vx = clamp(vel.x * 0.25, -2.0, 2.0);
      const vy = clamp(vel.y * 0.25, -2.0, 2.0);
      this.ballSystem.setLoose({ x: ballPos.x, y: ballPos.y }, { x: vx, y: vy }, newTeamIdx);
      interceptor.targetX = ballPos.x;
      interceptor.targetY = ballPos.y;
      interceptor.heading = Math.atan2(ballPos.y - interceptor.y, ballPos.x - interceptor.x);
      interceptor.urgency = 1.0;
      interceptor.action = 'SPRINT_RUN';
    }
    const team = newTeamIdx === 0 ? this.homeTeam : this.awayTeam;
    const isCounter = team.style.tempo >= 1.05 && toOwn(interceptor.x, team.attackDirection) > 25;
    this.playPhase = isCounter ? 'COUNTER_ATTACK' : 'BUILD_UP';
    this.phaseTimer = isCounter ? 0.32 : 0.45;

    this.eventLog.logEvent({
      type: 'PASS_INTERCEPTED',
      teamIndex: newTeamIdx,
      matchSecond: Math.floor(this.clock.matchSecond),
      playerId: interceptor.id,
      playerName: interceptor.shortName,
      commentary: comment
    });
  }

  private updateMomentum() {
    const homePressure = this.homeTeam.goals * 30 + this.homeTeam.shots * 8 + this.homeTeam.xg * 20;
    const awayPressure = this.awayTeam.goals * 30 + this.awayTeam.shots * 8 + this.awayTeam.xg * 20;
    const rawDiff = awayPressure - homePressure;
    this.momentum = Math.max(-100, Math.min(100, rawDiff));

    if (Math.floor(this.clock.matchSecond) % 180 === 0 && this.momentumHistory.length < 30) {
      this.momentumHistory.push(this.momentum);
    }
  }

  public getSnapshotState() {
    const currentMinute = Math.min(90, Math.floor(this.clock.matchSecond / 60) + 1);
    const defTeamIdx = (1 - this.ballSystem.getPossessionTeam()) as 0 | 1;
    const defPlayers = this.players.filter((p) => p.teamIndex === defTeamIdx);
    const liveOffside = OffsideRule.calculateLiveOffsideLine(
      defPlayers,
      this.ballSystem.getPosition(),
      defPlayers[0]?.attackDirection === 1 ? -1 : 1
    );

    return {
      pitchState: {
        players: this.players as PitchPlayerState[],
        ball: this.ballSystem.toPitchBallState(),
        phase: this.playPhase,
        matchSecond: Math.floor(this.clock.matchSecond),
        momentum: this.momentum,
        isKeyHighlight:
          this.playPhase === 'BOX_DANGER' ||
          this.playPhase === 'SHOT_ON_GOAL' ||
          this.playPhase === 'GOAL_CELEBRATION',
        offsideLineX: liveOffside,
        attackDirections: [this.homeTeam.attackDirection, this.awayTeam.attackDirection] as [1 | -1, 1 | -1]
      },
      matchScore: [this.homeTeam.goals, this.awayTeam.goals] as [number, number],
      currentMinute,
      currentHighlight: this.currentHighlight,
      liveTicker: this.eventLog.getLiveTicker(),
      timelineMarkers: this.eventLog.getTimelineMarkers(),
      momentumHistory: this.momentumHistory,
      activeShouts: {
        [this.homeTeam.manager.sessionId]: this.homeTeam.activeShout,
        [this.awayTeam.manager.sessionId]: this.awayTeam.activeShout,
        0: this.homeTeam.activeShout,
        1: this.awayTeam.activeShout
      } as any,
      managerMentality: {
        [this.homeTeam.manager.sessionId]: this.homeTeam.mentality,
        [this.awayTeam.manager.sessionId]: this.awayTeam.mentality,
        0: this.homeTeam.mentality,
        1: this.awayTeam.mentality
      } as Record<string, MentalityType>,
      matchStats: this.analytics.buildMatchStats(
        [this.homeTeam, this.awayTeam],
        this.players,
        this.homeCards,
        this.awayCards
      )
    };
  }

  public getLiveOffsideLine(defendingTeamIdx: 0 | 1): number {
    const defPlayers = this.players.filter((p) => p.teamIndex === defendingTeamIdx);
    return OffsideRule.calculateLiveOffsideLine(
      defPlayers,
      this.ballSystem.getPosition(),
      defPlayers[0]?.attackDirection === 1 ? -1 : 1
    );
  }

  public getFinalStats(): MatchStats {
    return this.analytics.buildMatchStats(
      [this.homeTeam, this.awayTeam],
      this.players,
      this.homeCards,
      this.awayCards
    );
  }

  public isFinished(): boolean {
    return this.isMatchFinished;
  }
}
