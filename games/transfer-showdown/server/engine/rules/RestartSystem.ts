import { EnginePlayerRuntime, RestartState, Vec2 } from '../MatchState.js';
import { clamp, dist, fromOwn } from '../util/Geometry.js';

export class RestartSystem {
  public static createKickOffRestart(
    takingTeam: 0 | 1,
    players: EnginePlayerRuntime[],
    half: 1 | 2
  ): RestartState {
    const centerSpot: Vec2 = { x: 50.0, y: 32.0 };

    // Tüm oyuncuları kendi yarı sahalarındaki başlangıç dizilişlerine yerleştir (rakip yarı sahada santra başlangıcı olamaz!)
    for (const p of players) {
      p.action = 'IDLE';
      p.vx = 0;
      p.vy = 0;
      p.stunSec = 0;
      const dir = p.attackDirection;
      const anchorOwnP = dir === 1 ? p.baseX : 100.0 - p.baseX;
      // Santrada herkes kendi yarı sahasında (ownP <= 46.5) dizilir; rakip takım orta yuvarlağın dışında kalır
      let kickoffOwnP = p.roleGroup === 'GK' ? 5.0 : clamp(12.0 + (anchorOwnP - 16.0) * 0.68, 14.0, 46.5);
      if (p.teamIndex !== takingTeam && Math.abs(p.baseY - 32.0) < 12.0 && kickoffOwnP > 39.5) {
        kickoffOwnP = 39.5;
      }
      const kx = dir === 1 ? kickoffOwnP : 100.0 - kickoffOwnP;
      p.targetX = Number(kx.toFixed(1));
      p.targetY = p.baseY;
      p.x = p.targetX;
      p.y = p.targetY;
    }

    const attTeamPlayers = players.filter((p) => p.teamIndex === takingTeam);
    const striker = attTeamPlayers.find((p) => p.position === 'FWD') || attTeamPlayers[attTeamPlayers.length - 1];
    if (striker) {
      const offsetX = striker.attackDirection === 1 ? -0.6 : 0.6;
      striker.targetX = centerSpot.x + offsetX;
      striker.targetY = centerSpot.y;
      striker.x = striker.targetX;
      striker.y = striker.targetY;
      striker.action = 'CARRY';
    }

    void half;
    return {
      type: 'KICK_OFF',
      takingTeam,
      takerId: striker?.id || null,
      spot: centerSpot,
      waitTimerSec: 1.8,
      elapsedSec: 0
    };
  }

  public static createCornerRestart(
    takingTeam: 0 | 1,
    players: EnginePlayerRuntime[],
    cornerY: number
  ): RestartState {
    const attPlayers = players.filter((p) => p.teamIndex === takingTeam);
    const dir = attPlayers[0]?.attackDirection ?? (takingTeam === 0 ? 1 : -1);

    const cornerSpot: Vec2 = {
      x: fromOwn(98.5, dir),
      y: cornerY < 32 ? 3.0 : 61.0
    };

    for (const p of players) {
      p.action = 'IDLE';
    }

    // Korner noktasına en yakın kanat/orta saha/bek oyuncusunu seç
    const candidates = attPlayers.filter(
      (p) => p.roleGroup === 'W' || p.roleGroup === 'WM' || p.roleGroup === 'AM' || p.roleGroup === 'CM' || p.roleGroup === 'FB' || p.roleGroup === 'WB'
    );
    const pool = candidates.length > 0 ? candidates : attPlayers.filter((p) => p.roleGroup !== 'GK');
    pool.sort((a, b) => dist(a.x, a.y, cornerSpot.x, cornerSpot.y) - dist(b.x, b.y, cornerSpot.x, cornerSpot.y));
    const taker = pool[0] || attPlayers[attPlayers.length - 1];

    if (taker) {
      taker.targetX = cornerSpot.x;
      taker.targetY = cornerSpot.y;
      taker.action = 'SUPPORT';
    }

    return {
      type: 'CORNER',
      takingTeam,
      takerId: taker?.id || null,
      spot: cornerSpot,
      waitTimerSec: 2.2,
      elapsedSec: 0
    };
  }

  public static createGoalKickRestart(
    takingTeam: 0 | 1,
    players: EnginePlayerRuntime[]
  ): RestartState {
    const teamPlayers = players.filter((p) => p.teamIndex === takingTeam);
    const dir = teamPlayers[0]?.attackDirection ?? (takingTeam === 0 ? 1 : -1);
    const gk = teamPlayers.find((p) => p.position === 'GK' || p.roleGroup === 'GK') || teamPlayers[0];

    const gkSpot: Vec2 = {
      x: fromOwn(5.8, dir),
      y: clamp(gk ? gk.y : 32.0, 27.0, 37.0)
    };

    for (const p of players) {
      p.action = 'IDLE';
    }

    if (gk) {
      gk.targetX = gkSpot.x;
      gk.targetY = gkSpot.y;
      gk.action = 'CARRY';
    }

    return {
      type: 'GOAL_KICK',
      takingTeam,
      takerId: gk?.id || null,
      spot: gkSpot,
      waitTimerSec: 2.0,
      elapsedSec: 0
    };
  }

  public static createFreeKickRestart(
    takingTeam: 0 | 1,
    spot: Vec2,
    players: EnginePlayerRuntime[],
    reason: 'OFFSIDE' | 'FOUL'
  ): RestartState {
    const safeSpot: Vec2 = {
      x: clamp(spot.x, 5.0, 95.0),
      y: clamp(spot.y, 4.0, 60.0)
    };

    for (const p of players) {
      p.action = 'IDLE';
    }

    // Serbest vuruş noktasına en yakın saha içi oyuncuyu seç (kaleci kendi ceza sahası dışına çıkmasın)
    const teamPlayers = players.filter((p) => p.teamIndex === takingTeam && p.roleGroup !== 'GK');
    teamPlayers.sort((a, b) => dist(a.x, a.y, safeSpot.x, safeSpot.y) - dist(b.x, b.y, safeSpot.x, safeSpot.y));
    const taker = teamPlayers[0] || players.find((p) => p.teamIndex === takingTeam) || null;

    if (taker) {
      taker.targetX = safeSpot.x;
      taker.targetY = safeSpot.y;
      taker.action = 'SUPPORT';
    }

    void reason;
    return {
      type: 'FREE_KICK',
      takingTeam,
      takerId: taker?.id || null,
      spot: safeSpot,
      waitTimerSec: 2.0,
      elapsedSec: 0
    };
  }

  public static createThrowInRestart(
    takingTeam: 0 | 1,
    spot: Vec2,
    players: EnginePlayerRuntime[]
  ): RestartState {
    const safeSpot: Vec2 = {
      x: clamp(spot.x, 6.0, 94.0),
      y: spot.y < 32 ? 1.5 : 62.5
    };

    for (const p of players) {
      p.action = 'IDLE';
    }

    // Taç çizgisine en yakın bek / kanat / orta saha oyuncusunu taç atıcısı olarak seç
    const teamPlayers = players.filter((p) => p.teamIndex === takingTeam && p.roleGroup !== 'GK');
    teamPlayers.sort((a, b) => dist(a.x, a.y, safeSpot.x, safeSpot.y) - dist(b.x, b.y, safeSpot.x, safeSpot.y));
    const taker = teamPlayers[0] || players.find((p) => p.teamIndex === takingTeam) || null;

    if (taker) {
      taker.targetX = safeSpot.x;
      taker.targetY = safeSpot.y;
      taker.action = 'SUPPORT';
    }

    return {
      type: 'THROW_IN',
      takingTeam,
      takerId: taker?.id || null,
      spot: safeSpot,
      waitTimerSec: 1.9,
      elapsedSec: 0
    };
  }
}
