import { EnginePlayerRuntime, ShotContext } from '../MatchState.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { clamp } from '../util/Geometry.js';

export type GkSaveOutcome = 'GOAL' | 'SAVE_HELD' | 'SAVE_CORNER' | 'SAVE_REBOUND';

export interface GkResolutionResult {
  outcome: GkSaveOutcome;
  commentary: string;
}

export class GoalkeeperSystem {
  public static resolveSaveAttempt(
    gk: EnginePlayerRuntime,
    shot: ShotContext,
    rng: SeededRandom
  ): GkResolutionResult {
    const eff = gk.effStats || gk.stats;
    // Kaleci güç puanı: Reflex (dri) %35, Pozisyon (def) %35, Uzanma (phy) %15, OVR %15
    const gkPower = eff.dri * 0.35 + eff.def * 0.35 + eff.phy * 0.15 + (gk.effOvr || gk.ovr) * 0.15;
    const shooterPower = shot.shooterPower ?? 78;

    // Şutör ve Kaleci arasındaki doğrudan Reyting Düellosu (Rating Duel)
    // Şutörün reytingi kaleciden yüksekse (örn: 92 SHO vs 75 GK -> diff = +17) gol şansı katlanır.
    // Kalecinin reytingi şutörden yüksekse (örn: 92 GK vs 72 SHO -> diff = -20) kaleci kalesini kapatır.
    const ratingDiff = shooterPower - gkPower;
    const ratingImpact = ratingDiff * 0.016; // 10 puan fark %16 gol/kurtarış kayması sağlar

    // xG Temelli Gol Olasılığı + Reyting Etkisi
    // Şans faktörü korunur (minimum %7 mucize kurtarış, maksimum %94 kaçınılmaz gol tavanı)
    const baseGoalProb = shot.xgAtShot * 1.52;
    const effectiveGoalProb = clamp(baseGoalProb + ratingImpact, 0.07, 0.94);

    const roll = rng.next();
    if (roll < effectiveGoalProb) {
      return {
        outcome: 'GOAL',
        commentary: 'GOOOL!'
      };
    }

    // KALECİ KURTARDI!
    gk.rating = Math.min(10.0, gk.rating + 0.35);

    // Kalecinin topu elinde tutma (catch) veya çelme (parry) kalitesi: pas + def + OVR
    const handling = eff.pas * 0.45 + eff.def * 0.35 + (gk.effOvr || gk.ovr) * 0.20;
    const holdProb = clamp(0.36 + (handling - 76.0) * 0.012 - (shooterPower - 76.0) * 0.006, 0.15, 0.75);

    if (rng.chance(holdProb)) {
      return {
        outcome: 'SAVE_HELD',
        commentary: `🧤 DEVLEŞTİ! ${gk.shortName} (${Math.round(gkPower)} OVR) köşeye giden sert şutu tek hamlede kilitledi!`
      };
    } else if (rng.chance(0.68)) {
      return {
        outcome: 'SAVE_CORNER',
        commentary: `🧤 İNANILMAZ REFLEKS! ${gk.shortName} parmaklarının ucuyla topu kornere çeldi!`
      };
    } else {
      return {
        outcome: 'SAVE_REBOUND',
        commentary: `🧤 ${gk.shortName} sert şutu güçlükle çeldi, dönen top ceza sahasına düştü!`
      };
    }
  }
}
