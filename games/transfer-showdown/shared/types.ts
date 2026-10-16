export type CardPosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export type CardCategory = 'active' | 'icon';

export interface PlayerCardStats {
  pac: number; // Pace / Hız (GK: Speed)
  sho: number; // Shooting / Şut (GK: Kicking)
  pas: number; // Passing / Pas (GK: Handling)
  dri: number; // Dribbling (GK: Reflexes)
  def: number; // Defending (GK: Positioning)
  phy: number; // Physicality / Fizik (GK: Diving)
}

export interface PlayerCard {
  id: string;
  name: string;
  shortName: string;
  position: CardPosition;
  specificRole: string; // e.g. 'ST', 'CB', 'CAM', 'RW', 'GK'
  category: CardCategory;
  nationality: string;
  countryFlag: string;
  club: string;
  ovr: number;
  startingPrice: number;
  stats: PlayerCardStats;
  accentColor: string;
  photoUrl?: string;
}

export type PackTier = 'STANDARD' | 'PREMIUM' | 'ICONIC';

export interface TransferPack {
  packIndex: number;
  packName: string; // e.g. "PAKET #07"
  tier?: PackTier;
  cards: [PlayerCard, PlayerCard, PlayerCard, PlayerCard]; // [GK, DEF, MID, FWD]
  openingPrice: number;
}

export interface AuctionLot {
  lotIndex: number;
  roundNumber: number; // 1..22
  turnStarterId: string | null;
  card?: PlayerCard;
  pack: TransferPack;
  currentBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  timeLeft: number;
  isCompleted: boolean;
  winnerId: string | null;
  finalPrice: number;
  passedManagers: string[]; // Session IDs who clicked 'Pas / Rakibe Bırak'
  isUnsold: boolean;
  isPickingPlayer: boolean;
  pickingTimeLeft: number;
  selectedCardId: string | null;
  extensionCount: number; // max 2 uzatma
  allowedBidders: string[];
}

export interface ManagerPositionQuota {
  GK: number;
  DEF: number;
  MID: number;
  FWD: number;
}

export interface ManagerBudgetState {
  sessionId: string;
  nickname: string;
  avatar: string;
  teamIndex: 0 | 1; // 0 = Home / Takım A, 1 = Away / Takım B
  budget: number; // Başlangıç: 100
  cards: PlayerCard[];
  rosterCount: number; // 0 - 11
  availableMaxBid: number;
  positionCounts: ManagerPositionQuota;
  isSquadFull: boolean;
  hasPassedCurrentLot: boolean;
  isBiddingLockedByLead?: boolean; // Rakiple kadro farkı >= 2 olduğu için kilitli mi
}

export type FormationType = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2' | '5-3-2' | '3-4-3' | '4-1-4-1';

export type PlaystyleType = 'balanced' | 'possession' | 'counter' | 'high_press';

export type DefensiveLineType = 'low' | 'balanced' | 'high';

export interface FormationSlot {
  slotIndex: number;
  role: string;
  requiredPosition: CardPosition;
  x: number; // 0..100 (horizontal pitch %)
  y: number; // 0..100 (vertical pitch %)
}

export interface ManagerTactics {
  formation: FormationType;
  playstyle: PlaystyleType;
  mentality?: MentalityType; // Takım mentalitesi (varsayılan: balanced)
  defensiveLine: DefensiveLineType;
  lineup: Record<number, string>; // slotIndex -> cardId
  isReady: boolean;
  allOutAttack: boolean;
}

export interface TeamSynergy {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeping: number;
  chemistry: number;
  overall: number;
  attackStars: 1 | 2 | 3;
  midfieldStars: 1 | 2 | 3;
  defenseStars: 1 | 2 | 3;
}

export type ShowdownPhase =
  | 'WAITING_PLAYERS'
  | 'AUCTION'
  | 'TACTICS'
  | 'MATCH_FIRST_HALF'
  | 'HALFTIME'
  | 'MATCH_SECOND_HALF'
  | 'ANALYSIS';

export type HighlightType =
  | 'GOAL'
  | 'SAVE'
  | 'WOODWORK'
  | 'MISS'
  | 'TACKLE'
  | 'PENALTY_GOAL'
  | 'PENALTY_SAVE';

export interface MatchHighlight {
  id: string;
  minute: number;
  attackingTeam: 0 | 1;
  type: HighlightType;
  commentary: string;
  subText: string;
  scorerName?: string;
  assistName?: string;
  keeperName?: string;
  scoreHome: number;
  scoreAway: number;
  durationSec: number;
  animType: 'long_shot' | 'box_finish' | 'header' | 'keeper_dive' | 'defensive_block' | 'counter_rush';
}

export interface MatchStats {
  score: [number, number];
  xg: [number, number];
  possession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  saves: [number, number];
  passAccuracy: [number, number];
  fouls: [number, number];
  scorers: Array<{ name: string; minute: number; team: 0 | 1 }>;
  mvp: {
    name: string;
    rating: number;
    team: 0 | 1;
    card: PlayerCard;
    reason: string;
  };
  winnerTeamIndex: 0 | 1 | -1; // -1 for draw
}

export type MentalityType = 'defensive' | 'balanced' | 'attacking' | 'all_out_attack';

export type TouchlineShoutType =
  | 'push_forward'
  | 'tighten_up'
  | 'play_creative'
  | 'demand_more';

export type MatchPlayPhase =
  | 'KICK_OFF'
  | 'BUILD_UP'
  | 'MIDFIELD_BATTLE'
  | 'WING_ATTACK'
  | 'THROUGH_BALL'
  | 'BOX_DANGER'
  | 'SHOT_ON_GOAL'
  | 'SET_PIECE_CORNER'
  | 'GOAL_KICK'
  | 'GOAL_CELEBRATION'
  | 'FREE_KICK_OFFSIDE'
  | 'THROW_IN'
  | 'FREE_KICK'
  | 'PENALTY_KICK'
  | 'COUNTER_ATTACK';

export interface PitchPlayerState {
  id: string;
  cardId?: string;
  slotIndex: number;
  role: string;
  name: string;
  shortName: string;
  number: number;
  position: CardPosition;
  teamIndex: 0 | 1;
  baseX: number;
  baseY: number;
  x: number;       // 0..100
  y: number;       // 0..64
  targetX: number; // 0..100
  targetY: number; // 0..64
  stamina: number; // 0..100
  rating: number;  // 5.0..10.0
  goals: number;
  assists: number;
  yellowCard?: boolean;
  action: 'IDLE' | 'CARRY' | 'PASS' | 'SPRINT_RUN' | 'PRESS' | 'TACKLE' | 'SHOOT' | 'GK_DIVE' | 'INTERCEPT' | 'SUPPORT';
  photoUrl?: string;
  ovr: number;
  stats?: PlayerCardStats;
  vx?: number;
  vy?: number;
  heading?: number;
  attackDirection?: 1 | -1;
}

export interface PitchBallState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  height: number;
  carrierId: string | null;
  possessionTeam: 0 | 1;
  passType?: 'SHORT' | 'THROUGH' | 'CROSS' | 'LONG' | 'SHOT' | 'CLEARANCE';
  isMoving: boolean;
  flightProgress?: number;
  flightDurationSec?: number;
  vx?: number; // saha birimi / saniye (istemci tarafı tahmin yürütme için)
  vy?: number;
  flightRemainingSec?: number;
}

export interface LiveTickerMessage {
  id: string;
  minute: number;
  second: number;
  text: string;
  teamIndex: 0 | 1 | -1;
  type: 'NORMAL' | 'DANGER' | 'GOAL' | 'SAVE' | 'SHOUT' | 'EVENT';
}

export interface TimelineMarker {
  minute: number;
  second?: number;
  type: 'GOAL' | 'CARD' | 'WOODWORK' | 'SAVE' | 'OFFSIDE' | 'SUB';
  teamIndex: 0 | 1;
  label: string;
}

export interface ShowdownSnapshot {
  phase: ShowdownPhase;
  phaseTimeLeft: number;
  managers: Record<string, ManagerBudgetState>;
  currentLot: AuctionLot | null;
  auctionTotalLots: number;
  auctionCompletedLots: number;
  managerTactics: Record<string, ManagerTactics>;
  teamSynergies: [TeamSynergy, TeamSynergy];
  currentHighlight: MatchHighlight | null;
  highlightElapsedSec: number;
  matchScore: [number, number];
  currentMinute: number;
  matchStats: MatchStats | null;
  winnerNickname: string;
  // Football Manager (FM) Canlı Maç Motoru State'leri
  pitchState?: {
    players: PitchPlayerState[];
    ball: PitchBallState;
    phase: MatchPlayPhase;
    matchSecond: number;
    momentum: number; // -100 (Home dominance) to +100 (Away dominance)
    isKeyHighlight: boolean;
    offsideLineX?: number;
    attackDirections?: [1 | -1, 1 | -1];
  };
  liveTicker?: LiveTickerMessage[];
  timelineMarkers?: TimelineMarker[];
  activeShouts?: Record<string, { shout: TouchlineShoutType; text: string; expiresAt: number }>;
  managerMentality?: Record<string, MentalityType>;
  momentumHistory?: number[];
}

export interface BidAction {
  type: 'BID_INCREMENT' | 'FORFEIT_LOT' | 'WAIT';
  incrementAmount?: 1 | 5;
}

export interface PickCardAction {
  cardId: string;
}

export interface TacticsSubmission {
  formation: FormationType;
  playstyle: PlaystyleType;
  mentality?: MentalityType;
  defensiveLine: DefensiveLineType;
  lineup: Record<number, string>;
  isReady?: boolean;
}

export interface LiveTacticsAction {
  mentality?: MentalityType;
  playstyle?: PlaystyleType;
  defensiveLine?: DefensiveLineType;
}

export interface ShoutAction {
  shout: TouchlineShoutType;
}

