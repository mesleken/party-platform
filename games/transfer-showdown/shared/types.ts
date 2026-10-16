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

export type FormationType = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2';

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
  defensiveLine: DefensiveLineType;
  lineup: Record<number, string>;
  isReady?: boolean;
}
