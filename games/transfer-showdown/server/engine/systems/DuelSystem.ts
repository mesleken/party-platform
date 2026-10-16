import { EnginePlayerRuntime, Vec2 } from '../MatchState.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { clamp, dist } from '../util/Geometry.js';

export interface TackleResult {
  success: boolean;
  isFoul: boolean;
  intercepted: boolean;
  commentary: string;
}

export class DuelSystem {
  public static resolveTackle(
    defender: EnginePlayerRuntime,
    carrier: EnginePlayerRuntime,
    rng: SeededRandom,
    simSec = 0,
    consecutiveDribbles = 0
  ): TackleResult {
    const defEff = defender.effStats || defender.stats;
    const attEff = carrier.effStats || carrier.stats;

    const defScore = defEff.def * 0.50 + defEff.phy * 0.25 + (defender.effOvr || defender.ovr) * 0.25;
    const attScore = attEff.dri * 0.50 + attEff.pac * 0.25 + (carrier.effOvr || carrier.ovr) * 0.25;

    const diff = defScore - attScore;
    // Dribbling yeteneğine göre hassasiyet
    const driPenalty = attEff.dri < 75 ? (75 - attEff.dri) * 0.010 : 0;
    const driBonus = attEff.dri >= 84 ? (attEff.dri - 84) * 0.008 : 0;

    // Üst üste çalım yorgunluğu: Aynı pozisyonda birden fazla savunmacıyı geçmeye çalışmak giderek zorlaşır
    const multiTakeOnPenalty = consecutiveDribbles * 0.16;

    // Temel müdahale şansı: 0.35'ten 0.55'e yükseltildi (nerf uygulandı)
    const tackleProb = clamp(0.55 + diff * 0.010 + driPenalty - driBonus + multiTakeOnPenalty, 0.32, 0.88);

    defender.tackleCooldownSec = 1.8;

    const roll = rng.next();
    if (roll < tackleProb) {
      // Başarılı Müdahale
      const isFoul = rng.chance(clamp(0.08 - (defEff.def - 75) * 0.002, 0.03, 0.14));
      if (isFoul) {
        defender.stunSec = 0.3;
        return {
          success: false,
          isFoul: true,
          intercepted: false,
          commentary: `⚠️ DÜDÜK! ${defender.shortName} ikili mücadelede faul yaptı, serbest vuruş.`
        };
      }

      defender.rating = Math.min(10.0, defender.rating + 0.15);
      carrier.stunSec = 0.45;
      carrier.noClaimUntil = simSec + 0.8;
      return {
        success: true,
        isFoul: false,
        intercepted: true,
        commentary: `🛡️ ${defender.shortName} usta işi bir zamanlamayla araya girdi ve topu söktü aldı!`
      };
    } else {
      // Çalım Yedi: Savunmacı dengesini kaybeder ama çok uzun süre donup kalmaz
      carrier.rating = Math.min(10.0, carrier.rating + 0.10);
      defender.stunSec = 0.28; // 0.65'ten 0.28'e düşürüldü
      defender.noClaimUntil = simSec + 0.45; // 1.2'den 0.45'e düşürüldü
      return {
        success: false,
        isFoul: false,
        intercepted: false,
        commentary: `⚡ ${carrier.shortName} klas bir çalımla ${defender.shortName}'dan sıyrıldı!`
      };
    }
  }

  /**
   * Top uçuş esnasındayken, pas koridorundaki savunmacının araya girme (interception) şansını hesaplar.
   */
  public static canInterceptPassInFlight(
    defender: EnginePlayerRuntime,
    ballPos: Vec2,
    ballHeight: number,
    rng: SeededRandom
  ): boolean {
    if (ballHeight > 1.1) return false;
    if ((defender.stunSec ?? 0) > 0.05 || (defender.tackleCooldownSec ?? 0) > 0.5) return false;

    const d = dist(defender.x, defender.y, ballPos.x, ballPos.y);
    if (d > 1.45) return false;

    const defEff = defender.effStats || defender.stats;
    const interceptProb = clamp(0.17 + (defEff.def - 76.0) * 0.0065, 0.09, 0.42);
    return rng.chance(interceptProb);
  }
}
