import { FormationSlot } from '../../../shared/types.js';
import { EnginePlayerRuntime, EngineTeamRuntime, RestartState, Vec2 } from '../MatchState.js';
import { OffsideRule } from '../rules/OffsideRule.js';
import { clamp, dist, fromOwn, lerp, toOwn } from '../util/Geometry.js';
import { RoleGroup } from './RoleBehavior.js';
import { PressingSystem, DefensiveAssignments } from './PressingSystem.js';

interface GroupParams {
  kPoss: number;       // hücumda topun ilerleyişine tepki katsayısı
  kDef: number;        // savunmada topun konumuna tepki katsayısı
  gLine: number;       // savunma çizgisi yüksekliğinin bu gruba yansıma oranı
  minP: number;        // asla bundan geriye düşemez
  maxPoss: number;     // hücumda ulaşabileceği en ileri nokta
  maxDef: number;      // savunmada ulaşabileceği en ileri nokta
  yBand: number;       // çapa y konumundan yanal sapma payı
  latPoss: number;     // hücumda topun y konumuna kayma
  latDef: number;      // savunmada topun y konumuna kayma
  commitShift: number; // hücuma katılım (mentalite) ile ek öne çıkış
  commitCap: number;   // hücuma katılım ile tavanın yükselmesi
}

/**
 * Her rol grubunun (stoper, bek, orta saha, kanat, forvet...) sahada kalabileceği bölge sınırları.
 * "Oyuncu mevkisinin dışında kalıyor" sorununu bu sert bölge sınırları engeller.
 */
const GROUP_PARAMS: Record<Exclude<RoleGroup, 'GK'>, GroupParams> = {
  CB: { kPoss: 0.2, kDef: 0.36, gLine: 0.85, minP: 7, maxPoss: 36, maxDef: 35, yBand: 12, latPoss: 0.18, latDef: 0.42, commitShift: 5, commitCap: 14 },
  FB: { kPoss: 0.62, kDef: 0.38, gLine: 0.8, minP: 8, maxPoss: 64, maxDef: 46, yBand: 10, latPoss: 0.1, latDef: 0.32, commitShift: 9, commitCap: 14 },
  WB: { kPoss: 0.74, kDef: 0.38, gLine: 0.8, minP: 9, maxPoss: 74, maxDef: 48, yBand: 10, latPoss: 0.1, latDef: 0.32, commitShift: 9, commitCap: 14 },
  DM: { kPoss: 0.4, kDef: 0.38, gLine: 0.75, minP: 13, maxPoss: 54, maxDef: 44, yBand: 16, latPoss: 0.25, latDef: 0.42, commitShift: 6, commitCap: 10 },
  CM: { kPoss: 0.62, kDef: 0.38, gLine: 0.65, minP: 18, maxPoss: 72, maxDef: 54, yBand: 20, latPoss: 0.25, latDef: 0.4, commitShift: 9, commitCap: 12 },
  WM: { kPoss: 0.74, kDef: 0.36, gLine: 0.55, minP: 22, maxPoss: 82, maxDef: 56, yBand: 10, latPoss: 0.1, latDef: 0.28, commitShift: 8, commitCap: 10 },
  AM: { kPoss: 0.78, kDef: 0.38, gLine: 0.5, minP: 30, maxPoss: 88, maxDef: 60, yBand: 20, latPoss: 0.28, latDef: 0.35, commitShift: 6, commitCap: 8 },
  W: { kPoss: 0.82, kDef: 0.42, gLine: 0.4, minP: 36, maxPoss: 91, maxDef: 62, yBand: 11, latPoss: 0.1, latDef: 0.22, commitShift: 4, commitCap: 6 },
  ST: { kPoss: 0.85, kDef: 0.45, gLine: 0.35, minP: 38, maxPoss: 93, maxDef: 66, yBand: 20, latPoss: 0.25, latDef: 0.3, commitShift: 3, commitCap: 4 }
};

export interface PassFlightInfo {
  receiverId: string;
  target: Vec2;
  origin: Vec2;
  attackingTeam: 0 | 1;
  passType: string;
}

export interface PositioningContext {
  players: EnginePlayerRuntime[];
  teams: [EngineTeamRuntime, EngineTeamRuntime];
  ball: Vec2;
  ballVel: Vec2;
  ballMode: 'CONTROLLED' | 'IN_FLIGHT_PASS' | 'IN_FLIGHT_SHOT' | 'LOOSE' | 'RESTART';
  possessionTeam: 0 | 1;
  carrier: EnginePlayerRuntime | null;
  passFlight: PassFlightInfo | null;
  restart: RestartState | null;
  simSec: number;
  /** Motorun doğrudan yönettiği oyuncular (top taşıyıcı, pas alıcısı, kullanıcı...) */
  locked: Set<string>;
  /** Son top sahibi değişiminden bu yana geçen saniye (geçiş / kontra baskısı için) */
  secondsSincePossessionChange: number;
}

export class PositioningSystem {
  /**
   * FORMATIONS tablosundaki slot.x (en: 0..100) ve slot.y (derinlik: 88=GK .. 20=ST)
   * koordinatlarını sahadaki [0..100, 0..64] baseX ve baseY koordinatlarına dönüştürür.
   */
  public static calculateAnchorPosition(slot: FormationSlot, attackDirection: 1 | -1): Vec2 {
    let normPitchX: number;
    let normPitchY: number;

    if (slot.requiredPosition === 'GK') {
      normPitchX = 5.0;
      normPitchY = 32.0;
    } else {
      const depthProg = Math.max(0, Math.min(1, (82 - slot.y) / 62));
      normPitchX = 16.0 + depthProg * 48.0;
      normPitchY = 6.0 + (slot.x / 100.0) * 52.0;
    }

    const finalBaseX = attackDirection === 1 ? normPitchX : 100.0 - normPitchX;
    const finalBaseY = attackDirection === 1 ? normPitchY : 64.0 - normPitchY;

    return {
      x: Number(finalBaseX.toFixed(1)),
      y: Number(finalBaseY.toFixed(1))
    };
  }

  /**
   * Tüm oyuncuların hedef konumlarını (ve koşu temposunu) günceller.
   * Döndürdüğü savunma görevleri (pres / kapatma) motorun müdahale mantığında da kullanılır.
   */
  public static update(ctx: PositioningContext): [DefensiveAssignments, DefensiveAssignments] {
    const assignments: [DefensiveAssignments, DefensiveAssignments] = [
      PressingSystem.empty(),
      PressingSystem.empty()
    ];

    for (const tIdx of [0, 1] as const) {
      const team = ctx.teams[tIdx];
      const oppTeam = ctx.teams[1 - tIdx];
      const mates = ctx.players.filter((p) => p.teamIndex === tIdx);
      const opps = ctx.players.filter((p) => p.teamIndex !== tIdx);
      const attacking = ctx.possessionTeam === tIdx;
      const dir = team.attackDirection;
      const ballP = toOwn(ctx.ball.x, dir);

      // Ofsayt çizgisi (hücum eden takım için rakip savunma hattı)
      const offLineX = OffsideRule.calculateLiveOffsideLine(opps, ctx.ball, dir);
      const offLineP = toOwn(offLineX, dir);

      // 1. Şekil (shape) hedefleri
      const shape = new Map<string, Vec2>();
      for (const p of mates) {
        if (p.roleGroup === 'GK' || ctx.locked.has(p.id)) continue;
        shape.set(p.id, this.shapeTarget(p, team, attacking, ctx, ballP, offLineP));
      }

      // 2. Hücum / savunma bindirmeleri
      if (ctx.restart && ctx.ballMode === 'RESTART') {
        this.restartTargets(ctx, team, mates, opps, attacking, shape, offLineP);
      } else if (attacking) {
        this.attackOverlays(ctx, team, mates, opps, shape, offLineP, ballP);
      } else {
        assignments[tIdx] = PressingSystem.evaluate(ctx, team, mates, opps, shape);
        this.defenseOverlays(ctx, team, mates, shape, assignments[tIdx]);
      }

      // 3. Kaleci
      const gk = mates.find((p) => p.roleGroup === 'GK');
      if (gk && !ctx.locked.has(gk.id)) {
        const g = this.goalkeeperTarget(gk, team, ctx, ballP, attacking);
        gk.targetX = g.x;
        gk.targetY = g.y;
        gk.urgency = g.urgency;
      }

      // 4. Hedefleri oyunculara yaz
      for (const p of mates) {
        if (p.roleGroup === 'GK' || ctx.locked.has(p.id)) continue;
        const t = shape.get(p.id);
        if (!t) continue;
        p.targetX = clamp(t.x, 2.5, 97.5);
        p.targetY = clamp(t.y, 2.5, 61.5);
      }

      // 5. Sahipsiz top: her takımın en yakın oyuncuları topa gider
      if (ctx.ballMode === 'LOOSE') {
        this.looseBallChasers(ctx, mates);
      }

      // geçiş anında (top kaybı) hızlı geri dönüş koşusu
      if (!attacking && ctx.secondsSincePossessionChange < 2.2 && ctx.ballMode !== 'RESTART') {
        for (const p of mates) {
          if (p.roleGroup !== 'GK' && !ctx.locked.has(p.id)) p.urgency = Math.max(p.urgency, 0.95);
        }
      }
    }

    return assignments;
  }

  // ------------------------------------------------------------------
  // ŞEKİL (BLOK) HEDEFİ
  // ------------------------------------------------------------------
  private static shapeTarget(
    p: EnginePlayerRuntime,
    team: EngineTeamRuntime,
    attacking: boolean,
    ctx: PositioningContext,
    ballP: number,
    offLineP: number
  ): Vec2 {
    const dir = team.attackDirection;
    const style = team.style;
    const g = p.roleGroup as Exclude<RoleGroup, 'GK'>;
    const gp = GROUP_PARAMS[g];
    const anchorP = toOwn(p.baseX, dir);

    let targetP: number;
    let maxP: number;
    const commit = style.forwardCommit;
    if (attacking) {
      const commitScale = 0.8 + 0.4 * commit;
      targetP = anchorP + (ballP - 45) * gp.kPoss * commitScale + (commit - 0.5) * gp.commitShift;
      maxP = gp.maxPoss + (commit - 0.5) * gp.commitCap * 2;
    } else {
      targetP = anchorP + (style.lineHeight - 28) * gp.gLine + (ballP - 45) * gp.kDef;
      maxP = gp.maxDef + (style.lineHeight - 30) * gp.gLine * 0.6;
      // Top savunma üçüncü bölgesine indiğinde stoper, bek ve ön liberolar top ile kale arasına (goal-side) çekilir
      if (ballP < 36) {
        if (g === 'CB') {
          targetP = Math.min(targetP, Math.max(7.5, ballP - 3.2));
        } else if (g === 'FB' || g === 'WB') {
          targetP = Math.min(targetP, Math.max(8.5, ballP - 2.0));
        } else if (g === 'DM') {
          targetP = Math.min(targetP, Math.max(13.0, ballP + 2.5));
        }
      }
    }
    targetP = clamp(targetP, gp.minP, Math.max(gp.minP + 2, maxP));

    // Ofsayt bilinci: hücumdaki oyuncular savunma hattının gerisinde kalır
    if (attacking && (g === 'ST' || g === 'W' || g === 'AM' || g === 'WM' || g === 'CM')) {
      targetP = Math.min(targetP, offLineP - 0.8);
    }

    // Yanal konum
    const sideSign = p.baseY < 32 ? -1 : 1;
    const wide = g === 'FB' || g === 'WB' || g === 'WM' || g === 'W';
    const lat = (attacking ? gp.latPoss : gp.latDef * style.compactness);
    let targetY = p.baseY + (ctx.ball.y - 32) * lat;
    if (wide && attacking && ballP > 48) {
      const stretch = clamp((ballP - 48) / 32, 0, 1) * 0.6 * style.width;
      targetY = lerp(targetY, sideSign < 0 ? 5.5 : 58.5, stretch);
    }

    let loY = p.baseY - gp.yBand;
    let hiY = p.baseY + gp.yBand;
    if (wide) {
      if (sideSign < 0) loY -= 10;
      else hiY += 10;
    }
    targetY = clamp(targetY, Math.max(3.5, loY), Math.min(60.5, hiY));

    if (!ctx.locked.has(p.id)) {
      p.urgency = attacking ? 0.62 : 0.7;
      if (p.action === 'CARRY' || p.action === 'SHOOT' || p.action === 'GK_DIVE') {
        p.action = 'IDLE';
      }
    }

    return { x: fromOwn(targetP, dir), y: targetY };
  }

  // ------------------------------------------------------------------
  // KALECİ
  // ------------------------------------------------------------------
  private static goalkeeperTarget(
    gk: EnginePlayerRuntime,
    team: EngineTeamRuntime,
    ctx: PositioningContext,
    ballP: number,
    attacking: boolean
  ): { x: number; y: number; urgency: number } {
    const dir = team.attackDirection;
    let gkP = 4.6;
    if (!attacking && ballP < 28) gkP = 4.2;
    else if (team.style.lineHeight >= 34 && ballP > 52) gkP = 12;
    else if (ballP > 55) gkP = 8;
    const maxLateral = ballP < 26 ? 7.5 : 5;
    const gy = clamp(32 + (ctx.ball.y - 32) * 0.2, 32 - maxLateral, 32 + maxLateral);
    if (gk.action === 'GK_DIVE') gk.action = 'GK_DIVE';
    else gk.action = 'IDLE';
    return { x: fromOwn(gkP, dir), y: gy, urgency: 0.75 };
  }

  // ------------------------------------------------------------------
  // HÜCUM BİNDİRMELERİ: koşular, destek üçgenleri, ceza sahası varışları
  // ------------------------------------------------------------------
  private static attackOverlays(
    ctx: PositioningContext,
    team: EngineTeamRuntime,
    mates: EnginePlayerRuntime[],
    opps: EnginePlayerRuntime[],
    shape: Map<string, Vec2>,
    offLineP: number,
    ballP: number
  ) {
    const dir = team.attackDirection;
    const style = team.style;
    const plan = team.plan;
    const carrier = ctx.carrier && ctx.carrier.teamIndex === team.index ? ctx.carrier : null;
    const refX = carrier ? carrier.x : ctx.ball.x;
    const refY = carrier ? carrier.y : ctx.ball.y;
    const carrierP = toOwn(refX, dir);
    const ballSide = refY < 32 ? -1 : 1;
    const wideBall = Math.abs(refY - 32) >= 14;
    const assigned = new Set<string>();

    const free = (p: EnginePlayerRuntime) => !ctx.locked.has(p.id) && p.roleGroup !== 'GK' && (!carrier || p.id !== carrier.id);
    const candidates = mates.filter(free);

    const setT = (p: EnginePlayerRuntime, tp: number, ty: number, urgency: number) => {
      const gp = GROUP_PARAMS[p.roleGroup as Exclude<RoleGroup, 'GK'>];
      const maxP = gp.maxPoss + (style.forwardCommit - 0.5) * gp.commitCap * 2 + 6;
      let pp = clamp(tp, gp.minP, maxP);
      if (p.roleGroup === 'ST' || p.roleGroup === 'W' || p.roleGroup === 'AM' || p.roleGroup === 'WM') {
        pp = Math.min(pp, offLineP - 0.8);
      }
      shape.set(p.id, { x: fromOwn(pp, dir), y: clamp(ty, 3.5, 60.5) });
      p.urgency = urgency;
      assigned.add(p.id);
    };

    const attackersSorted = candidates
      .filter((p) => p.roleGroup === 'ST' || p.roleGroup === 'W' || p.roleGroup === 'AM')
      .sort((a, b) => Math.abs(a.baseY - 32) - Math.abs(b.baseY - 32));

    // --- 1. Kanat bindirmesi / yarı alan planları ---
    if (plan && (plan.kind === 'WING_OVERLOAD' || plan.kind === 'HALF_SPACE' || plan.kind === 'SWITCH_PLAY') && plan.flank) {
      const flankSide = plan.flank === 'TOP' ? -1 : 1;
      for (const p of candidates) {
        const pSide = p.baseY < 32 ? -1 : 1;
        const isWideRole = p.roleGroup === 'W' || p.roleGroup === 'WM';
        const isBack = p.roleGroup === 'FB' || p.roleGroup === 'WB';
        if (pSide === flankSide && carrierP >= 34) {
          if (isWideRole) {
            if (plan.kind === 'HALF_SPACE') {
              setT(p, carrierP + 7, 32 + flankSide * 12, 0.95);
            } else {
              setT(p, carrierP + 6, flankSide < 0 ? 5.5 : 58.5, 0.92);
            }
          } else if (isBack && style.fullBackOverlap > 0.25 && Math.abs(refY - (flankSide < 0 ? 5.5 : 58.5)) < 24) {
            const overlapP = carrierP + 4 + 9 * style.fullBackOverlap;
            setT(p, overlapP, flankSide < 0 ? 5.0 : 59.0, 0.95);
          }
        } else if (pSide !== flankSide && isWideRole && carrierP >= 60) {
          // uzak kanat oyuncusu ceza sahasına doğru içeri girer (uzak direk)
          setT(p, 87, 32 - flankSide * 8, 0.9);
        }
      }
    }

    // --- 2. Bek bindirmeleri (plan olmasa bile topun yanında bindirir) ---
    for (const p of candidates) {
      if (assigned.has(p.id)) continue;
      if (p.roleGroup !== 'FB' && p.roleGroup !== 'WB') continue;
      const pSide = p.baseY < 32 ? -1 : 1;
      const sameFlank = pSide === ballSide && wideBall;
      if (sameFlank && carrierP >= 42 && style.fullBackOverlap >= 0.35) {
        const overlapP = carrierP + 3 + 9 * style.fullBackOverlap;
        setT(p, overlapP, pSide < 0 ? 5.5 : 58.5, 0.9);
      }
    }

    // --- 3. Ceza sahası varışları (kanattan orta / geri çekme) ---
    if (carrierP >= 66 && wideBall) {
      const strikers = attackersSorted.filter((p) => p.roleGroup === 'ST');
      const wingersFar = attackersSorted.filter((p) => p.roleGroup === 'W' && (p.baseY < 32 ? -1 : 1) !== ballSide);
      const arrivals = candidates
        .filter((p) => (p.roleGroup === 'CM' || p.roleGroup === 'AM' || p.roleGroup === 'DM') && !assigned.has(p.id))
        .sort((a, b) => dist(a.x, a.y, fromOwn(80, dir), 32) - dist(b.x, b.y, fromOwn(80, dir), 32));
      strikers.forEach((p, i) => {
        if (assigned.has(p.id)) return;
        if (i === 0) setT(p, 91, 32 + ballSide * 3.2, 1.0); // ön direk
        else setT(p, 88, 32 - ballSide * 4, 1.0);            // arka direk
      });
      wingersFar.forEach((p) => {
        if (!assigned.has(p.id)) setT(p, 88, 32 - ballSide * 9, 1.0);
      });
      if (arrivals[0]) setT(arrivals[0], 79, 32 - ballSide * 2, 0.95);   // penaltı noktası arkası
      if (arrivals[1] && style.forwardCommit >= 0.45) setT(arrivals[1], 76, 32 + ballSide * 8, 0.9);
    }

    // --- 4. Forvet / kanat koşuları (plan bazlı) ---
    const planKind = plan ? plan.kind : 'BUILD_PATIENT';
    const forwardRuns = carrier !== null && carrierP >= 30;
    for (let i = 0; i < attackersSorted.length; i++) {
      const p = attackersSorted[i];
      if (assigned.has(p.id)) continue;
      const pP = toOwn(p.x, dir);

      if (planKind === 'COUNTER_BREAK' && forwardRuns) {
        const lane = p.roleGroup === 'ST' ? 32 + (i === 0 ? 0 : (p.baseY < 32 ? -9 : 9)) : (p.baseY < 32 ? 13 : 51);
        setT(p, carrierP + 24, lane, 1.0);
        continue;
      }
      if (p.roleGroup === 'ST' && forwardRuns) {
        if (planKind === 'CENTRAL_COMBO' && carrierP < 62 && i === 0) {
          // santrafor derine inip bağlantı kurar
          setT(p, Math.max(carrierP + 8, 44), clamp(refY + (p.baseY < 32 ? -5 : 5), 12, 52), 0.9);
        } else if (planKind !== 'BUILD_PATIENT' || style.forwardCommit >= 0.6) {
          const runP = Math.min(offLineP - 0.8, Math.max(pP, carrierP + 12 + 10 * style.forwardCommit));
          const runY = this.bestChannelY(p, runP, dir, opps);
          setT(p, runP, runY, carrierP >= 48 ? 1.0 : 0.85);
        }
        continue;
      }
      if (p.roleGroup === 'ST' && planKind === 'DIRECT_BALL') {
        setT(p, offLineP - 0.8, this.bestChannelY(p, offLineP - 0.8, dir, opps), 1.0);
        continue;
      }
      if (p.roleGroup === 'AM' && forwardRuns && carrierP >= 44 && planKind !== 'BUILD_PATIENT') {
        // ceza yayında boşluk arar
        setT(p, Math.min(offLineP - 1.2, carrierP + 9), clamp(32 + (p.baseY - 32) * 0.5, 18, 46), 0.9);
      }
    }

    // --- 5. Destek üçgeni: topun etrafında 2 pas seçeneği ---
    if (carrier) {
      const supporters = candidates
        .filter((p) => !assigned.has(p.id) && p.roleGroup !== 'CB' ? true : (!assigned.has(p.id) && carrierP < 34))
        .filter((p) => !assigned.has(p.id))
        .sort((a, b) => dist(a.x, a.y, refX, refY) - dist(b.x, b.y, refX, refY))
        .slice(0, 3);

      supporters.forEach((p, idx) => {
        const gp = GROUP_PARAMS[p.roleGroup as Exclude<RoleGroup, 'GK'>];
        const d = dist(p.x, p.y, refX, refY);
        if (d > 30) return;
        const sideSign = idx % 2 === 0 ? (p.baseY < refY ? -1 : 1) : (p.baseY < refY ? 1 : -1);
        const fwdOffset = idx === 0 ? 5 : (idx === 1 ? -3 : -9);
        const latOffset = idx === 2 ? 3 : 10.5;
        const tp = carrierP + fwdOffset;
        const ty = refY + sideSign * latOffset;
        // bölge sınırlarını aşmasın
        const clampedP = clamp(tp, gp.minP, gp.maxPoss + 4);
        const side = p.baseY < 32 ? -1 : 1;
        const wide = p.roleGroup === 'FB' || p.roleGroup === 'WB' || p.roleGroup === 'WM' || p.roleGroup === 'W';
        let loY = p.baseY - gp.yBand - 4;
        let hiY = p.baseY + gp.yBand + 4;
        if (wide) {
          if (side < 0) loY -= 8;
          else hiY += 8;
        }
        shape.set(p.id, { x: fromOwn(Math.min(clampedP, p.roleGroup === 'ST' || p.roleGroup === 'W' || p.roleGroup === 'AM' ? offLineP - 0.8 : 99), dir), y: clamp(ty, Math.max(3.5, loY), Math.min(60.5, hiY)) });
        p.urgency = 0.85;
        assigned.add(p.id);
      });
    }

    // --- 6. Top taşıyıcıya çok yakın takım arkadaşları açılır (yığılma engeli) ---
    if (carrier) {
      for (const p of candidates) {
        if (assigned.has(p.id)) continue;
        const t = shape.get(p.id);
        if (!t) continue;
        const d = dist(t.x, t.y, refX, refY);
        if (d < 6) {
          const ang = Math.atan2(t.y - refY, t.x - refX || 0.01);
          shape.set(p.id, { x: t.x + Math.cos(ang) * (6 - d), y: clamp(t.y + Math.sin(ang) * (6 - d), 3.5, 60.5) });
        }
      }
    }
  }

  /** Koşu için rakip savunmacılar arasındaki en boş kanalı (y) bulur. */
  private static bestChannelY(p: EnginePlayerRuntime, runP: number, dir: 1 | -1, opps: EnginePlayerRuntime[]): number {
    const runX = fromOwn(runP, dir);
    let bestY = p.baseY;
    let bestScore = -999;
    for (const off of [-12, -6, 0, 6, 12]) {
      const y = clamp(p.baseY + off, 6, 58);
      let minD = 99;
      for (const o of opps) {
        if (o.position === 'GK') continue;
        const d = Math.hypot(o.x - runX, o.y - y);
        if (d < minD) minD = d;
      }
      const score = Math.min(minD, 12) - Math.abs(y - 32) * 0.05 - Math.abs(off) * 0.08;
      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }
    return bestY;
  }

  // ------------------------------------------------------------------
  // SAVUNMA BİNDİRMELERİ: baskı, kapatma, pas arası kesme
  // ------------------------------------------------------------------
  private static defenseOverlays(
    ctx: PositioningContext,
    team: EngineTeamRuntime,
    mates: EnginePlayerRuntime[],
    shape: Map<string, Vec2>,
    assign: DefensiveAssignments
  ) {
    const dir = team.attackDirection;
    if (assign.presser && !ctx.locked.has(assign.presser.id)) {
      const t = assign.pressPoint!;
      shape.set(assign.presser.id, t);
      assign.presser.urgency = 1.0;
      assign.presser.action = 'PRESS';
    }
    if (assign.cover && !ctx.locked.has(assign.cover.id)) {
      shape.set(assign.cover.id, assign.coverPoint!);
      assign.cover.urgency = 0.95;
      assign.cover.action = 'TACKLE';
    }
    if (assign.laneCutter && assign.laneCutPoint && !ctx.locked.has(assign.laneCutter.id)) {
      shape.set(assign.laneCutter.id, assign.laneCutPoint);
      assign.laneCutter.urgency = 1.0;
      assign.laneCutter.action = 'INTERCEPT';
    }
    assign.markers.forEach((pt, id) => {
      const p = mates.find((m) => m.id === id);
      if (!p || ctx.locked.has(id)) return;
      const base = shape.get(id);
      if (!base) return;
      shape.set(id, { x: lerp(base.x, pt.x, 0.75), y: lerp(base.y, pt.y, 0.75) });
      p.urgency = Math.max(p.urgency, 0.85);
    });
    void dir;
  }

  // ------------------------------------------------------------------
  // DURAN TOPLAR
  // ------------------------------------------------------------------
  private static restartTargets(
    ctx: PositioningContext,
    team: EngineTeamRuntime,
    mates: EnginePlayerRuntime[],
    opps: EnginePlayerRuntime[],
    attacking: boolean,
    shape: Map<string, Vec2>,
    offLineP: number
  ) {
    const r = ctx.restart!;
    const dir = team.attackDirection;
    const spot = r.spot;
    const spotP = toOwn(spot.x, dir);
    const free = (p: EnginePlayerRuntime) => !ctx.locked.has(p.id) && p.roleGroup !== 'GK';
    const setP = (p: EnginePlayerRuntime, ownP: number, y: number, urgency = 0.9) => {
      shape.set(p.id, { x: fromOwn(ownP, dir), y: clamp(y, 3.5, 60.5) });
      p.urgency = urgency;
    };

    if (r.type === 'KICK_OFF') {
      for (const p of mates) {
        if (!free(p)) continue;
        if (p.id === r.takerId) {
          shape.set(p.id, { x: p.x, y: p.y });
          p.urgency = 0.5;
          continue;
        }
        const t = shape.get(p.id)!;
        let tp = Math.min(toOwn(t.x, dir), 46.5);
        const ty = t.y;
        if (!attacking) {
          // savunan takım orta daire dışında kalır
          const d = dist(fromOwn(tp, dir), ty, 50, 32);
          if (d < 10) {
            tp = Math.min(tp, 39.5);
          }
        }
        shape.set(p.id, { x: fromOwn(tp, dir), y: ty });
        p.urgency = 0.8;
      }
      return;
    }

    if (r.type === 'CORNER') {
      const side = spot.y < 32 ? -1 : 1;
      if (attacking) {
        const box = mates.filter((p) => free(p) && p.id !== r.takerId);
        const aerial = [...box].sort((a, b) => (b.effStats.phy + b.effStats.sho) - (a.effStats.phy + a.effStats.sho));
        const forwards = box.filter((p) => p.roleGroup === 'ST' || p.roleGroup === 'W' || p.roleGroup === 'AM' || p.roleGroup === 'WM');
        const goingUp = new Set<string>();
        forwards.forEach((p) => goingUp.add(p.id));
        // en iyi iki hava topu oyuncusu (stoper dahil) ceza sahasına çıkar
        aerial.slice(0, 5).forEach((p) => goingUp.add(p.id));
        const slotsP = [92, 90, 86, 83, 80, 78];
        const slotsY = [32 - side * 2.5, 32 + side * 3.5, 32 - side * 8, 32 + side * 9, 32 - side * 1, 32 + side * 0.5];
        let i = 0;
        goingUp.forEach((id) => {
          const p = mates.find((m) => m.id === id)!;
          if (i < slotsP.length) {
            setP(p, slotsP[i], slotsY[i], 0.95);
            i++;
          }
        });
        // kalanlar geride kontra güvenliği
        for (const p of box) {
          if (!goingUp.has(p.id)) {
            const t = shape.get(p.id)!;
            shape.set(p.id, { x: fromOwn(Math.min(toOwn(t.x, dir), 56), dir), y: t.y });
          }
        }
      } else {
        // Savunma: kale direklerinde 2 oyuncu, 6 pas içinde bölgesel dizilim
        const defenders = mates.filter(free).sort((a, b) => b.effStats.def - a.effStats.def);
        const posts = [
          { p: 3, y: 28.8 },
          { p: 3, y: 35.2 },
          { p: 9, y: 30 },
          { p: 9, y: 34 },
          { p: 13, y: 26 },
          { p: 13, y: 38 },
          { p: 16, y: 32 },
          { p: 19, y: 29 }
        ];
        defenders.slice(0, posts.length).forEach((p, i) => setP(p, posts[i].p, posts[i].y, 1.0));
        defenders.slice(posts.length).forEach((p) => {
          const t = shape.get(p.id)!;
          shape.set(p.id, { x: fromOwn(Math.min(toOwn(t.x, dir), 60), dir), y: t.y });
        });
      }
      return;
    }

    if (r.type === 'FREE_KICK' || r.type === 'PENALTY') {
      if (r.type === 'PENALTY') {
        // herkes ceza sahası dışında yay çevresinde bekler
        for (const p of mates) {
          if (!free(p) || p.id === r.takerId) continue;
          const attackerSideP = attacking ? 78 : 100 - 78;
          const idx = mates.indexOf(p);
          shape.set(p.id, { x: fromOwn(attacking ? 78 : 22, dir) , y: 12 + idx * 4.2 });
          void attackerSideP;
          p.urgency = 0.7;
        }
        return;
      }
      const shootingRange = spotP >= 62;
      if (!attacking && shootingRange) {
        // barikat: top ile kale arasında 9.5 birim mesafede
        const gx = dir === 1 ? 0 : 100;
        void gx;
        const ownGoalX = fromOwn(0, dir);
        const ang = Math.atan2(32 - spot.y, ownGoalX - spot.x);
        const wallers = mates.filter(free).sort((a, b) => dist(a.x, a.y, spot.x, spot.y) - dist(b.x, b.y, spot.x, spot.y)).slice(0, 4);
        wallers.forEach((p, i) => {
          const off = (i - 1.5) * 1.6;
          const wx = spot.x + Math.cos(ang) * 9.6 - Math.sin(ang) * off;
          const wy = spot.y + Math.sin(ang) * 9.6 + Math.cos(ang) * off;
          shape.set(p.id, { x: wx, y: wy });
          p.urgency = 1.0;
        });
      }
      if (attacking && shootingRange) {
        const forwards = mates.filter((p) => free(p) && p.id !== r.takerId && (p.roleGroup === 'ST' || p.roleGroup === 'W' || p.roleGroup === 'AM' || p.roleGroup === 'CM'));
        forwards.slice(0, 5).forEach((p, i) => setP(p, 84 + (i % 3) * 2.5, 22 + i * 5, 0.9));
      }
      return;
    }

    if (r.type === 'GOAL_KICK' && attacking) {
      // stoperler açılır, bekler ilerler, ön libero iner
      for (const p of mates) {
        if (!free(p)) continue;
        if (p.roleGroup === 'CB') {
          setP(p, 13, p.baseY < 32 ? 17 : 47, 0.9);
        } else if (p.roleGroup === 'FB' || p.roleGroup === 'WB') {
          setP(p, 30 + 4 * team.style.fullBackOverlap, p.baseY < 32 ? 8 : 56, 0.85);
        } else if (p.roleGroup === 'DM') {
          setP(p, 27, 32, 0.85);
        }
      }
      return;
    }

    if (r.type === 'GOAL_KICK' && !attacking) {
      // rakip kale vuruşunda baskı hattı
      for (const p of mates) {
        if (!free(p)) continue;
        if (p.roleGroup === 'ST' || p.roleGroup === 'W' || p.roleGroup === 'AM') {
          const hold = team.style.pressHighLine > 0.5 ? 76 : 62;
          setP(p, Math.min(hold, GROUP_PARAMS[p.roleGroup as Exclude<RoleGroup, 'GK'>].maxDef + 10), 32 + (p.baseY - 32) * 0.55, 0.8);
        }
      }
      return;
    }

    if (r.type === 'THROW_IN') {
      if (attacking) {
        const near = mates
          .filter((p) => free(p) && p.id !== r.takerId)
          .sort((a, b) => dist(a.x, a.y, spot.x, spot.y) - dist(b.x, b.y, spot.x, spot.y))
          .slice(0, 2);
        near.forEach((p, i) => {
          const sideSign = spot.y < 32 ? 1 : -1;
          shape.set(p.id, {
            x: spot.x + (i === 0 ? 8 : -6) * dir,
            y: clamp(spot.y + sideSign * (i === 0 ? 9 : 14), 3.5, 60.5)
          });
          p.urgency = 0.95;
        });
      }
      return;
    }

    void opps;
    void offLineP;
  }

  // ------------------------------------------------------------------
  // SAHİPSİZ TOP
  // ------------------------------------------------------------------
  private static looseBallChasers(ctx: PositioningContext, mates: EnginePlayerRuntime[]) {
    const lead = 0.25;
    const bx = ctx.ball.x + ctx.ballVel.x * lead;
    const by = ctx.ball.y + ctx.ballVel.y * lead;
    const sorted = mates
      .filter((p) => !ctx.locked.has(p.id))
      .filter((p) => p.roleGroup !== 'GK' || dist(p.x, p.y, bx, by) < 9)
      .sort((a, b) => dist(a.x, a.y, bx, by) - dist(b.x, b.y, bx, by));
    const chasers = sorted.slice(0, 2);
    chasers.forEach((p, i) => {
      if (dist(p.x, p.y, bx, by) > 22 && i === 1) return;
      p.targetX = clamp(bx, 2.5, 97.5);
      p.targetY = clamp(by, 2.5, 61.5);
      p.urgency = 1.0;
      p.action = 'SPRINT_RUN';
    });
  }
}
