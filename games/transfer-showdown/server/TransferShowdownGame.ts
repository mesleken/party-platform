import { Room } from '@colyseus/core';
import {
  BidAction,
  CardPosition,
  FormationType,
  ManagerBudgetState,
  ManagerTactics,
  MatchHighlight,
  ShowdownPhase,
  ShowdownSnapshot,
  TacticsSubmission,
  TeamSynergy
} from '../shared/types.js';
import { autoAssignLineup } from '../shared/formations.js';
import { calculateTeamSynergy } from '../shared/tactics.js';
import { AuctionEngine } from './AuctionEngine.js';
import { SquadValidator } from './SquadValidator.js';
import { MatchSimulator } from './MatchSimulator.js';

export class TransferShowdownGame {
  private room: Room<any>;
  private phase: ShowdownPhase = 'AUCTION';
  private phaseTimeLeft = 0;

  private managers: Map<string, ManagerBudgetState> = new Map();
  private managerTactics: Map<string, ManagerTactics> = new Map();

  private auctionEngine?: AuctionEngine;
  private matchSimulator?: MatchSimulator;

  private gameInterval?: NodeJS.Timeout;
  private currentHighlight: MatchHighlight | null = null;
  private highlightElapsedSec = 0;
  private highlightIndex = 0;
  private allHighlights: MatchHighlight[] = [];
  private currentMinute = 0;
  private matchScore: [number, number] = [0, 0];
  private isDestroyed = false;

  constructor(room: Room<any>) {
    this.room = room;
  }

  public init() {
    this.managers.clear();
    this.managerTactics.clear();

    const clients: string[] = [];
    this.room.state.players.forEach((p: any, sessionId: string) => {
      if (!p.isScreen) {
        clients.push(sessionId);
      }
    });

    // En az 2 menajer gereklidir (eğer 1 kişi varsa simülasyon botu eklenir)
    if (clients.length === 0) {
      clients.push('host-sim');
    }

    clients.forEach((sessionId, idx) => {
      const player = this.room.state.players.get(sessionId);
      const nickname = player ? player.nickname : (idx === 0 ? 'Menajer 1' : 'Menajer 2');
      const avatar = player ? player.avatar : '👔';
      const teamIdx: 0 | 1 = (idx % 2) as 0 | 1;

      const budgetState: ManagerBudgetState = {
        sessionId,
        nickname,
        avatar,
        teamIndex: teamIdx,
        budget: 100,
        cards: [],
        rosterCount: 0,
        availableMaxBid: 100 - 10, // 10 boş yuva için 1'er kredi rezerve
        positionCounts: { GK: 0, DEF: 0, MID: 0, FWD: 0 },
        isSquadFull: false,
        hasPassedCurrentLot: false
      };

      this.managers.set(sessionId, budgetState);

      const defaultTactics: ManagerTactics = {
        formation: '4-3-3',
        playstyle: 'balanced',
        defensiveLine: 'balanced',
        lineup: {},
        isReady: false,
        allOutAttack: false
      };
      this.managerTactics.set(sessionId, defaultTactics);
    });

    // 1 kişi varsa rakip Bot Menajer ekle
    if (this.managers.size === 1) {
      const botId = 'ai-rival-manager';
      const botBudget: ManagerBudgetState = {
        sessionId: botId,
        nickname: 'Yapay Zeka Menajer',
        avatar: '🤖',
        teamIndex: 1,
        budget: 100,
        cards: [],
        rosterCount: 0,
        availableMaxBid: 90,
        positionCounts: { GK: 0, DEF: 0, MID: 0, FWD: 0 },
        isSquadFull: false,
        hasPassedCurrentLot: false
      };
      this.managers.set(botId, botBudget);
      this.managerTactics.set(botId, {
        formation: '4-3-3',
        playstyle: 'balanced',
        defensiveLine: 'balanced',
        lineup: {},
        isReady: true,
        allOutAttack: false
      });
    }

    this.startAuctionPhase();

    // 200ms aralıklarla oyun döngüsünü çalıştır
    if (this.gameInterval) clearInterval(this.gameInterval);
    this.gameInterval = setInterval(() => this.tick(0.2), 200);
  }

  // ==========================================
  // PHASE 1: AUCTION
  // ==========================================
  private startAuctionPhase() {
    this.phase = 'AUCTION';
    const managerList = Array.from(this.managers.values());
    this.auctionEngine = new AuctionEngine(managerList);

    this.auctionEngine.setCallbacks(
      (lot) => {
        // Lot sonuçlandığında kısa ara (1.5sn) verip sıradakine geç
        setTimeout(() => {
          if (this.phase === 'AUCTION' && !this.isDestroyed) {
            this.auctionEngine?.advanceToNextLot();
            this.broadcastState();
          }
        }, 1500);
      },
      () => {
        // Tüm açık artırma bitti
        this.finishAuctionAndGoToTactics();
      }
    );

    this.auctionEngine.startFirstLot();
    this.broadcastState();
  }

  public handleBid(sessionId: string, action: BidAction) {
    if (this.phase !== 'AUCTION' || !this.auctionEngine) return;

    if (action.type === 'BID_INCREMENT') {
      const increment = action.incrementAmount || 1;
      const res = this.auctionEngine.placeBid(sessionId, increment);
      if (res.success) {
        this.broadcastState();
        // Eğer rakip bot varsa teklife tepki verdir
        this.checkBotAuctionResponse();
      }
    } else if (action.type === 'FORFEIT_LOT') {
      this.auctionEngine.forfeitLot(sessionId);
      this.broadcastState();
      // Eğer bot kazandıysa botun oyuncu seçmesini sağla
      this.checkBotPickResponse();
    }
  }

  public handlePickCard(sessionId: string, cardId: string) {
    if (this.phase !== 'AUCTION' || !this.auctionEngine) return;
    const res = this.auctionEngine.pickPlayer(sessionId, cardId);
    if (res.success) {
      this.broadcastState();
    }
  }

  private checkBotAuctionResponse() {
    const bot = this.managers.get('ai-rival-manager');
    if (!bot || !this.auctionEngine) return;

    const currentLot = this.auctionEngine.getCurrentLot();
    if (!currentLot || currentLot.isCompleted || currentLot.isPickingPlayer) return;

    // Bot sadece en yüksek teklif kendisinde değilse ve kart değerine uygunsa teklif artırır
    if (currentLot.highestBidderId !== bot.sessionId && Math.random() < 0.65) {
      setTimeout(() => {
        if (!this.auctionEngine || this.phase !== 'AUCTION') return;
        const lot = this.auctionEngine.getCurrentLot();
        if (lot && !lot.isCompleted && !lot.isPickingPlayer && lot.highestBidderId !== bot.sessionId) {
          const maxAllowed = Math.min(lot.pack.openingPrice + 9, bot.availableMaxBid, 30);
          if (lot.currentBid + 1 <= maxAllowed && lot.allowedBidders.includes(bot.sessionId)) {
            this.auctionEngine.placeBid(bot.sessionId, 1);
            this.broadcastState();
          } else {
            this.auctionEngine.forfeitLot(bot.sessionId);
            this.broadcastState();
          }
        }
      }, 900 + Math.random() * 1200);
    }
  }

  private checkBotPickResponse() {
    const bot = this.managers.get('ai-rival-manager');
    if (!bot || !this.auctionEngine) return;

    const currentLot = this.auctionEngine.getCurrentLot();
    if (currentLot && currentLot.isPickingPlayer && currentLot.winnerId === bot.sessionId) {
      setTimeout(() => {
        if (!this.auctionEngine || this.phase !== 'AUCTION') return;
        const lot = this.auctionEngine.getCurrentLot();
        if (lot && lot.isPickingPlayer && lot.winnerId === bot.sessionId) {
          // Bot en yüksek OVR'lı uygun kartı seçer
          const eligible = lot.pack.cards
            .filter((c) => SquadValidator.canPickCard(bot, c).canPick)
            .sort((a, b) => b.ovr - a.ovr);
          const chosen = eligible[0] || lot.pack.cards[0];
          this.auctionEngine.pickPlayer(bot.sessionId, chosen.id);
          this.broadcastState();
        }
      }, 1200);
    }
  }

  private finishAuctionAndGoToTactics() {
    if (this.phase !== 'AUCTION') return;

    // 11 oyuncusu tamamlanmayan menajerlerin boşluklarını tamamla
    this.managers.forEach((m) => {
      if (m.cards.length < 11) {
        const added = SquadValidator.fillMissingSlots(m);
        m.cards.push(...added);
        m.rosterCount = m.cards.length;
        added.forEach((c) => m.positionCounts[c.position]++);
        m.isSquadFull = true;
      }

      // Varsayılan dizilişi otomatik ata
      const tactics = this.managerTactics.get(m.sessionId);
      if (tactics) {
        tactics.lineup = autoAssignLineup(tactics.formation, m.cards);
      }
    });

    this.phase = 'TACTICS';
    this.phaseTimeLeft = 120; // Kullanıcı isteği: Acele ettirmeyen 2 dakikalık taktik ve kadro kurma süresi
    this.broadcastState();
  }

  // ==========================================
  // PHASE 2: TACTICS
  // ==========================================
  public handleTacticsSubmission(sessionId: string, submission: TacticsSubmission) {
    const tactics = this.managerTactics.get(sessionId);
    const manager = this.managers.get(sessionId);
    if (!tactics || !manager) return;

    tactics.formation = submission.formation;
    tactics.playstyle = submission.playstyle;
    tactics.defensiveLine = submission.defensiveLine;
    tactics.lineup = submission.lineup || autoAssignLineup(submission.formation, manager.cards);
    if (submission.isReady !== undefined) {
      tactics.isReady = submission.isReady;
    } else {
      tactics.isReady = true;
    }

    // Kullanıcı kuralı: "Taktik ekranında iki oyuncu da hazır derse simülasyon direkt başlasın."
    const activeManagers = Array.from(this.managers.values());
    const m0 = activeManagers.find((m) => m.teamIndex === 0) || activeManagers[0];
    const m1 = activeManagers.find((m) => m.teamIndex === 1) || activeManagers[1];
    const t0 = m0 ? this.managerTactics.get(m0.sessionId) : null;
    const t1 = m1 ? this.managerTactics.get(m1.sessionId) : null;

    const allReady = Boolean(t0?.isReady && t1?.isReady);
    if (allReady) {
      this.phaseTimeLeft = 0;
      this.startFirstHalf();
    } else {
      this.broadcastState();
    }
  }

  // ==========================================
  // PHASE 3: 3D MATCH SIMULATION
  // ==========================================
  private startFirstHalf() {
    this.phase = 'MATCH_FIRST_HALF';

    const managerList = Array.from(this.managers.values());
    const homeManager = managerList.find((m) => m.teamIndex === 0) || managerList[0];
    const awayManager = managerList.find((m) => m.teamIndex === 1) || managerList[1];

    const homeTactics = this.managerTactics.get(homeManager.sessionId)!;
    const awayTactics = this.managerTactics.get(awayManager.sessionId)!;

    this.matchSimulator = new MatchSimulator(
      homeManager.cards,
      awayManager.cards,
      homeTactics,
      awayTactics
    );

    this.allHighlights = this.matchSimulator.getHighlights();
    this.highlightIndex = 0;
    this.currentHighlight = this.allHighlights[0] || null;
    this.highlightElapsedSec = 0;
    this.currentMinute = this.currentHighlight ? this.currentHighlight.minute : 1;
    this.matchScore = [0, 0];

    this.broadcastState();
  }

  private startHalftime() {
    this.phase = 'HALFTIME';
    this.phaseTimeLeft = 12; // 12 saniye devre arası taktik molası

    // Menajerlerin taktik hazır durumlarını sıfırla
    this.managerTactics.forEach((t) => (t.isReady = false));
    this.broadcastState();
  }

  public handleHalftimeAdjustment(sessionId: string, tacticsUpdate: Partial<ManagerTactics>) {
    if (this.phase !== 'HALFTIME') return;

    const tactics = this.managerTactics.get(sessionId);
    const manager = this.managers.get(sessionId);
    if (!tactics || !manager) return;

    if (tacticsUpdate.formation) {
      tactics.formation = tacticsUpdate.formation;
      tactics.lineup = autoAssignLineup(tacticsUpdate.formation, manager.cards);
    }
    if (tacticsUpdate.playstyle) tactics.playstyle = tacticsUpdate.playstyle;
    if (tacticsUpdate.defensiveLine) tactics.defensiveLine = tacticsUpdate.defensiveLine;
    tactics.isReady = true;

    if (this.matchSimulator) {
      this.matchSimulator.updateTactics(manager.teamIndex, tactics);
    }

    const activeManagers = Array.from(this.managers.values());
    const m0 = activeManagers.find((m) => m.teamIndex === 0) || activeManagers[0];
    const m1 = activeManagers.find((m) => m.teamIndex === 1) || activeManagers[1];
    const t0 = m0 ? this.managerTactics.get(m0.sessionId) : null;
    const t1 = m1 ? this.managerTactics.get(m1.sessionId) : null;

    const allReady = Boolean(t0?.isReady && t1?.isReady);
    if (allReady) {
      this.phaseTimeLeft = 0;
      this.startSecondHalf();
    } else {
      this.broadcastState();
    }
  }

  private startSecondHalf() {
    this.phase = 'MATCH_SECOND_HALF';
    if (this.matchSimulator) {
      this.matchSimulator.reSimulateSecondHalf();
      this.allHighlights = this.matchSimulator.getHighlights();
    }

    // İlk yarının bittiği indeksten devam et
    const nextIdx = this.allHighlights.findIndex((h) => h.minute > 45);
    this.highlightIndex = nextIdx !== -1 ? nextIdx : this.allHighlights.length - 1;
    this.currentHighlight = this.allHighlights[this.highlightIndex] || null;
    this.highlightElapsedSec = 0;

    this.broadcastState();
  }

  public handleAllOutAttack(sessionId: string) {
    if (this.phase !== 'MATCH_SECOND_HALF' || this.currentMinute < 75) return;

    const tactics = this.managerTactics.get(sessionId);
    const manager = this.managers.get(sessionId);
    if (!tactics || !manager) return;

    tactics.allOutAttack = true;
    if (this.matchSimulator) {
      this.matchSimulator.updateTactics(manager.teamIndex, tactics);
      this.matchSimulator.reSimulateSecondHalf();
      this.allHighlights = this.matchSimulator.getHighlights();
    }

    this.broadcastState();
  }

  // ==========================================
  // PHASE 4: ANALYSIS
  // ==========================================
  private finishMatchAndShowAnalysis() {
    this.phase = 'ANALYSIS';
    this.phaseTimeLeft = 30;

    const stats = this.matchSimulator?.getMatchStats();
    let winnerNick = 'Beraberlik';
    if (stats && stats.winnerTeamIndex !== -1) {
      const winnerManager = Array.from(this.managers.values()).find((m) => m.teamIndex === stats.winnerTeamIndex);
      if (winnerManager) winnerNick = winnerManager.nickname;
    }

    // Skorları oda genel durumuna aktar
    this.room.state.winnerNickname = winnerNick;
    this.broadcastState();
  }

  // ==========================================
  // MAIN TICK
  // ==========================================
  private tick(deltaSec: number) {
    if (this.isDestroyed) return;

    if (this.phase === 'AUCTION') {
      if (this.auctionEngine) {
        this.auctionEngine.tick(deltaSec);
        // Zamanlayıcı ve teklif güncellemesi için düzenli broadcast
        this.broadcastState();
      }
    } else if (this.phase === 'TACTICS') {
      this.phaseTimeLeft -= deltaSec;
      if (this.phaseTimeLeft <= 0) {
        // Kullanıcı kuralı: "iki oyuncu da hazır demeli sonrasında maça geçmeli."
        const allReady = Array.from(this.managerTactics.values()).every((t) => t.isReady);
        if (allReady) {
          this.phaseTimeLeft = 0;
          this.startFirstHalf();
        } else {
          // Eğer henüz her iki oyuncu hazır demediyse süreyi sıfırlama, oyuncuları beklemeye devam et
          this.phaseTimeLeft = 30; // 30 saniye daha ekle
          this.broadcastState();
        }
      } else {
        this.broadcastState();
      }
    } else if (this.phase === 'MATCH_FIRST_HALF' || this.phase === 'MATCH_SECOND_HALF') {
      if (!this.currentHighlight) {
        if (this.phase === 'MATCH_FIRST_HALF') {
          this.startHalftime();
        } else {
          this.finishMatchAndShowAnalysis();
        }
        return;
      }

      this.highlightElapsedSec += deltaSec;
      this.matchScore = [this.currentHighlight.scoreHome, this.currentHighlight.scoreAway];
      this.currentMinute = this.currentHighlight.minute;

      if (this.highlightElapsedSec >= this.currentHighlight.durationSec) {
        // Bu highlight tamamlandı, bir sonrakine geç
        this.highlightElapsedSec = 0;
        this.highlightIndex++;

        if (this.phase === 'MATCH_FIRST_HALF') {
          const next = this.allHighlights[this.highlightIndex];
          if (!next || next.minute > 45) {
            this.startHalftime();
            return;
          }
          this.currentHighlight = next;
        } else {
          const next = this.allHighlights[this.highlightIndex];
          if (!next) {
            this.finishMatchAndShowAnalysis();
            return;
          }
          this.currentHighlight = next;
        }
      }

      this.broadcastState();
    } else if (this.phase === 'HALFTIME') {
      this.phaseTimeLeft -= deltaSec;
      if (this.phaseTimeLeft <= 0) {
        this.phaseTimeLeft = 0;
        this.startSecondHalf();
      } else {
        this.broadcastState();
      }
    } else if (this.phase === 'ANALYSIS') {
      this.phaseTimeLeft -= deltaSec;
      if (this.phaseTimeLeft <= 0) {
        this.phaseTimeLeft = 0;
        // Maç analizi tamamlandı
      }
      this.broadcastState();
    }
  }

  public getSnapshot(): ShowdownSnapshot {
    const managerObj: Record<string, ManagerBudgetState> = {};
    this.managers.forEach((v, k) => (managerObj[k] = v));

    const tacticsObj: Record<string, ManagerTactics> = {};
    this.managerTactics.forEach((v, k) => (tacticsObj[k] = v));

    let synergies: [TeamSynergy, TeamSynergy];
    if (this.matchSimulator) {
      synergies = this.matchSimulator.getSynergies();
    } else {
      const managerList = Array.from(this.managers.values());
      const m0 = managerList.find((m) => m.teamIndex === 0) || managerList[0];
      const m1 = managerList.find((m) => m.teamIndex === 1) || managerList[1];
      const t0 = m0 ? this.managerTactics.get(m0.sessionId) : null;
      const t1 = m1 ? this.managerTactics.get(m1.sessionId) : null;
      const syn0 = (m0 && t0) ? calculateTeamSynergy(t0, m0.cards) : { attack: 75, midfield: 75, defense: 75, goalkeeping: 75, chemistry: 75, overall: 75 };
      const syn1 = (m1 && t1) ? calculateTeamSynergy(t1, m1.cards) : { attack: 75, midfield: 75, defense: 75, goalkeeping: 75, chemistry: 75, overall: 75 };
      synergies = [syn0, syn1];
    }

    let winnerNick = '';
    const stats = this.matchSimulator?.getMatchStats() || null;
    if (stats && stats.winnerTeamIndex !== -1) {
      const winnerManager = Array.from(this.managers.values()).find((m) => m.teamIndex === stats.winnerTeamIndex);
      if (winnerManager) winnerNick = winnerManager.nickname;
    }

    return {
      phase: this.phase,
      phaseTimeLeft: Math.ceil(this.phaseTimeLeft),
      managers: managerObj,
      currentLot: this.auctionEngine ? this.auctionEngine.getCurrentLot() : null,
      auctionTotalLots: this.auctionEngine ? this.auctionEngine.getTotalLotsCount() : 0,
      auctionCompletedLots: this.auctionEngine ? this.auctionEngine.getCurrentLotIndex() : 0,
      managerTactics: tacticsObj,
      teamSynergies: synergies,
      currentHighlight: this.currentHighlight,
      highlightElapsedSec: this.highlightElapsedSec,
      matchScore: this.matchScore,
      currentMinute: this.currentMinute,
      matchStats: stats,
      winnerNickname: winnerNick
    };
  }

  private broadcastState() {
    const snapshot = this.getSnapshot();
    this.room.broadcast('SHOWDOWN_SNAPSHOT', snapshot);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = undefined;
    }
  }
}
