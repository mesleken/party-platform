import { EnginePlayerRuntime, EngineTeamRuntime, PassContext, ShotContext } from '../MatchState.js';
import { ExpectedGoalsModel } from '../analytics/ExpectedGoalsModel.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { clamp, dist } from '../util/Geometry.js';
import { GoalkeeperSystem } from './GoalkeeperSystem.js';

export interface ShotInitiationResult {
  allowed: boolean;
  blockedByDefender?: {
    defender: EnginePlayerRuntime;
    toCorner: boolean;
    commentary: string;
  };
  shotContext?: ShotContext;
}

export interface ShotResolutionResult {
  outcome: 'GOAL' | 'SAVE_HELD' | 'SAVE_CORNER' | 'SAVE_REBOUND' | 'WOODWORK' | 'WIDE';
  shooter: EnginePlayerRuntime;
  assister: EnginePlayerRuntime | null;
  goalkeeper: EnginePlayerRuntime;
  xg: number;
  commentary: string;
}

export class ShootingSystem {
  public static attemptShot(
    shooter: EnginePlayerRuntime,
    team: EngineTeamRuntime,
    defendingPlayers: EnginePlayerRuntime[],
    lastPass: PassContext | null,
    isOneOnOne: boolean,
    shotType: ShotContext['shotType'],
    eventId: string,
    rng: SeededRandom
  ): ShotInitiationResult {
    const dir = team.attackDirection;
    const oppGoalX = dir === 1 ? 97.5 : 2.5;
    const distToGoal = Math.abs(shooter.x - oppGoalX);
    const inAttackingThird = dir === 1 ? shooter.x >= 68.0 : shooter.x <= 32.0;

    // Kesin güvence: Kendi yarı sahasından veya 27 birimden uzaktan şut çekilemez
    if (!inAttackingThird || distToGoal > 27.0) {
      return { allowed: false };
    }

    const eff = shooter.effStats || shooter.stats;

    // En yakın savunmacıyı bul (yalnızca şutör ile kale arasındaki konide olanlar blok yapabilir)
    let nearestDef: EnginePlayerRuntime | null = null;
    let nearestDefDist = 999.0;
    let nearestBlocker: EnginePlayerRuntime | null = null;
    let nearestBlockerDist = 999.0;

    for (const d of defendingPlayers) {
      if (d.roleGroup === 'GK') continue;
      const dDist = dist(d.x, d.y, shooter.x, shooter.y);
      if (dDist < nearestDefDist) {
        nearestDefDist = dDist;
        nearestDef = d;
      }
      const inFrontOfShooter = dir === 1 ? d.x > shooter.x - 0.5 : d.x < shooter.x + 0.5;
      if (inFrontOfShooter && Math.abs(d.y - shooter.y) < 3.2 && dDist < nearestBlockerDist) {
        nearestBlockerDist = dDist;
        nearestBlocker = d;
      }
    }

    // Savunma Blokajı Kontrolü (yalnızca şut açısında ve <= 3.2 birim yakında savunmacı varsa!)
    const blockDef = nearestBlocker;
    if (blockDef && nearestBlockerDist <= 3.2) {
      const defEff = blockDef.effStats || blockDef.stats;
      const blockChance = clamp(0.18 + (defEff.def - eff.sho) * 0.004, 0.10, 0.34);
      if (rng.chance(blockChance)) {
        blockDef.action = 'TACKLE';
        const toCorner = rng.chance(0.52);
        return {
          allowed: false,
          blockedByDefender: {
            defender: blockDef,
            toCorner,
            commentary: toCorner
              ? `🛡️ KRİTİK BLOK! ${blockDef.shortName} şut açısını kapatarak topu kornere çeldi!`
              : `🛡️ ${blockDef.shortName} ceza sahasında vücudunu siper ederek şutu blokladı!`
          }
        };
      }
    }

    // xG Hesabı (Oyuncunun efektif şut kalitesi ve OVR bonusu dahil)
    const effectiveSho = clamp(eff.sho * 0.75 + (shooter.effOvr || shooter.ovr) * 0.25, 50, 99);
    const xgShotType: 'NORMAL' | 'HEADER' | 'VOLLEY' | 'LONG_SHOT' =
      shotType === 'HEADER' || shotType === 'VOLLEY' || shotType === 'LONG_SHOT' ? shotType : 'NORMAL';
    const xgAtShot = ExpectedGoalsModel.calculateXg({
      shooterPos: { x: shooter.x, y: shooter.y },
      goalX: oppGoalX,
      shotType: xgShotType,
      shooterSho: effectiveSho,
      defenderProximity: nearestDefDist,
      isOneOnOne
    });

    const gk = defendingPlayers.find((p) => p.roleGroup === 'GK') || defendingPlayers[0];

    let assisterId: string | null = null;
    if (lastPass && lastPass.passerId !== shooter.id && lastPass.attackingTeam === shooter.teamIndex) {
      assisterId = lastPass.passerId;
    }

    // Şutun kaleyi bulma olasılığı (SHO ve OVR yüksek yıldızlar çerçeveyi çok daha yüksek oranda bulur)
    const onTargetProb = clamp(0.58 + (effectiveSho - 74) * 0.011 + (isOneOnOne ? 0.14 : 0), 0.42, 0.88);
    const isOnTarget = rng.chance(onTargetProb);

    const targetY = isOnTarget
      ? 32.0 + (rng.chance(0.5) ? 1 : -1) * rng.range(1.2, 3.8)
      : 32.0 + (rng.chance(0.5) ? 1 : -1) * rng.range(4.8, 7.5);

    const flightDurationSec = clamp(distToGoal / (29.0 + (effectiveSho - 75) * 0.18), 0.28, 0.56);

    const shotContext: ShotContext = {
      eventId,
      shooterId: shooter.id,
      assisterId,
      attackingTeam: shooter.teamIndex,
      startPosition: { x: shooter.x, y: shooter.y },
      targetPosition: { x: oppGoalX, y: Number(targetY.toFixed(1)) },
      shotType,
      xgAtShot,
      flightDurationSec,
      elapsedSec: 0,
      maxHeight: shotType === 'HEADER' ? 0.85 : shotType === 'LONG_SHOT' ? 0.65 : 0.35,
      goalkeeperId: gk?.id || null,
      outcome: 'GOAL',
      isOnTarget
    };

    void nearestDef;
    return {
      allowed: true,
      shotContext
    };
  }

  public static resolveShot(
    shot: ShotContext,
    players: EnginePlayerRuntime[],
    rng: SeededRandom
  ): ShotResolutionResult {
    const shooter = players.find((p) => p.id === shot.shooterId) || players[0];
    const assister = shot.assisterId ? (players.find((p) => p.id === shot.assisterId) || null) : null;
    const gk =
      (shot.goalkeeperId ? players.find((p) => p.id === shot.goalkeeperId) : null) ||
      players.find((p) => p.teamIndex !== shooter.teamIndex && p.roleGroup === 'GK') ||
      players[players.length - 1];

    // Kaleyi bulmayan şut: Direk veya Aut
    if (shot.isOnTarget === false) {
      if (rng.chance(0.24)) {
        shot.outcome = 'WOODWORK';
        return {
          outcome: 'WOODWORK',
          shooter,
          assister,
          goalkeeper: gk,
          xg: shot.xgAtShot,
          commentary: `💥 DİREKTEN DÖNDÜ! ${shooter.shortName}'ın müthiş vuruşunda direk gole izin vermedi! [xG: ${shot.xgAtShot}]`
        };
      }
      shot.outcome = 'WIDE';
      return {
        outcome: 'WIDE',
        shooter,
        assister,
        goalkeeper: gk,
        xg: shot.xgAtShot,
        commentary: `${shooter.shortName} kaleyi yokladı ancak top direğin yanından auta çıktı.`
      };
    }

    // Kaleyi bulan şut: Kaleci kurtarış denemesi
    const gkRes = GoalkeeperSystem.resolveSaveAttempt(gk, shot, rng);
    shot.outcome = gkRes.outcome;

    if (gkRes.outcome === 'GOAL') {
      shooter.goals++;
      shooter.rating = Math.min(10.0, shooter.rating + 1.1);
      if (assister) {
        assister.assists++;
        assister.rating = Math.min(10.0, assister.rating + 0.65);
      }

      const finishFlavor =
        shot.shotType === 'HEADER'
          ? 'şık bir kafa vuruşuyla'
          : shot.shotType === 'VOLLEY'
            ? 'gelişine sert bir voleyle'
            : shot.shotType === 'LONG_SHOT'
              ? 'uzaktan füze gibi bir vuruşla'
              : 'net bir plaseyle';

      return {
        outcome: 'GOAL',
        shooter,
        assister,
        goalkeeper: gk,
        xg: shot.xgAtShot,
        commentary: assister
          ? `⚽ GOOOOL!! ${assister.shortName} nefis gördü, ${shooter.shortName} ${finishFlavor} ağları sarstı! [xG: ${shot.xgAtShot}]`
          : `⚽ GOOOOL!! ${shooter.shortName} ceza sahasında ${finishFlavor} fileleri havalandırdı! [xG: ${shot.xgAtShot}]`
      };
    }

    return {
      outcome: gkRes.outcome,
      shooter,
      assister,
      goalkeeper: gk,
      xg: shot.xgAtShot,
      commentary: gkRes.commentary
    };
  }
}
