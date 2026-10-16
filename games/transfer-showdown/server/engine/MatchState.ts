import {
  ManagerBudgetState,
  ManagerTactics,
  MentalityType,
  PitchPlayerState,
  PlayerCard,
  PlayerCardStats,
  TeamSynergy,
  TouchlineShoutType
} from '../../shared/types.js';

export interface Vec2 {
  x: number;
  y: number;
}

export interface MatchClockState {
  matchSecond: number;        // 0..5400 (90 dk maç saati)
  simulationSecond: number;   // Sabit adımlı fiziksel simülasyon zamanı
  simulationStep: number;     // Toplam çalıştırılan tick adımı
  half: 1 | 2;
  isStoppageTime: boolean;
}

export interface OffsidePassSnapshot {
  passerId: string;
  intendedReceiverId: string;
  attackingTeam: 0 | 1;
  attackDirection: 1 | -1;
  ballOrigin: Vec2;
  offsideLineX: number;
  isReceiverOffsideAtPass: boolean;
}

export type EnginePassType = 'SHORT' | 'THROUGH' | 'CROSS' | 'LONG' | 'CLEARANCE';

export interface PassContext {
  eventId: string;
  passerId: string;
  receiverId: string;
  attackingTeam: 0 | 1;
  passType: EnginePassType;
  origin: Vec2;
  /** Topun gerçekte ineceği nokta (pas hatası sapması dahil) */
  target: Vec2;
  /** Pasörün hedeflediği nokta (alıcının koşacağı yer) */
  intendedTarget: Vec2;
  flightDurationSec: number;
  elapsedSec: number;
  maxHeight: number;
  /** Ortalama uçuş hızı (saha birimi / sn) */
  speed: number;
  startedAtMatchSecond: number;
  offsideSnapshot: OffsidePassSnapshot;
}

export type ShotType = 'NORMAL' | 'HEADER' | 'VOLLEY' | 'LONG_SHOT' | 'FREE_KICK' | 'PENALTY';
export type ShotOutcome = 'GOAL' | 'SAVE_HELD' | 'SAVE_CORNER' | 'SAVE_REBOUND' | 'WOODWORK' | 'WIDE' | 'BLOCKED';

export interface ShotContext {
  eventId: string;
  shooterId: string;
  assisterId: string | null;
  attackingTeam: 0 | 1;
  startPosition: Vec2;
  targetPosition: Vec2;
  shotType: ShotType;
  xgAtShot: number;
  flightDurationSec: number;
  elapsedSec: number;
  maxHeight: number;
  goalkeeperId: string | null;
  /** Şut atıldığı anda belirlenen sonuç; görsel uçuş bu sonuca göre kurgulanır */
  outcome: ShotOutcome;
  blockerId?: string;
  isOnTarget: boolean;
}

export type RestartType = 'KICK_OFF' | 'GOAL_KICK' | 'CORNER' | 'FREE_KICK' | 'THROW_IN' | 'PENALTY';

export interface RestartState {
  type: RestartType;
  takingTeam: 0 | 1;
  takerId: string | null;
  spot: Vec2;
  waitTimerSec: number;
  elapsedSec: number;
  reason?: 'OFFSIDE' | 'FOUL' | 'GOAL';
}

export type AuthoritativeBallState =
  | {
      mode: 'CONTROLLED';
      carrierId: string;
      possessionTeam: 0 | 1;
      position: Vec2;
    }
  | {
      mode: 'IN_FLIGHT_PASS';
      pass: PassContext;
      position: Vec2;
      height: number;
      possessionTeam: 0 | 1;
    }
  | {
      mode: 'IN_FLIGHT_SHOT';
      shot: ShotContext;
      position: Vec2;
      height: number;
      possessionTeam: 0 | 1;
    }
  | {
      mode: 'LOOSE';
      position: Vec2;
      velocity: Vec2;
      height: number;
      lastTouchTeam: 0 | 1;
      possessionTeam: 0 | 1;
    }
  | {
      mode: 'RESTART';
      restart: RestartState;
      position: Vec2;
      possessionTeam: 0 | 1;
    };

export interface EnginePlayerRuntime extends PitchPlayerState {
  card: PlayerCard;
  /** Kartın ham nitelikleri */
  stats: PlayerCardStats;
  /** Mevki uyumuna göre düzeltilmiş nitelikler (simülasyon bunları kullanır) */
  effStats: PlayerCardStats;
  effOvr: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  heading: number; // radyan cinsinden yön
  maxSpeed: number;
  maxAcceleration: number;
  attackDirection: 1 | -1;
  /** 0..1: hedefe giderken tempo (0 = tırıs, 1 = tam sprint) */
  urgency: number;
  tackleCooldownSec: number;
  /** simulationSecond bu değere ulaşana kadar topu sahiplenemez (pası atan oyuncunun hemen geri alması engellenir) */
  noClaimUntil: number;
  stunSec: number;
  /** Top taşıyıcının bir sonraki karar anına kalan süre */
  thinkTimerSec: number;
  /** Sahada sahip olduğu takım içi rol grubu (Positioning için önbellek) */
  roleGroup: string;
}

export type AttackPlanKind =
  | 'BUILD_PATIENT'
  | 'WING_OVERLOAD'
  | 'HALF_SPACE'
  | 'CENTRAL_COMBO'
  | 'DIRECT_BALL'
  | 'COUNTER_BREAK'
  | 'SWITCH_PLAY';

export interface AttackPlan {
  kind: AttackPlanKind;
  /** Kanat yüklenmesinde hedef kanat (y ekseninde üst: y küçük, alt: y büyük) */
  flank: 'TOP' | 'BOTTOM' | null;
  startedSec: number;
  expiresSec: number;
  label: string;
}

export interface TeamStyle {
  lineHeight: number;        // savunma hattının (CB) kendi kaleye göre X derinliği
  pressTrigger: number;      // topa baskı başlatma mesafesi
  pressIntensity: number;    // baskı / müdahale agresifliği
  pressHighLine: number;     // 0..1 forvetlerin rakip kaleciye yakın baskı hattı
  tempo: number;             // karar hızı çarpanı
  riskTaking: number;        // -0.3..0.5
  directness: number;        // 0..1 ileri / uzun top tercihi
  width: number;             // kanat genişliği
  shootRange: number;        // şut menzili ek değeri
  shotEagerness: number;     // şut isteği çarpanı
  forwardCommit: number;     // 0..1 hücuma katılan oyuncu miktarı
  fullBackOverlap: number;   // 0..1 bek bindirme isteği
  counterLeak: number;       // 0..1 top kaybında arkada bıraktığı boşluk
  compactness: number;       // yatay sıkışıklık
}

export interface EngineTeamRuntime {
  index: 0 | 1;
  manager: ManagerBudgetState;
  tactics: ManagerTactics;
  synergy: TeamSynergy;
  mentality: MentalityType;
  style: TeamStyle;
  plan: AttackPlan | null;
  attackDirection: 1 | -1; // 1: x artan yönde hücum (soldan sağa), -1: x azalan yönde hücum
  activeShout?: {
    shout: TouchlineShoutType;
    text: string;
    expiresAtSec: number;
  };
  goals: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  passesCompleted: number;
  passesAttempted: number;
  fouls: number;
  xg: number;
}

export interface MatchEngineConfig {
  seed?: number;
  fixedStepSec?: number; // varsayılan 0.05 saniye (20Hz)
  timeMultiplierNormal?: number; // varsayılan 28
  timeMultiplierDanger?: number; // varsayılan 6
}
