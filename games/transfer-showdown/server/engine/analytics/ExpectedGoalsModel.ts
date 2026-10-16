import { Vec2 } from '../MatchState.js';

export interface XgCalculationInput {
  shooterPos: Vec2;
  goalX: number; // 97 veya 3
  shotType: 'NORMAL' | 'HEADER' | 'VOLLEY' | 'LONG_SHOT';
  shooterSho: number; // 50..99
  defenderProximity: number; // en yakın savunmacıya mesafe
  isOneOnOne: boolean;
}

export class ExpectedGoalsModel {
  public static calculateXg(input: XgCalculationInput): number {
    const sx = input.shooterPos.x;
    const sy = input.shooterPos.y;
    const gx = input.goalX;

    // Kale direkleri: Y = 28.0 (üst direk) ve Y = 36.0 (alt direk)
    const v1x = gx - sx;
    const v1y = 28.0 - sy;
    const v2x = gx - sx;
    const v2y = 36.0 - sy;

    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);

    let angle = 0.2;
    if (mag1 > 0.1 && mag2 > 0.1) {
      const dot = v1x * v2x + v1y * v2y;
      const cosVal = Math.max(-1.0, Math.min(1.0, dot / (mag1 * mag2)));
      angle = Math.acos(cosVal); // radyan
    }

    const distToCenter = Math.hypot(gx - sx, 32.0 - sy);

    // Temel geometrik xG (açı genişliği ve ceza sahası mesafesi)
    let base = 0.12;
    if (distToCenter <= 8.0) {
      base = 0.42 + (angle / Math.PI) * 0.35; // 6-pas içi ve penaltı noktası önü: 0.45..0.60
    } else if (distToCenter <= 16.5) {
      base = 0.22 + (angle / Math.PI) * 0.28; // Ceza sahası içi: 0.24..0.38
    } else if (distToCenter <= 24.0) {
      base = 0.10 + (angle / Math.PI) * 0.12; // Ceza sahası yayı: 0.11..0.16
    } else {
      base = 0.04 + (angle / Math.PI) * 0.06; // Uzak mesafe: 0.04..0.07
    }

    let modifier = 1.0;

    // Vuruş türü etkisi
    if (input.shotType === 'HEADER') modifier *= 0.78;
    else if (input.shotType === 'VOLLEY') modifier *= 0.88;

    // Kaleciyle karşı karşıya bonusu (1v1)
    if (input.isOneOnOne) modifier *= 1.45;

    // Yakın savunma blokajı baskısı
    if (input.defenderProximity < 3.0) {
      modifier *= 0.78;
    } else if (input.defenderProximity < 5.5) {
      modifier *= 0.90;
    }

    // Şutörün bitiricilik ve şut kalitesi (stats.sho)
    const statFactor = 0.80 + (input.shooterSho - 70.0) * 0.012;
    modifier *= Math.max(0.65, Math.min(1.40, statFactor));

    const finalXg = Math.max(0.04, Math.min(0.95, base * modifier));
    return Number(finalXg.toFixed(2));
  }
}
