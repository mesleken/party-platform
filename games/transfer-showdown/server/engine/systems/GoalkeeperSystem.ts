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
    // Kaleci güç puanı: Reflex (dri) %35, Pozisyon (def) %35, Uzanma (phy) %20, OVR %10
    const gkPower = eff.dri * 0.35 + eff.def * 0.35 + eff.phy * 0.20 + (gk.effOvr || gk.ovr) * 0.10;
    const gkFactor = (gkPower - 80.0) * 0.0075;

    // Şut kaleyi bulduğu (isOnTarget) koşulu altında gol olasılığı: P(Goal) = P(OnTarget) * P(Goal | OnTarget) ≈ xG
    const effectiveGoalProb = clamp(shot.xgAtShot * 1.56 - gkFactor, 0.11, 0.74);

    const roll = rng.next();
    if (roll < effectiveGoalProb) {
      return {
        outcome: 'GOAL',
        commentary: 'GOOOL!'
      };
    }

    // KALECİ KURTARDI!
    gk.rating = Math.min(10.0, gk.rating + 0.35);

    const handling = eff.pas * 0.6 + (gk.effOvr || gk.ovr) * 0.4;
    const holdProb = clamp(0.38 + (handling - 76.0) * 0.009, 0.22, 0.68);

    if (rng.chance(holdProb)) {
      return {
        outcome: 'SAVE_HELD',
        commentary: `🧤 DEVLEŞTİ! ${gk.shortName} köşeye giden şutu uzanarak kontrol etti!`
      };
    } else if (rng.chance(0.66)) {
      return {
        outcome: 'SAVE_CORNER',
        commentary: `🧤 İNANILMAZ REFLEKS! ${gk.shortName} parmaklarının ucuyla topu kornere çeldi!`
      };
    } else {
      return {
        outcome: 'SAVE_REBOUND',
        commentary: `🧤 ${gk.shortName} sert şutu çeldi, dönen top ceza sahasına düştü!`
      };
    }
  }
}
