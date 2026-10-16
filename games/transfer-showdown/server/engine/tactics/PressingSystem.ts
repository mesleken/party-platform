import { EnginePlayerRuntime, EngineTeamRuntime, Vec2 } from '../MatchState.js';
import { clamp, dist, fromOwn, lerp, segmentClosest, toOwn } from '../util/Geometry.js';
import { getRoleProfile } from './RoleBehavior.js';
import type { PositioningContext } from './PositioningSystem.js';

export interface PressingResult {
  primaryPresser: EnginePlayerRuntime | null;
  secondaryPresser: EnginePlayerRuntime | null;
  effectivePressure: number; // 0..1 (top taşıyıcı üzerindeki anlık pres baskısı)
}

export interface DefensiveAssignments {
  presser: EnginePlayerRuntime | null;
  pressPoint: Vec2 | null;
  cover: EnginePlayerRuntime | null;
  coverPoint: Vec2 | null;
  laneCutter: EnginePlayerRuntime | null;
  laneCutPoint: Vec2 | null;
  markers: Map<string, Vec2>;
  effectivePressure: number;
}

export class PressingSystem {
  public static empty(): DefensiveAssignments {
    return {
      presser: null,
      pressPoint: null,
      cover: null,
      coverPoint: null,
      laneCutter: null,
      laneCutPoint: null,
      markers: new Map<string, Vec2>(),
      effectivePressure: 0
    };
  }

  /**
   * Gelişmiş bölgesel savunma, şok pres (gegenpress), kademe (cover) ve pas kanalı kesme (lane cutting) sistemi.
   * Oyuncuların kendi mevki tavanlarını aşmasını önleyerek gerçekçi takım savunması kurar.
   */
  public static evaluate(
    ctx: PositioningContext,
    team: EngineTeamRuntime,
    mates: EnginePlayerRuntime[],
    opps: EnginePlayerRuntime[],
    shape: Map<string, Vec2>
  ): DefensiveAssignments {
    const res = this.empty();

    if (ctx.ballMode === 'RESTART') {
      return res;
    }

    const dir = team.attackDirection;
    const style = team.style;
    const carrier = ctx.carrier && ctx.carrier.teamIndex !== team.index ? ctx.carrier : null;

    // Kaleciye anlamsız tam saha forvet baskısını engelle (yalnızca çok yüksek baskıda yaklaşır ama yapışmaz)
    const isCarrierGK = carrier?.roleGroup === 'GK';
    const ballPos = carrier ? { x: carrier.x, y: carrier.y } : ctx.ball;
    const ballOwnP = toOwn(ballPos.x, dir);

    // Gegenpress: top yeni kaybedildiyse (3.5 sn içinde) baskı yarıçapı ve şiddeti artar
    const isCounterPress = ctx.secondsSincePossessionChange < 3.5 && style.pressIntensity > 0.95;
    const pressRadius = 15 + style.pressIntensity * 12 + (isCounterPress ? 6 : 0);

    // 1. BİRİNCİL PRESÇİ (Primary Presser)
    if (!isCarrierGK) {
      let bestPresser: EnginePlayerRuntime | null = null;
      let bestScore = 999;

      for (const p of mates) {
        if (p.roleGroup === 'GK' || ctx.locked.has(p.id)) continue;

        // Stoperler orta sahaya kadar çıkıp savunma göbeğini boşaltmasın
        if (p.roleGroup === 'CB' && ballOwnP > 34) continue;

        // Forvetler kendi ceza sahamıza kadar inip stoper gibi pres yapmasın
        if (p.roleGroup === 'ST' && ballOwnP < 36) continue;
        if (p.roleGroup === 'W' && ballOwnP < 30) continue;

        const dBall = dist(p.x, p.y, ballPos.x, ballPos.y);
        if (dBall > pressRadius) continue;

        const shapeAnchor = shape.get(p.id) || { x: p.baseX, y: p.baseY };
        const dAnchor = dist(shapeAnchor.x, shapeAnchor.y, ballPos.x, ballPos.y);
        const staminaPenalty = p.stamina < 55 ? 4.5 : 0;

        const score = dBall * 0.72 + dAnchor * 0.38 + staminaPenalty;
        if (score < bestScore) {
          bestScore = score;
          bestPresser = p;
        }
      }

      if (bestPresser) {
        res.presser = bestPresser;
        // Rakibin kalemize bakan tarafına (goal-side) doğru 1.1 birim mesafede baskı uygula
        const ownGoalX = fromOwn(2, dir);
        const vx = ownGoalX - ballPos.x;
        const vy = 32 - ballPos.y;
        const vLen = Math.hypot(vx, vy) || 1;
        res.pressPoint = {
          x: clamp(ballPos.x + (vx / vLen) * 1.1, 3, 97),
          y: clamp(ballPos.y + (vy / vLen) * 0.9, 3, 61)
        };
      }
    }

    // 2. İKİNCİL KADEME / DESTEK PRESÇİSİ (Cover / Secondary Presser)
    if (res.presser && !isCarrierGK) {
      let bestCover: EnginePlayerRuntime | null = null;
      let bestCoverScore = 999;

      const ownGoalX = fromOwn(2, dir);
      const gx = ownGoalX - ballPos.x;
      const gy = 32 - ballPos.y;
      const gLen = Math.hypot(gx, gy) || 1;
      const idealCoverPt: Vec2 = {
        x: clamp(ballPos.x + (gx / gLen) * 5.2, 4, 96),
        y: clamp(lerp(ballPos.y, 32, 0.28), 4, 60)
      };

      for (const p of mates) {
        if (p.roleGroup === 'GK' || p.id === res.presser.id || ctx.locked.has(p.id)) continue;
        if (p.roleGroup === 'CB' && ballOwnP > 30) continue;
        if (p.roleGroup === 'ST' || p.roleGroup === 'W') continue; // kademeyi orta saha veya bek yapar

        const d = dist(p.x, p.y, idealCoverPt.x, idealCoverPt.y);
        if (d > pressRadius * 0.9) continue;
        if (d < bestCoverScore) {
          bestCoverScore = d;
          bestCover = p;
        }
      }

      if (bestCover && (style.pressIntensity > 0.42 || ballOwnP < 42 || isCounterPress)) {
        res.cover = bestCover;
        res.coverPoint = idealCoverPt;
      }
    }

    // 3. PAS ARASI KESİCİ (Lane Cutter)
    if (carrier && !isCarrierGK) {
      // Taşıyıcının önündeki en tehlikeli pas opsiyonunu bul ve o koridora bir orta saha yerleştir
      let dangerousOpp: EnginePlayerRuntime | null = null;
      let bestDanger = -999;
      for (const o of opps) {
        if (o.id === carrier.id || o.roleGroup === 'GK') continue;
        const d = dist(carrier.x, carrier.y, o.x, o.y);
        if (d < 5 || d > 28) continue;
        const oppOwnP = toOwn(o.x, dir);
        if (oppOwnP > ballOwnP + 4) continue; // bizim kalemize daha yakın veya paralel olan tehdit
        const danger = (55 - oppOwnP) * 1.4 - Math.abs(o.y - 32) * 0.4;
        if (danger > bestDanger) {
          bestDanger = danger;
          dangerousOpp = o;
        }
      }

      if (dangerousOpp) {
        const laneMid: Vec2 = {
          x: lerp(carrier.x, dangerousOpp.x, 0.55),
          y: lerp(carrier.y, dangerousOpp.y, 0.55)
        };
        let bestCutter: EnginePlayerRuntime | null = null;
        let bestDist = 11.5;
        for (const p of mates) {
          if (
            p.roleGroup === 'GK' ||
            p.roleGroup === 'CB' ||
            p.id === res.presser?.id ||
            p.id === res.cover?.id ||
            ctx.locked.has(p.id)
          ) {
            continue;
          }
          if (p.roleGroup !== 'DM' && p.roleGroup !== 'CM' && p.roleGroup !== 'AM') continue;
          const d = dist(p.x, p.y, laneMid.x, laneMid.y);
          if (d < bestDist) {
            bestDist = d;
            bestCutter = p;
          }
        }
        if (bestCutter) {
          res.laneCutter = bestCutter;
          res.laneCutPoint = laneMid;
        }
      }
    }

    // 4. CEZA SAHASI VE TEHLİKE BÖLGESİ ADAM MARKAJI (Box & Half-space Marking)
    if (ballOwnP < 48) {
      const dangerousRunners = opps
        .filter((o) => o.id !== carrier?.id && o.roleGroup !== 'GK' && toOwn(o.x, dir) < 34)
        .sort((a, b) => toOwn(a.x, dir) - toOwn(b.x, dir));

      const usedDefenders = new Set<string>();
      if (res.presser) usedDefenders.add(res.presser.id);
      if (res.cover) usedDefenders.add(res.cover.id);
      if (res.laneCutter) usedDefenders.add(res.laneCutter.id);

      for (const runner of dangerousRunners) {
        let bestDef: EnginePlayerRuntime | null = null;
        let bestDist = 13.0;
        for (const d of mates) {
          if (usedDefenders.has(d.id) || ctx.locked.has(d.id)) continue;
          if (d.roleGroup !== 'CB' && d.roleGroup !== 'FB' && d.roleGroup !== 'WB' && d.roleGroup !== 'DM') continue;
          const dd = dist(d.x, d.y, runner.x, runner.y);
          if (dd < bestDist) {
            bestDist = dd;
            bestDef = d;
          }
        }
        if (bestDef) {
          usedDefenders.add(bestDef.id);
          // Rakip ile kendi kalemiz arasına (goal-side) 1.5 birim mesafede yerleş
          const ownGoalX = fromOwn(2, dir);
          const vx = ownGoalX - runner.x;
          const vy = 32 - runner.y;
          const vLen = Math.hypot(vx, vy) || 1;
          res.markers.set(bestDef.id, {
            x: clamp(runner.x + (vx / vLen) * 1.5, 4, 96),
            y: clamp(runner.y + (vy / vLen) * 1.2, 4, 60)
          });
        }
      }
    }

    // 5. Taşıyıcı üzerindeki efektif baskı hesabı (0..1)
    if (carrier) {
      let pressure = 0;
      for (const m of mates) {
        if (m.roleGroup === 'GK') continue;
        const d = dist(m.x, m.y, carrier.x, carrier.y);
        if (d < 11) {
          const defSkill = (m.effStats?.def ?? m.stats.def) / 100;
          pressure += Math.max(0, 1 - d / 11) * (0.45 + defSkill * 0.55);
        }
      }
      res.effectivePressure = Number(clamp(pressure, 0, 1).toFixed(2));
    }

    void segmentClosest;
    return res;
  }

  /**
   * Geriye dönük uyumluluk için korunmuş basit pres değerlendiricisi.
   */
  public static evaluatePressing(
    defTeam: EngineTeamRuntime,
    defPlayers: EnginePlayerRuntime[],
    carrier: EnginePlayerRuntime | null,
    isCarrierGK: boolean,
    isGoalKick: boolean
  ): PressingResult {
    if (!carrier || isCarrierGK || isGoalKick) {
      return { primaryPresser: null, secondaryPresser: null, effectivePressure: 0 };
    }

    const isHighPress = defTeam.tactics.playstyle === 'high_press';
    const hasDemandMore = defTeam.activeShout?.shout === 'demand_more';
    const baseRadius = (isHighPress ? 26.0 : 22.0) + (hasDemandMore ? 5.0 : 0.0);

    let primary: EnginePlayerRuntime | null = null;
    let secondary: EnginePlayerRuntime | null = null;
    let closestDist = 999.0;
    let secondClosestDist = 999.0;

    for (const p of defPlayers) {
      const profile = getRoleProfile(p.role);
      if (profile.isGoalkeeper) continue;

      if (profile.isStriker) {
        const isDefHome = defTeam.index === 0;
        const oppInDeepHalf = isDefHome ? carrier.x > 50 : carrier.x < 50;
        if (!oppInDeepHalf && !isHighPress) continue;
      }

      const d = Math.hypot(p.x - carrier.x, p.y - carrier.y);
      if (d < closestDist) {
        secondClosestDist = closestDist;
        secondary = primary;
        closestDist = d;
        primary = p;
      } else if (d < secondClosestDist) {
        secondClosestDist = d;
        secondary = p;
      }
    }

    if (closestDist > baseRadius) {
      primary = null;
      secondary = null;
    } else if (secondClosestDist > baseRadius * 0.75) {
      secondary = null;
    }

    let pressure = 0.0;
    if (primary) {
      const primaryDist = Math.hypot(primary.x - carrier.x, primary.y - carrier.y);
      const defFactor = primary.stats.def / 100.0;
      pressure += Math.max(0, 1.0 - primaryDist / 12.0) * (0.5 + defFactor * 0.5);
    }
    if (secondary) {
      const secDist = Math.hypot(secondary.x - carrier.x, secondary.y - carrier.y);
      pressure += Math.max(0, 1.0 - secDist / 16.0) * 0.35;
    }

    return {
      primaryPresser: primary,
      secondaryPresser: secondary,
      effectivePressure: Number(Math.min(1.0, pressure).toFixed(2))
    };
  }
}
