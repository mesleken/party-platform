import { EnginePlayerRuntime, EngineTeamRuntime, PassContext, Vec2 } from '../MatchState.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { OffsideRule } from '../rules/OffsideRule.js';
import { getRoleProfile } from '../tactics/RoleBehavior.js';
import { clamp, dist, fromOwn, segmentClosest, toOwn } from '../util/Geometry.js';

export interface PassArrivalResult {
  success: boolean;
  isOffside: boolean;
  receiver: EnginePlayerRuntime;
  commentary?: string;
}

export class PassingSystem {
  /**
   * Takım arkadaşları arasından en uygun pas hedefini ve pas türünü seçer.
   * Gereksiz geri pasları ve kaleciye anlamsız dönüşleri engeller; taktiksel hücum planına (AttackPlan)
   * ve oyuncunun pas/vizyon reytingine (effStats.pas) göre dikine, diyagonal, verkaç ve kilit paslar üretir.
   */
  public static selectBestPassTarget(
    passer: EnginePlayerRuntime,
    teammates: EnginePlayerRuntime[],
    opponents: EnginePlayerRuntime[],
    team: EngineTeamRuntime,
    rng: SeededRandom,
    lastPasserId?: string | null
  ): { target: EnginePlayerRuntime; passType: PassContext['passType'] } {
    const dir = team.attackDirection;
    const style = team.style;
    const plan = team.plan;
    const passerEff = passer.effStats || passer.stats;
    const visionBonus = (passerEff.pas - 72) / 25; // -0.5 .. +1.0

    const passerOwnP = toOwn(passer.x, dir);
    const isPasserGK = passer.roleGroup === 'GK';

    // Taşıyıcı üzerindeki anlık baskı
    let nearestOppDist = 999;
    for (const o of opponents) {
      const d = dist(o.x, o.y, passer.x, passer.y);
      if (d < nearestOppDist) nearestOppDist = d;
    }
    const underHeavyPressure = nearestOppDist < 2.8;

    // Kaleci harici saha içi adaylar (Kaleciye geri pası tamamen devre dışı bırak)
    const outfieldMates = teammates.filter((m) => m.id !== passer.id && m.roleGroup !== 'GK');
    const pool = outfieldMates.length > 0 ? outfieldMates : teammates.filter((m) => m.id !== passer.id);

    // En yakın güvenli saha içi oyuncuyu varsayılan aday yap (asla teammates[0] = GK olmasın!)
    let bestCandidate = pool[0] || teammates[0];
    let bestScore = -9999.0;
    let chosenPassType: PassContext['passType'] = 'SHORT';

    const offsideLineX = OffsideRule.calculateLiveOffsideLine(opponents, { x: passer.x, y: passer.y }, dir);
    const offsideLineP = toOwn(offsideLineX, dir);

    for (const mate of pool) {
      const mateProfile = getRoleProfile(mate.role);
      const d = dist(mate.x, mate.y, passer.x, passer.y);

      if (d < 3.2) continue;
      const maxRange = isPasserGK ? 58.0 : (44.0 + Math.max(0, visionBonus) * 14.0);
      if (d > maxRange) continue;

      // Alıcının o anki konumu ve koşu hedefi (hangisi daha ilerideyse)
      const mateCurrP = toOwn(mate.x, dir);
      const mateTargetP = toOwn(mate.targetX, dir);
      const effectiveMateP = mate.action === 'SPRINT_RUN' ? lerpPassP(mateCurrP, mateTargetP, 0.55) : mateCurrP;

      // Ofsaytta olan oyuncuya pas atma (çok yüksek vizyonlu oyuncular ofsayt tuzaklarını görür)
      if (mateCurrP > offsideLineP + 0.4 && mateCurrP > passerOwnP) {
        if (rng.chance(0.88)) continue;
      }

      const progressGain = effectiveMateP - passerOwnP;

      // Pas koridoru açıklığı
      let minOppDistToLine = 999.0;
      let receiverSpace = 999.0;
      for (const opp of opponents) {
        if (opp.roleGroup === 'GK') continue;
        const seg = segmentClosest(opp.x, opp.y, passer.x, passer.y, mate.x, mate.y);
        if (seg.t > 0.08 && seg.t < 0.95 && seg.d < minOppDistToLine) {
          minOppDistToLine = seg.d;
        }
        const dRec = dist(opp.x, opp.y, mate.x, mate.y);
        if (dRec < receiverSpace) receiverSpace = dRec;
      }

      const corridorSafety = Math.min(9.0, minOppDistToLine);
      const spaceBonus = Math.min(8.0, receiverSpace) * 1.35;

      // Rol ağırlığı ve oyuncu kalitesi (yıldız oyuncular topu daha çok ister)
      let roleWeight = 1.0;
      if (mateProfile.isStriker) roleWeight = 1.45;
      else if (mateProfile.isWinger || mateProfile.isWingBack) roleWeight = 1.32;
      else if (mateProfile.isAttackingMid) roleWeight = 1.3;
      else if (mateProfile.isCentralMid) roleWeight = 1.15;
      else if (mateProfile.isFullBack) roleWeight = 1.05;
      else if (mateProfile.isCentreBack) roleWeight = 0.35;

      const starAttraction = ((mate.effOvr || mate.ovr) - 76) * 0.35;

      let score =
        progressGain * (2.35 + (style?.directness ?? 0.5) * 0.9) +
        corridorSafety * 2.1 +
        spaceBonus +
        roleWeight * 7.0 +
        starAttraction +
        rng.range(-1.8, 1.8);

      // Kaleci pas dağıtımı: Kısa oyun kurulumunda stoper/bek/ön liberoya, direkt oyunda orta saha/kanada
      if (isPasserGK) {
        if ((style?.directness ?? 0.5) < 0.58) {
          if (mate.roleGroup === 'CB' || mate.roleGroup === 'FB' || mate.roleGroup === 'WB' || mate.roleGroup === 'DM') {
            score += 24.0;
          }
          if (d > 34.0) score -= 25.0;
        } else {
          if (mate.roleGroup === 'CM' || mate.roleGroup === 'WM' || mate.roleGroup === 'W' || mate.roleGroup === 'ST') {
            score += 18.0;
          }
        }
      }

      // Geriye pas cezası: Baskı yoksa geriye pası çok sert cezalandır!
      if (progressGain < -1.0) {
        if (!underHeavyPressure) {
          score -= 55.0 + Math.abs(progressGain) * 2.2;
        } else {
          score -= 22.0 + Math.abs(progressGain) * 1.2;
        }
      }

      // Stoperlere geri dönüşü ekstra cezalandır (topun savunmada kısır döngüye girmesini önler)
      if (!isPasserGK && mate.roleGroup === 'CB' && passerOwnP > 34) {
        score -= 48.0;
      }

      // Hücum 3. bölgesinde ceza sahası içi ve çevresine paslara büyük öncelik
      if (passerOwnP > 60 && effectiveMateP > 74) {
        score += 30.0;
        // Çizgiye inen oyuncunun penaltı noktası / arka direk (Cutback) pası
        if ((passer.y < 15 || passer.y > 49) && mate.y >= 18 && mate.y <= 46) {
          score += 26.0;
        }
      }

      // Taktiksel Hücum Planı (AttackPlan) uyumu
      if (plan) {
        if (plan.kind === 'WING_OVERLOAD') {
          const onPlanFlank =
            (plan.flank === 'TOP' && mate.y < 24) ||
            (plan.flank === 'BOTTOM' && mate.y > 40);
          if (onPlanFlank && progressGain > -2) score += 16.0;
        } else if (plan.kind === 'CENTRAL_COMBO') {
          if (mate.y >= 18 && mate.y <= 46 && d <= 20 && progressGain > -1) score += 15.0;
          // Verkaç (1-2 Wall Pass) bonusu
          if (lastPasserId && mate.id === lastPasserId && progressGain > 2.0) score += 22.0;
        } else if (plan.kind === 'HALF_SPACE') {
          if (((mate.y >= 14 && mate.y <= 25) || (mate.y >= 39 && mate.y <= 50)) && progressGain > 2) {
            score += 16.0;
          }
        } else if (plan.kind === 'DIRECT_BALL' || plan.kind === 'COUNTER_BREAK') {
          if ((mate.roleGroup === 'ST' || mate.roleGroup === 'W' || mate.roleGroup === 'AM') && progressGain > 10) {
            score += 24.0;
          }
        } else if (plan.kind === 'SWITCH_PLAY') {
          if (Math.abs(mate.y - passer.y) > 24 && receiverSpace > 5.0 && progressGain > -3) {
            score += 22.0;
          }
        }
      }

      // Koridor çok kapalıysa yerden kısa pas puanını düşür (ancak yüksek vizyonlu pasör havadan/ara pasıyla aşabilir)
      if (minOppDistToLine < 1.6 && d < 24) {
        score -= 24.0 - Math.max(0, visionBonus * 8.0);
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = mate;
      }
    }

    // Pas türünü belirle
    const chosenProfile = getRoleProfile(bestCandidate.role);
    const chosenDist = dist(passer.x, passer.y, bestCandidate.x, bestCandidate.y);
    const bestMateP = toOwn(bestCandidate.x, dir);
    const inFinalThird = passerOwnP >= 64;
    const isPasserWide = passer.y < 16 || passer.y > 48;
    const isReceiverInBox = bestMateP >= 76 && bestCandidate.y >= 16 && bestCandidate.y <= 48;

    if (inFinalThird && isPasserWide && isReceiverInBox && chosenDist > 10.0) {
      // Kanattan ceza sahasına orta veya sert kesme
      chosenPassType = passerOwnP > 84 && chosenDist < 18.0 ? 'THROUGH' : 'CROSS';
    } else if (
      bestMateP > passerOwnP + 7.0 &&
      (chosenProfile.isStriker || chosenProfile.isWinger || chosenProfile.isAttackingMid || bestCandidate.action === 'SPRINT_RUN') &&
      bestMateP >= 58
    ) {
      chosenPassType = 'THROUGH';
    } else if (chosenDist > 26.0 || (Math.abs(bestCandidate.y - passer.y) > 26.0 && chosenDist > 20.0)) {
      chosenPassType = 'LONG';
    } else {
      chosenPassType = 'SHORT';
    }

    return { target: bestCandidate, passType: chosenPassType };
  }

  /**
   * Pas uçuşunu başlatan PassContext nesnesini oluşturur.
   * Oyuncunun pas kalitesi (effStats.pas) isabeti ve pas hızını doğrudan etkiler.
   */
  public static createPassContext(
    passer: EnginePlayerRuntime,
    receiver: EnginePlayerRuntime,
    passType: PassContext['passType'],
    defendingPlayers: EnginePlayerRuntime[],
    dir: 1 | -1,
    eventId: string,
    matchSecond: number
  ): PassContext {
    const origin: Vec2 = { x: passer.x, y: passer.y };
    const passerEff = passer.effStats || passer.stats;

    // Alıcının koşu yönüne göre pürüzsüz buluşma noktası (lead point)
    let targetX = receiver.x;
    let targetY = receiver.y;

    if (passType === 'THROUGH') {
      const leadX = dir * clamp(3.5 + (passerEff.pas - 70) * 0.06, 2.5, 5.5);
      targetX = lerpPassP(receiver.x, receiver.targetX, 0.5) + leadX;
      targetY = lerpPassP(receiver.y, receiver.targetY, 0.5);
    } else if (passType === 'CROSS') {
      const leadX = dir * 2.4;
      targetX = clamp(lerpPassP(receiver.x, receiver.targetX, 0.6) + leadX, 6.0, 94.0);
      targetY = clamp(lerpPassP(receiver.y, receiver.targetY, 0.6), 18.0, 46.0);
    } else if (passType === 'LONG') {
      targetX = lerpPassP(receiver.x, receiver.targetX, 0.45) + dir * 1.8;
      targetY = lerpPassP(receiver.y, receiver.targetY, 0.45);
    } else {
      // Kısa paslarda ayağa veya hafif koşu yoluna
      targetX = receiver.x + (receiver.targetX - receiver.x) * 0.32;
      targetY = receiver.y + (receiver.targetY - receiver.y) * 0.32;
    }

    const intendedTarget: Vec2 = {
      x: Number(clamp(targetX, 3.5, 96.5).toFixed(1)),
      y: Number(clamp(targetY, 3.0, 61.0).toFixed(1))
    };

    const target: Vec2 = { ...intendedTarget };

    // Alıcı oyuncunun hedefini pasın varış noktasına kilitle
    receiver.targetX = target.x;
    receiver.targetY = target.y;
    receiver.urgency = 1.0;
    receiver.action = passType === 'THROUGH' || passType === 'CROSS' ? 'SPRINT_RUN' : 'SUPPORT';

    const d = dist(target.x, target.y, origin.x, origin.y);
    const passQualitySpeed = (passerEff.pas - 75) * 0.12;
    const speed =
      (passType === 'THROUGH' ? 25.0 : passType === 'CROSS' ? 22.0 : passType === 'LONG' ? 24.0 : 23.0) +
      passQualitySpeed;

    const flightDurationSec = clamp(d / Math.max(16.0, speed), 0.28, 0.95);
    const maxHeight =
      passType === 'CROSS' ? 2.4 : passType === 'LONG' ? 1.65 : passType === 'THROUGH' ? 0.25 : 0.05;

    const offsideSnapshot = OffsideRule.capturePassSnapshot(passer, receiver, defendingPlayers, dir, origin);

    return {
      eventId,
      passerId: passer.id,
      receiverId: receiver.id,
      attackingTeam: passer.teamIndex,
      passType,
      origin,
      target,
      intendedTarget,
      speed,
      flightDurationSec,
      elapsedSec: 0,
      maxHeight,
      startedAtMatchSecond: matchSecond,
      offsideSnapshot
    };
  }

  /**
   * Top alıcıya ulaştığı andaki ofsayt ve ilk kontrol (first touch) denetimi.
   */
  public static resolvePassArrival(
    pass: PassContext,
    receiver: EnginePlayerRuntime,
    nearestOpponentDist: number,
    rng: SeededRandom
  ): PassArrivalResult {
    // 1. OFSAYT KONTROLÜ
    if (OffsideRule.isOffsideUponArrival(pass, receiver)) {
      return {
        success: false,
        isOffside: true,
        receiver,
        commentary: `🚩 OFSAYT! Yan hakemin bayrağı havada! ${receiver.shortName} savunma arkasına erken sarktı.`
      };
    }

    // 2. İLK KONTROL (FIRST TOUCH) KONTROLÜ
    const eff = receiver.effStats || receiver.stats;
    const controlRating = eff.dri * 0.65 + eff.pas * 0.35;
    let controlProb = clamp(0.86 + (controlRating - 75.0) * 0.006, 0.72, 0.99);

    if (pass.passType === 'LONG' || pass.passType === 'CROSS') {
      controlProb -= 0.04;
    }
    if (nearestOpponentDist < 2.2) {
      // Fizik gücü yüksek oyuncular baskı altında topu daha iyi saklar
      const shieldBonus = (eff.phy - 75.0) * 0.003;
      controlProb = clamp(controlProb * 0.9 + shieldBonus, 0.68, 0.98);
    }

    if (rng.chance(controlProb)) {
      receiver.rating = Math.min(10.0, receiver.rating + 0.03);
      return {
        success: true,
        isOffside: false,
        receiver
      };
    } else {
      return {
        success: false,
        isOffside: false,
        receiver,
        commentary: `⚠️ ${receiver.shortName} baskı altında ilk kontrolü yapamadı, top açıldı!`
      };
    }
  }
}

function lerpPassP(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
