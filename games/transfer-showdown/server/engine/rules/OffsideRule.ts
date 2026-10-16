import { EnginePlayerRuntime, OffsidePassSnapshot, PassContext, Vec2 } from '../MatchState.js';

export class OffsideRule {
  /**
   * Savunma takımının anlık durumuna göre canlı ofsayt çizgisini hesaplar.
   * attackDirection: Hücum eden takımın yönü (1: x=100'e hücum, -1: x=0'a hücum).
   */
  public static calculateLiveOffsideLine(
    defendingPlayers: EnginePlayerRuntime[],
    ballPos: Vec2,
    attackDirection: 1 | -1
  ): number {
    if (defendingPlayers.length === 0) return 50.0;

    if (attackDirection === 1) {
      // Hücum Takımı sağa (x=100) doğru hücum ediyor.
      // Savunma takımı x=100 kalesini savunuyor. En büyük x kaleye en yakın olanlardır.
      const sortedX = defendingPlayers.map((p) => p.x).sort((a, b) => b - a);
      const secondDeepest = sortedX.length >= 2 ? sortedX[1] : (sortedX[0] || 84.0);
      // Top savunma hattından daha ilerideyse ofsayt çizgisi topun hizasıdır
      const effectiveLine = Math.max(secondDeepest, ballPos.x);
      // Kendi yarı sahasında (x <= 50) ofsayt olmaz
      return Math.max(50.0, Math.min(92.0, effectiveLine));
    } else {
      // Hücum Takımı sola (x=0) doğru hücum ediyor.
      // Savunma takımı x=0 kalesini savunuyor. En küçük x kaleye en yakın olanlardır.
      const sortedX = defendingPlayers.map((p) => p.x).sort((a, b) => a - b);
      const secondDeepest = sortedX.length >= 2 ? sortedX[1] : (sortedX[0] || 16.0);
      const effectiveLine = Math.min(secondDeepest, ballPos.x);
      // Kendi yarı sahasında (x >= 50) ofsayt olmaz
      return Math.min(50.0, Math.max(8.0, effectiveLine));
    }
  }

  /**
   * Pas ayağından çıktığı milisaniyede tüm oyuncuların konumunu dondurarak
   * alıcının ofsaytta olup olmadığını kaydeder (Snapshot).
   */
  public static capturePassSnapshot(
    passer: EnginePlayerRuntime,
    receiver: EnginePlayerRuntime,
    defendingPlayers: EnginePlayerRuntime[],
    attackDirection: 1 | -1,
    ballOrigin: Vec2
  ): OffsidePassSnapshot {
    const offsideLineX = this.calculateLiveOffsideLine(defendingPlayers, ballOrigin, attackDirection);
    let isOffside = false;

    if (attackDirection === 1) {
      // Sağa hücum: Alıcı rakip yarı alanda (x > 50) olmalı, toptan ileride olmalı ve ofsideLineX'ten ileride olmalı
      if (receiver.x > 50.0 && receiver.x > ballOrigin.x && receiver.x > offsideLineX + 0.35) {
        isOffside = true;
      }
    } else {
      // Sola hücum: Alıcı rakip yarı alanda (x < 50) olmalı, toptan ileride olmalı ve ofsideLineX'ten geride olmalı
      if (receiver.x < 50.0 && receiver.x < ballOrigin.x && receiver.x < offsideLineX - 0.35) {
        isOffside = true;
      }
    }

    return {
      passerId: passer.id,
      intendedReceiverId: receiver.id,
      attackingTeam: passer.teamIndex,
      attackDirection,
      ballOrigin: { ...ballOrigin },
      offsideLineX,
      isReceiverOffsideAtPass: isOffside
    };
  }

  /**
   * Top alıcıya ulaştığı anda pas anındaki snapshot'ı kontrol eder.
   */
  public static isOffsideUponArrival(pass: PassContext, receiver: EnginePlayerRuntime): boolean {
    return pass.offsideSnapshot.isReceiverOffsideAtPass && pass.offsideSnapshot.intendedReceiverId === receiver.id;
  }
}
