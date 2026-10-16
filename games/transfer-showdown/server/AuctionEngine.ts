import {
  AuctionLot,
  CardPosition,
  ManagerBudgetState,
  PlayerCard,
  TransferPack
} from '../shared/types.js';
import { PLAYER_DATABASE } from '../shared/player-database.js';
import { SquadValidator } from './SquadValidator.js';

export class ShuffledDeck<T> {
  private items: T[];
  private currentIndex: number = 0;

  constructor(source: T[]) {
    this.items = [...source];
    this.shuffle();
  }

  public shuffle(): void {
    for (let i = this.items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
    this.currentIndex = 0;
  }

  public draw(): T {
    if (this.currentIndex >= this.items.length) {
      this.shuffle();
    }
    return this.items[this.currentIndex++];
  }
}

/**
 * Ağırlıklı Kart Destesi:
 * - Elit ve yüksek reytingli yıldız oyuncuların (90+, 87+, İkonlar) paketlerde çıkma şansını belirgin şekilde artırır.
 * - Süper Lig'in 4 Büyükler kulüplerindeki (Galatasaray, Fenerbahçe, Beşiktaş, Trabzonspor) oyuncuların çıkma şansını katlar.
 * - Yurt dışındaki popüler Türk yıldızlarını (Arda Güler, Kenan Yıldız, Hakan Çalhanoğlu vb.) öne çıkarır.
 * - Fisher-Yates karıştırması ve son çekilen kart hafızası sayesinde aynı kartların üst üste tekrar etmesini engeller.
 */
export class WeightedCardDeck {
  private pool: PlayerCard[];
  private shuffled: PlayerCard[] = [];
  private currentIndex: number = 0;
  private recentIds: string[] = [];
  private readonly maxRecentMemory = 16;

  constructor(baseCards: PlayerCard[]) {
    this.pool = this.buildWeightedPool(baseCards);
    this.shuffle();
  }

  private buildWeightedPool(cards: PlayerCard[]): PlayerCard[] {
    const weighted: PlayerCard[] = [];
    for (const card of cards) {
      const weight = this.calculateCardWeight(card);
      for (let w = 0; w < weight; w++) {
        weighted.push(card);
      }
    }
    return weighted;
  }

  private calculateCardWeight(card: PlayerCard): number {
    const clubLower = card.club.toLowerCase();
    const isBig4 =
      clubLower.includes('galatasaray') ||
      clubLower.includes('fenerbah') ||
      clubLower.includes('beşiktaş') ||
      clubLower.includes('besiktas') ||
      clubLower.includes('trabzon');

    const isTurkStar = card.nationality === 'Türkiye' && card.ovr >= 76 && !isBig4;

    let ratingWeight = 1.0;
    if (card.category === 'icon') {
      ratingWeight = 3.6;
    } else if (card.ovr >= 90) {
      ratingWeight = 3.8;
    } else if (card.ovr >= 87) {
      ratingWeight = 3.0;
    } else if (card.ovr >= 84) {
      ratingWeight = 2.2;
    } else if (card.ovr >= 82) {
      ratingWeight = 1.6;
    } else if (card.ovr >= 80) {
      ratingWeight = 1.2;
    } else if (card.ovr >= 78) {
      ratingWeight = 0.9;
    } else {
      ratingWeight = 0.6;
    }

    let multiplier = 1.0;
    if (isBig4) {
      multiplier *= 3.5;
    } else if (isTurkStar) {
      multiplier *= 2.4;
    }

    return Math.max(1, Math.round(ratingWeight * multiplier * 2));
  }

  public shuffle(): void {
    this.shuffled = [...this.pool];
    for (let i = this.shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffled[i], this.shuffled[j]] = [this.shuffled[j], this.shuffled[i]];
    }
    this.currentIndex = 0;
  }

  public draw(): PlayerCard {
    if (this.currentIndex >= this.shuffled.length) {
      this.shuffle();
    }

    // Aday kartı çek; eğer son 16 pakette yakın zamanda çıktıysa ve destede alternatif varsa sonraya aktar
    let pickedIndex = this.currentIndex;
    let attempts = 0;
    while (
      attempts < 12 &&
      pickedIndex < this.shuffled.length &&
      this.recentIds.includes(this.shuffled[pickedIndex].id)
    ) {
      pickedIndex++;
      attempts++;
    }

    if (pickedIndex >= this.shuffled.length) {
      pickedIndex = this.currentIndex;
    }

    const card = this.shuffled[pickedIndex];
    if (pickedIndex !== this.currentIndex) {
      this.shuffled[pickedIndex] = this.shuffled[this.currentIndex];
      this.shuffled[this.currentIndex] = card;
    }
    this.currentIndex++;

    this.recentIds.push(card.id);
    if (this.recentIds.length > this.maxRecentMemory) {
      this.recentIds.shift();
    }

    return card;
  }
}

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

  private gkDeck!: WeightedCardDeck;
  private defDeck!: WeightedCardDeck;
  private midDeck!: WeightedCardDeck;
  private fwdDeck!: WeightedCardDeck;

  constructor(managers: ManagerBudgetState[]) {
    this.managerList = [...managers];
    managers.forEach((m) => this.managers.set(m.sessionId, m));
    this.initDecks();
    this.preparePackPool();
  }

  private initDecks() {
    this.gkDeck = new WeightedCardDeck(PLAYER_DATABASE.filter((c) => c.position === 'GK'));
    this.defDeck = new WeightedCardDeck(PLAYER_DATABASE.filter((c) => c.position === 'DEF'));
    this.midDeck = new WeightedCardDeck(PLAYER_DATABASE.filter((c) => c.position === 'MID'));
    this.fwdDeck = new WeightedCardDeck(PLAYER_DATABASE.filter((c) => c.position === 'FWD'));
  }

  public generatePack(index: number): TransferPack {
    const gk = this.gkDeck.draw();
    const def = this.defDeck.draw();
    const mid = this.midDeck.draw();
    const fwd = this.fwdDeck.draw();

    return {
      packIndex: index,
      packName: `PAKET #${index + 1}`,
      cards: [gk, def, mid, fwd],
      openingPrice: 1
    };
  }

  /**
   * 240+ kişilik genişletilmiş ve güncel havuzdan tamamen rastgele Transfer Paketleri oluşturulur.
   * Fisher-Yates algoritması ile her pozisyon destesi bağımsızca karıştırılır.
   * Her pakette 4 futbolcu bulunur: [GK, DEF, MID, FWD].
   * Kullanıcı isteği: Açılış teklifi 1 kredi, her defasında tamamen random paketler.
   */
  private preparePackPool() {
    this.packs = [];
    const initialPackCount = 100;
    for (let i = 0; i < initialPackCount; i++) {
      this.packs.push(this.generatePack(i));
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
    if (allFull) {
      if (this.onAuctionFinishedCallback) this.onAuctionFinishedCallback();
      return null;
    }

    // Gerekirse havuzdan yeni rastgele paket üret (asla tükenmez)
    while (index >= this.packs.length) {
      this.packs.push(this.generatePack(this.packs.length));
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
