import {
  AuctionLot,
  CardPosition,
  ManagerBudgetState,
  PlayerCard,
  TransferPack
} from '../shared/types.js';
import { PLAYER_DATABASE } from '../shared/player-database.js';
import { SquadValidator } from './SquadValidator.js';

export class AuctionEngine {
  private packs: TransferPack[] = [];
  private currentLotIndex = 0;
  private currentLot: AuctionLot | null = null;
  private managers: Map<string, ManagerBudgetState> = new Map();
  private managerList: ManagerBudgetState[] = [];
  private readonly normalCountdownSec = 7;
  private readonly maxExtensions = 2;
  private onLotCompletedCallback?: (lot: AuctionLot) => void;
  private onAuctionFinishedCallback?: () => void;

  constructor(managers: ManagerBudgetState[]) {
    this.managerList = [...managers];
    managers.forEach((m) => this.managers.set(m.sessionId, m));
    this.preparePackPool();
  }

  /**
   * 135 kişilik zengin havuzdan 60+ Transfer Paketi oluşturulur.
   * Her pakette 4 futbolcu bulunur: [GK, DEF, MID, FWD].
   * Kullanıcı isteği: Açılış fiyatı yok, doğrudan 1 krediden başlar. Standard/Iconic yazıları yok.
   */
  private preparePackPool() {
    this.packs = [];
    const gks = [...PLAYER_DATABASE.filter((c) => c.position === 'GK')].sort(() => Math.random() - 0.5);
    const defs = [...PLAYER_DATABASE.filter((c) => c.position === 'DEF')].sort(() => Math.random() - 0.5);
    const mids = [...PLAYER_DATABASE.filter((c) => c.position === 'MID')].sort(() => Math.random() - 0.5);
    const fwds = [...PLAYER_DATABASE.filter((c) => c.position === 'FWD')].sort(() => Math.random() - 0.5);

    // En az 50-60 paket oluştur
    const packCount = Math.min(60, Math.max(gks.length, defs.length, mids.length, fwds.length) * 2);

    for (let i = 0; i < packCount; i++) {
      const gk = gks[i % gks.length];
      const def = defs[i % defs.length];
      const mid = mids[i % mids.length];
      const fwd = fwds[i % fwds.length];

      const cards: [PlayerCard, PlayerCard, PlayerCard, PlayerCard] = [gk, def, mid, fwd];
      const packNum = i + 1;

      this.packs.push({
        packIndex: i,
        packName: `PAKET #${packNum}`,
        cards,
        openingPrice: 1 // Kullanıcı isteği: Açılış fiyatı 1 kredi
      });
    }
  }

  public setCallbacks(onLotCompleted: (lot: AuctionLot) => void, onAuctionFinished: () => void) {
    this.onLotCompletedCallback = onLotCompleted;
    this.onAuctionFinishedCallback = onAuctionFinished;
  }

  public startFirstLot(): AuctionLot | null {
    this.currentLotIndex = 0;
    return this.openLot(this.currentLotIndex);
  }

  private openLot(index: number): AuctionLot | null {
    // İki menajerin de 11'er oyuncusu dolduysa açık artırma biter
    const allFull = this.managerList.length >= 2 && this.managerList.every((m) => m.rosterCount >= 11);
    if (allFull || index >= this.packs.length) {
      if (this.onAuctionFinishedCallback) this.onAuctionFinishedCallback();
      return null;
    }

    const pack = this.packs[index];
    const roundNumber = index + 1;

    // Kullanıcı kuralı:
    // "bir tur da a kullanıcısı ilk teklifi verirken diğer turda b kullanıcısı ilk teklifi vermeli."
    // "sıra kimdeyse o doğrudan 1 olan açılış teklifini yapsın."
    let turnStarter: ManagerBudgetState | undefined;
    const m0 = this.managerList[0];
    const m1 = this.managerList[1] || m0;

    if (m0.rosterCount < 11 && m1.rosterCount < 11) {
      turnStarter = (index % 2 === 0) ? m0 : m1;
    } else if (m0.rosterCount < 11) {
      turnStarter = m0;
    } else if (m1.rosterCount < 11) {
      turnStarter = m1;
    } else {
      if (this.onAuctionFinishedCallback) this.onAuctionFinishedCallback();
      return null;
    }

    // Her iki menajer de bütçe şartı yettiği sürece teklif verebilir
    const allowed = this.managerList.filter((m) => m.rosterCount < 11).map((m) => m.sessionId);

    this.currentLot = {
      lotIndex: index,
      roundNumber,
      turnStarterId: turnStarter.sessionId,
      pack,
      card: pack.cards[0],
      currentBid: 1, // Sıra kimdeyse doğrudan 1 olan açılış teklifini yapar
      highestBidderId: turnStarter.sessionId,
      highestBidderName: turnStarter.nickname,
      timeLeft: this.normalCountdownSec,
      isCompleted: false,
      winnerId: null,
      finalPrice: 0,
      passedManagers: [],
      isUnsold: false,
      isPickingPlayer: false,
      pickingTimeLeft: 0,
      selectedCardId: null,
      extensionCount: 0,
      allowedBidders: allowed
    };

    // Menajerlerin pas durumlarını sıfırla ve bütçelerini güncelle
    this.managers.forEach((m) => {
      m.hasPassedCurrentLot = false;
      this.recalculateAvailableBid(m);
      m.isBiddingLockedByLead = false; // Bütçe farkı teklifi engellemez
    });

    return this.currentLot;
  }

  public tick(deltaSec: number): { lotFinished: boolean; auctionFinished: boolean } {
    if (!this.currentLot) {
      return { lotFinished: false, auctionFinished: false };
    }

    // 1. Durum: Kazanan oyuncu seçiyor (Drafting)
    if (this.currentLot.isPickingPlayer) {
      this.currentLot.pickingTimeLeft -= deltaSec;
      if (this.currentLot.pickingTimeLeft <= 0) {
        this.currentLot.pickingTimeLeft = 0;
        this.autoPickForWinner();
        const allDone = this.managerList.every((m) => m.rosterCount >= 11);
        return { lotFinished: true, auctionFinished: allDone };
      }
      return { lotFinished: false, auctionFinished: false };
    }

    // 2. Durum: Teklif sayacı
    if (!this.currentLot.isCompleted) {
      this.currentLot.timeLeft -= deltaSec;
      if (this.currentLot.timeLeft <= 0) {
        this.currentLot.timeLeft = 0;
        this.finalizeBiddingPhase();
        if (this.currentLot.isUnsold) {
          const allDone = this.managerList.every((m) => m.rosterCount >= 11);
          return { lotFinished: true, auctionFinished: allDone };
        }
      }
    }

    return { lotFinished: false, auctionFinished: false };
  }

  public placeBid(sessionId: string, increment: 1 | 5): { success: boolean; message?: string } {
    if (!this.currentLot || this.currentLot.isCompleted || this.currentLot.isPickingPlayer) {
      return { success: false, message: 'Aktif bir açık artırma yok.' };
    }

    const manager = this.managers.get(sessionId);
    if (!manager) return { success: false, message: 'Menajer bulunamadı.' };

    if (manager.rosterCount >= 11) {
      return { success: false, message: 'Kadronuz 11 kişi ile dolu.' };
    }

    const { canBid, maxBid, reason } = SquadValidator.calculateMaxBid(manager, this.currentLot.pack.cards);
    if (!canBid) {
      return { success: false, message: reason };
    }

    const targetBid = this.currentLot.currentBid + increment;

    if (targetBid > maxBid) {
      return {
        success: false,
        message: `Maksimum bütçeniz (${maxBid} cr) bu teklifi (${targetBid} cr) karşılamıyor.`
      };
    }
    if (targetBid > 30) {
      return {
        success: false,
        message: 'Tek bir oyuncu için tavan fiyat 30 kredidir.'
      };
    }

    // Teklifi uygula
    this.currentLot.currentBid = targetBid;
    this.currentLot.highestBidderId = sessionId;
    this.currentLot.highestBidderName = manager.nickname;

    this.currentLot.passedManagers = this.currentLot.passedManagers.filter((id) => id !== sessionId);
    manager.hasPassedCurrentLot = false;

    // Anti-sniping: Son 2 saniyede teklif gelirse +2s uzat (max 2 kez)
    if (this.currentLot.timeLeft <= 2 && this.currentLot.extensionCount < this.maxExtensions) {
      this.currentLot.timeLeft = Math.min(this.normalCountdownSec, this.currentLot.timeLeft + 2);
      this.currentLot.extensionCount++;
    }

    return { success: true };
  }

  /**
   * "Rakibe Bırak / Pas":
   * Rakip teklif vermişse anında kapanır ve rakip mevcut fiyattan alır!
   */
  public forfeitLot(sessionId: string): { success: boolean; immediateClose: boolean } {
    if (!this.currentLot || this.currentLot.isCompleted || this.currentLot.isPickingPlayer) {
      return { success: false, immediateClose: false };
    }

    const manager = this.managers.get(sessionId);
    if (manager) manager.hasPassedCurrentLot = true;

    if (!this.currentLot.passedManagers.includes(sessionId)) {
      this.currentLot.passedManagers.push(sessionId);
    }

    // Rakip teklif vermişse anında kapat ve rakibe ver
    if (this.currentLot.highestBidderId && this.currentLot.highestBidderId !== sessionId) {
      this.finalizeBiddingPhase();
      return { success: true, immediateClose: true };
    }

    return { success: true, immediateClose: false };
  }

  private finalizeBiddingPhase() {
    if (!this.currentLot || this.currentLot.isCompleted) return;

    if (this.currentLot.highestBidderId) {
      this.currentLot.winnerId = this.currentLot.highestBidderId;
      this.currentLot.finalPrice = this.currentLot.currentBid;
      this.currentLot.isPickingPlayer = true;
      this.currentLot.pickingTimeLeft = 8; // 8 saniye seçim süresi
    } else {
      this.currentLot.isCompleted = true;
      this.currentLot.isUnsold = true;
      this.currentLot.finalPrice = 0;
      if (this.onLotCompletedCallback) {
        this.onLotCompletedCallback(this.currentLot);
      }
    }
  }

  public pickPlayer(sessionId: string, cardId: string): { success: boolean; message?: string } {
    if (!this.currentLot || !this.currentLot.isPickingPlayer) {
      return { success: false, message: 'Şu anda oyuncu seçme aşamasında değilsiniz.' };
    }

    if (this.currentLot.winnerId !== sessionId) {
      return { success: false, message: 'Bu paketi siz kazanmadınız.' };
    }

    const winner = this.managers.get(sessionId);
    if (!winner) return { success: false, message: 'Menajer bulunamadı.' };

    const card = this.currentLot.pack.cards.find((c) => c.id === cardId);
    if (!card) {
      return { success: false, message: 'Seçilen futbolcu bu pakette yok.' };
    }

    const { canPick, reason } = SquadValidator.canPickCard(winner, card);
    if (!canPick) {
      return { success: false, message: reason };
    }

    this.applyPlayerPick(winner, card);
    return { success: true };
  }

  private autoPickForWinner() {
    if (!this.currentLot || !this.currentLot.winnerId) return;

    const winner = this.managers.get(this.currentLot.winnerId);
    if (!winner) return;

    const eligible = this.currentLot.pack.cards
      .filter((c) => SquadValidator.canPickCard(winner, c).canPick)
      .sort((a, b) => b.ovr - a.ovr);

    let chosen = eligible[0];
    if (!chosen) {
      // Eğer paketteki hiçbir kart kurala uymuyorsa, kadroda en çok ihtiyaç duyulan mevkiden bir kart bul
      const cards = winner.cards || [];
      const countDEF = cards.filter((c) => c.position === 'DEF').length;
      const countMID = cards.filter((c) => c.position === 'MID').length;
      const neededDEF = Math.max(0, 3 - countDEF);
      const neededMID = Math.max(0, 3 - countMID);

      let targetPos: CardPosition = 'DEF';
      if (neededDEF > 0) targetPos = 'DEF';
      else if (neededMID > 0) targetPos = 'MID';
      else targetPos = 'FWD';

      chosen = this.currentLot.pack.cards.find((c) => c.position === targetPos) || this.currentLot.pack.cards[0];
    }

    this.applyPlayerPick(winner, chosen);
  }

  private applyPlayerPick(winner: ManagerBudgetState, card: PlayerCard) {
    if (!this.currentLot) return;

    this.currentLot.card = card;
    this.currentLot.selectedCardId = card.id;
    this.currentLot.isPickingPlayer = false;
    this.currentLot.isCompleted = true;

    // Bütçeden düş ve kadroya ekle
    winner.budget -= this.currentLot.finalPrice;
    winner.cards.push(card);
    winner.rosterCount = winner.cards.length;
    winner.positionCounts[card.position]++;
    if (winner.rosterCount >= 11) {
      winner.isSquadFull = true;
    }
    this.recalculateAvailableBid(winner);

    if (this.onLotCompletedCallback) {
      this.onLotCompletedCallback(this.currentLot);
    }
  }

  public advanceToNextLot(): AuctionLot | null {
    this.currentLotIndex++;
    return this.openLot(this.currentLotIndex);
  }

  private recalculateAvailableBid(manager: ManagerBudgetState) {
    manager.availableMaxBid = SquadValidator.calculateMaxAffordableBid(manager);
  }

  public getCurrentLot(): AuctionLot | null {
    return this.currentLot;
  }

  public getTotalLotsCount(): number {
    return this.packs.length;
  }

  public getCurrentLotIndex(): number {
    return this.currentLotIndex;
  }

  public getManagers(): Map<string, ManagerBudgetState> {
    return this.managers;
  }
}
