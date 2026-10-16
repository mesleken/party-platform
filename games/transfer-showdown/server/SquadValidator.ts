import { CardPosition, ManagerBudgetState, PlayerCard } from '../shared/types.js';
import { PLAYER_DATABASE } from '../shared/player-database.js';

/**
 * Kullanıcı Tarafından Belirlenen Kadro Kuralları:
 * - Kaleci (GK): Sadece ve zorunlu olarak 1 adet (min 1, max 1)
 * - Savunma (DEF): En az 3, en çok 5 adet (min 3, max 5)
 * - Orta Saha (MID): En az 3, en çok 5 adet (min 3, max 5)
 * - Forvet (FWD): En az 1, en çok 3 adet (min 1, max 3)
 * Toplam Kadro: Tam 11 futbolcu
 */
export const MANDATORY_QUOTAS: Record<CardPosition, { min: number; max: number }> = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 3, max: 5 },
  FWD: { min: 1, max: 3 }
};

export class SquadValidator {
  /**
   * Bütçe Koruması:
   * Her futbolcunun minimum bedeli 1 kredidir.
   * R = 11 - (N + 1) -> Bu alımdan sonra kalan boş yuvalar
   * Rezerv = R * 1 kredi
   * Maksimum Teklif = min(30, B - Rezerv)
   */
  static calculateMaxAffordableBid(manager: ManagerBudgetState): number {
    if (manager.isSquadFull || manager.rosterCount >= 11) {
      return 0;
    }
    const n = manager.rosterCount;
    const r = Math.max(0, 11 - (n + 1));
    const reserve = r * 1; // Her boş yuvaya en az 1 kredi
    const affordable = manager.budget - reserve;
    return Math.max(0, Math.min(30, affordable));
  }

  /**
   * Menajerin pakete teklif verip veremeyeceğini ve verebileceği maksimum teklifi hesaplar.
   * Kullanıcı isteği: "Arada bütçe farkı olsa da kullanıcı oyunculara teklif verebilmeli."
   */
  static calculateMaxBid(
    manager: ManagerBudgetState,
    candidateCards?: PlayerCard[]
  ): { canBid: boolean; maxBid: number; reason?: string } {
    if (manager.isSquadFull || manager.rosterCount >= 11) {
      return { canBid: false, maxBid: 0, reason: 'Kadro 11 kişiye ulaştı, daha fazla oyuncu alamazsınız.' };
    }

    const maxAffordable = this.calculateMaxAffordableBid(manager);
    if (maxAffordable < 1) {
      return {
        canBid: false,
        maxBid: 0,
        reason: 'Bütçe koruması: Kalan yuvalar için en az 1 kredi rezerve ayrıldığından teklif veremezsiniz.'
      };
    }

    // Paketteki kartlardan en az 1 tanesini seçme hakkı olmalıdır
    if (candidateCards && candidateCards.length > 0) {
      const hasAnyEligibleCard = candidateCards.some((card) => this.canPickCard(manager, card).canPick);
      if (!hasAnyEligibleCard) {
        return {
          canBid: false,
          maxBid: 0,
          reason: 'Bu paketteki tüm futbolcular mevkii kotanıza (GK:1, DEF:5, MID:5, FWD:3) takılıyor.'
        };
      }
    }

    return {
      canBid: true,
      maxBid: maxAffordable
    };
  }

  /**
   * Paketi kazanan menajerin 4 futbolcudan belirli birini seçip seçemeyeceğini kontrol eder:
   * 1. Kaleci Tam 1 (GK >= 1 ise yeni kaleci ALINAMAZ).
   * 2. Maksimum sınırlar: DEF en çok 5, MID en çok 5, FWD en çok 3.
   * 3. Asgari zorunluluklar: Seçim sonrası kalan boş yuvalar diğer pozisyonların minimumlarını karşılamalıdır.
   */
  static canPickCard(
    manager: ManagerBudgetState,
    card: PlayerCard
  ): { canPick: boolean; reason?: string } {
    // 1. Kadro kartlarını doğrudan hesapla (asenkron durum gecikmelerini ve senkronizasyon kaymalarını engeller)
    const cards = Array.isArray(manager.cards) && manager.cards.length > 0 ? manager.cards : [];
    const countGK = cards.length > 0 ? cards.filter((c) => c.position === 'GK').length : (manager.positionCounts?.GK || 0);
    const countDEF = cards.length > 0 ? cards.filter((c) => c.position === 'DEF').length : (manager.positionCounts?.DEF || 0);
    const countMID = cards.length > 0 ? cards.filter((c) => c.position === 'MID').length : (manager.positionCounts?.MID || 0);
    const countFWD = cards.length > 0 ? cards.filter((c) => c.position === 'FWD').length : (manager.positionCounts?.FWD || 0);
    const totalCount = cards.length > 0 ? cards.length : (manager.rosterCount || 0);

    if (totalCount >= 11 || manager.isSquadFull) {
      return { canPick: false, reason: 'Kadro zaten 11 kişi ile dolu.' };
    }

    // 2. Üst sınırlar (Maksimum Kotalar: GK: 1, DEF: 5, MID: 5, FWD: 3)
    if (card.position === 'GK' && countGK >= MANDATORY_QUOTAS.GK.max) {
      return { canPick: false, reason: 'Sadece 1 kaleci alabilirsiniz. Kaleci kotanız dolu (1/1).' };
    }
    if (card.position === 'DEF' && countDEF >= MANDATORY_QUOTAS.DEF.max) {
      return { canPick: false, reason: `En fazla ${MANDATORY_QUOTAS.DEF.max} defans alabilirsiniz. Defans kotanız dolu.` };
    }
    if (card.position === 'MID' && countMID >= MANDATORY_QUOTAS.MID.max) {
      return { canPick: false, reason: `En fazla ${MANDATORY_QUOTAS.MID.max} orta saha alabilirsiniz. Orta saha kotanız dolu.` };
    }
    if (card.position === 'FWD' && countFWD >= MANDATORY_QUOTAS.FWD.max) {
      return { canPick: false, reason: `En fazla ${MANDATORY_QUOTAS.FWD.max} forvet alabilirsiniz. Forvet kotanız dolu.` };
    }

    // 3. Kalan boş yuvalar ve eksik zorunlu pozisyonlar
    const remainingSlotsBeforePick = 11 - totalCount; // Örn: 10 oyuncusu olan menajerin 1 boşluğu kaldı
    const neededGK = Math.max(0, MANDATORY_QUOTAS.GK.min - countGK);
    const neededDEF = Math.max(0, MANDATORY_QUOTAS.DEF.min - countDEF);
    const neededMID = Math.max(0, MANDATORY_QUOTAS.MID.min - countMID);
    const neededFWD = Math.max(0, MANDATORY_QUOTAS.FWD.min - countFWD);
    const totalMandatoryNeeded = neededGK + neededDEF + neededMID + neededFWD;

    // KATI KURAL: Kalan boş yuva sayısı, tamamlanması zorunlu olan eksik sayısına eşit veya daha az ise;
    // SADECE ve SADECE eksik olan pozisyonlardan oyuncu seçilebilir!
    // Örneğin 10 oyuncu varken (1 GK, 2 DEF, 5 MID, 2 FWD) 1 yuva kaldı ve neededDEF = 1.
    // Bu durumda FWD, MID, GK KESİNLİKLE SEÇİLEMEZ, SADECE DEF SEÇİLEBİLİR!
    if (remainingSlotsBeforePick <= totalMandatoryNeeded) {
      const isPositionStillNeeded = 
        (card.position === 'GK' && neededGK > 0) ||
        (card.position === 'DEF' && neededDEF > 0) ||
        (card.position === 'MID' && neededMID > 0) ||
        (card.position === 'FWD' && neededFWD > 0);

      if (!isPositionStillNeeded) {
        const requiredPositions: string[] = [];
        if (neededGK > 0) requiredPositions.push(`Kaleci (${neededGK})`);
        if (neededDEF > 0) requiredPositions.push(`Defans (en az 3 için ${neededDEF} daha lazım)`);
        if (neededMID > 0) requiredPositions.push(`Orta Saha (en az 3 için ${neededMID} daha lazım)`);
        if (neededFWD > 0) requiredPositions.push(`Forvet (en az 1 için ${neededFWD} daha lazım)`);
        return {
          canPick: false,
          reason: `Zorunlu kadro kuralı: Kalan ${remainingSlotsBeforePick} hakkınızda mutlaka eksik olan ${requiredPositions.join(', ')} mevkisini seçmelisiniz!`
        };
      }
    }

    // 4. Bu seçim yapıldıktan sonra diğer asgari şartların karşılanabilmesi kontrolü
    const remainingSlotsAfter = remainingSlotsBeforePick - 1;
    const afterGK = countGK + (card.position === 'GK' ? 1 : 0);
    const afterDEF = countDEF + (card.position === 'DEF' ? 1 : 0);
    const afterMID = countMID + (card.position === 'MID' ? 1 : 0);
    const afterFWD = countFWD + (card.position === 'FWD' ? 1 : 0);

    const remNeededGK = Math.max(0, MANDATORY_QUOTAS.GK.min - afterGK);
    const remNeededDEF = Math.max(0, MANDATORY_QUOTAS.DEF.min - afterDEF);
    const remNeededMID = Math.max(0, MANDATORY_QUOTAS.MID.min - afterMID);
    const remNeededFWD = Math.max(0, MANDATORY_QUOTAS.FWD.min - afterFWD);
    const remTotalNeeded = remNeededGK + remNeededDEF + remNeededMID + remNeededFWD;

    if (remainingSlotsAfter < remTotalNeeded) {
      return {
        canPick: false,
        reason: `Zorunlu pozisyon kısıtı: Bu seçimden sonra kalan ${remainingSlotsAfter} yuva ile eksik pozisyonlar tamamlanamaz.`
      };
    }

    return { canPick: true };
  }

  /**
   * Eğer açık artırma bittiğinde kadroda 11 oyuncu tamamlanamamışsa,
   * eksikleri kurallara (GK:1, DEF:3-5, MID:3-5, FWD:1-3) uygun tamamlar.
   */
  static fillMissingSlots(manager: ManagerBudgetState): PlayerCard[] {
    const existingIds = new Set(manager.cards.map((c) => c.id));
    const added: PlayerCard[] = [];

    const pickCard = (pos: CardPosition): PlayerCard | undefined => {
      return PLAYER_DATABASE.find((c) => c.position === pos && !existingIds.has(c.id));
    };

    // 1. Önce asgari şartları tamamla: GK (1), DEF (3), MID (3), FWD (1)
    if (manager.positionCounts.GK < 1) {
      const card = pickCard('GK');
      if (card) {
        existingIds.add(card.id);
        added.push(card);
        manager.positionCounts.GK++;
      }
    }
    while (manager.positionCounts.DEF + added.filter(c => c.position === 'DEF').length < MANDATORY_QUOTAS.DEF.min) {
      const card = pickCard('DEF');
      if (card) {
        existingIds.add(card.id);
        added.push(card);
      } else break;
    }
    while (manager.positionCounts.MID + added.filter(c => c.position === 'MID').length < MANDATORY_QUOTAS.MID.min) {
      const card = pickCard('MID');
      if (card) {
        existingIds.add(card.id);
        added.push(card);
      } else break;
    }
    while (manager.positionCounts.FWD + added.filter(c => c.position === 'FWD').length < MANDATORY_QUOTAS.FWD.min) {
      const card = pickCard('FWD');
      if (card) {
        existingIds.add(card.id);
        added.push(card);
      } else break;
    }

    // 2. Halen 11 olmadıysa, üst sınırları aşmadan (DEF max 5, MID max 5, FWD max 3) tamamla
    const order: CardPosition[] = ['MID', 'DEF', 'FWD'];
    let orderIdx = 0;
    while (manager.cards.length + added.length < 11) {
      const pos = order[orderIdx % order.length];
      orderIdx++;
      const currentPosCount = manager.positionCounts[pos] + added.filter(c => c.position === pos).length;
      if (currentPosCount < MANDATORY_QUOTAS[pos].max) {
        const card = pickCard(pos);
        if (card) {
          existingIds.add(card.id);
          added.push(card);
        }
      }
    }

    return added;
  }
}
