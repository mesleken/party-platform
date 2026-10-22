import test from 'node:test';
import assert from 'node:assert/strict';

import { SeededRandom } from '../dist/server/engine/random/SeededRandom.js';
import { GoalkeeperSystem } from '../dist/server/engine/systems/GoalkeeperSystem.js';
import { ShootingSystem } from '../dist/server/engine/systems/ShootingSystem.js';
import { MovementSystem } from '../dist/server/engine/systems/MovementSystem.js';
import { DuelSystem } from '../dist/server/engine/systems/DuelSystem.js';
import { BallSystem } from '../dist/server/engine/systems/BallSystem.js';
import { PassingSystem } from '../dist/server/engine/systems/PassingSystem.js';

function createMockPlayer(overrides: Partial<EnginePlayerRuntime> = {}): EnginePlayerRuntime {
  const stats = overrides.stats || { pac: 80, sho: 80, pas: 80, dri: 80, def: 80, phy: 80 };
  const effStats = overrides.effStats || { ...stats };
  const ovr = overrides.ovr ?? 80;
  return {
    id: overrides.id || 'p1',
    cardId: overrides.cardId || 'c1',
    slotIndex: overrides.slotIndex || 0,
    role: overrides.role || 'ST',
    name: overrides.name || 'Test Player',
    shortName: overrides.shortName || 'Player',
    number: overrides.number || 9,
    position: overrides.position || 'FWD',
    teamIndex: overrides.teamIndex || 0,
    baseX: overrides.baseX || 50,
    baseY: overrides.baseY || 32,
    x: overrides.x ?? 50,
    y: overrides.y ?? 32,
    targetX: overrides.targetX ?? 50,
    targetY: overrides.targetY ?? 32,
    stamina: overrides.stamina ?? 100,
    rating: overrides.rating ?? 7.0,
    goals: overrides.goals ?? 0,
    assists: overrides.assists ?? 0,
    action: overrides.action || 'IDLE',
    ovr,
    effOvr: overrides.effOvr ?? ovr,
    stats,
    effStats,
    card: {
      id: 'c1',
      name: 'Test',
      position: 'FWD',
      ovr,
      stats: { ...stats }
    } as any,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    ax: 0,
    ay: 0,
    heading: overrides.heading ?? 0,
    maxSpeed: overrides.maxSpeed ?? 11,
    maxAcceleration: overrides.maxAcceleration ?? 25,
    attackDirection: overrides.attackDirection ?? 1,
    urgency: overrides.urgency ?? 0.8,
    tackleCooldownSec: 0,
    noClaimUntil: 0,
    stunSec: 0,
    thinkTimerSec: 0,
    roleGroup: overrides.roleGroup || 'ST',
    ...overrides
  };
}

test('Shooting vs Goalkeeping: Elite shooter scores consistently against weak goalkeeper, while elite goalkeeper saves against weak shooter', () => {
  const rng = new SeededRandom(42);

  const eliteShooter = createMockPlayer({
    id: 'haaland',
    shortName: 'Haaland',
    ovr: 94,
    effOvr: 94,
    stats: { pac: 89, sho: 96, pas: 75, dri: 84, def: 45, phy: 92 },
    effStats: { pac: 89, sho: 96, pas: 75, dri: 84, def: 45, phy: 92 }
  });

  const weakShooter = createMockPlayer({
    id: 'novice-striker',
    shortName: 'Novice',
    ovr: 68,
    effOvr: 68,
    stats: { pac: 68, sho: 65, pas: 60, dri: 66, def: 35, phy: 68 },
    effStats: { pac: 68, sho: 65, pas: 60, dri: 66, def: 35, phy: 68 }
  });

  const eliteGk = createMockPlayer({
    id: 'courtois',
    shortName: 'Courtois',
    position: 'GK',
    roleGroup: 'GK',
    ovr: 91,
    effOvr: 91,
    stats: { pac: 50, sho: 40, pas: 78, dri: 92, def: 93, phy: 90 },
    effStats: { pac: 50, sho: 40, pas: 78, dri: 92, def: 93, phy: 90 }
  });

  const weakGk = createMockPlayer({
    id: 'amateur-gk',
    shortName: 'Amateur',
    position: 'GK',
    roleGroup: 'GK',
    ovr: 66,
    effOvr: 66,
    stats: { pac: 50, sho: 30, pas: 60, dri: 65, def: 67, phy: 66 },
    effStats: { pac: 50, sho: 30, pas: 60, dri: 65, def: 67, phy: 66 }
  });

  // Test 1: Elite shooter against Weak GK
  let eliteGoalsAgainstWeak = 0;
  const trials = 100;
  for (let i = 0; i < trials; i++) {
    const shotContext: ShotContext = {
      eventId: `e-${i}`,
      shooterId: eliteShooter.id,
      assisterId: null,
      attackingTeam: 0,
      startPosition: { x: 86, y: 32 },
      targetPosition: { x: 97.5, y: 32 },
      shotType: 'NORMAL',
      xgAtShot: 0.42,
      flightDurationSec: 0.35,
      elapsedSec: 0,
      maxHeight: 0.35,
      goalkeeperId: weakGk.id,
      outcome: 'GOAL',
      isOnTarget: true,
      shooterPower: 96
    };
    const res = GoalkeeperSystem.resolveSaveAttempt(weakGk, shotContext, rng);
    if (res.outcome === 'GOAL') eliteGoalsAgainstWeak++;
  }

  // Test 2: Weak shooter against Elite GK
  let weakGoalsAgainstElite = 0;
  for (let i = 0; i < trials; i++) {
    const shotContext: ShotContext = {
      eventId: `w-${i}`,
      shooterId: weakShooter.id,
      assisterId: null,
      attackingTeam: 0,
      startPosition: { x: 86, y: 32 },
      targetPosition: { x: 97.5, y: 32 },
      shotType: 'NORMAL',
      xgAtShot: 0.42,
      flightDurationSec: 0.35,
      elapsedSec: 0,
      maxHeight: 0.35,
      goalkeeperId: eliteGk.id,
      outcome: 'GOAL',
      isOnTarget: true,
      shooterPower: 65
    };
    const res = GoalkeeperSystem.resolveSaveAttempt(eliteGk, shotContext, rng);
    if (res.outcome === 'GOAL') weakGoalsAgainstElite++;
  }

  // Elite shooter vs weak GK must score dramatically more than weak shooter vs elite GK!
  assert.ok(
    eliteGoalsAgainstWeak > weakGoalsAgainstElite + 40,
    `Elite striker should heavily outscore weak striker against elite GK (elite: ${eliteGoalsAgainstWeak}, weak: ${weakGoalsAgainstElite})`
  );
  assert.ok(eliteGoalsAgainstWeak >= 80, `Elite striker vs weak GK should convert >= 80% (got ${eliteGoalsAgainstWeak}%)`);
  assert.ok(weakGoalsAgainstElite <= 35, `Weak striker vs elite GK should be restricted to <= 35% (got ${weakGoalsAgainstElite}%)`);
});

test('MovementSystem: High pace and agility players achieve noticeably higher top speed and acceleration', () => {
  const speedster = createMockPlayer({
    stats: { pac: 96, sho: 80, pas: 75, dri: 92, def: 40, phy: 78 },
    effStats: { pac: 96, sho: 80, pas: 75, dri: 92, def: 40, phy: 78 },
    ovr: 91,
    effOvr: 91,
    action: 'SPRINT_RUN',
    targetX: 90,
    targetY: 32,
    x: 20,
    y: 32
  });

  const slowDefender = createMockPlayer({
    stats: { pac: 60, sho: 40, pas: 65, dri: 62, def: 88, phy: 86 },
    effStats: { pac: 60, sho: 40, pas: 65, dri: 62, def: 88, phy: 86 },
    ovr: 81,
    effOvr: 81,
    action: 'SPRINT_RUN',
    targetX: 90,
    targetY: 32,
    x: 20,
    y: 32
  });

  const mockTeams = [
    { tactics: { playstyle: 'balanced' }, mentality: 'balanced' },
    { tactics: { playstyle: 'balanced' }, mentality: 'balanced' }
  ] as any;
  MovementSystem.updateMovement([speedster, slowDefender], mockTeams, 0, 0.05);

  // Verify speed difference is > 25%
  assert.ok(
    speedster.maxSpeed > slowDefender.maxSpeed * 1.25,
    `Speedster maxSpeed (${speedster.maxSpeed}) should be > 25% faster than slowDefender (${slowDefender.maxSpeed})`
  );

  // Verify acceleration difference
  assert.ok(
    speedster.maxAcceleration > slowDefender.maxAcceleration * 1.2,
    `Speedster acceleration (${speedster.maxAcceleration}) should exceed slowDefender (${slowDefender.maxAcceleration})`
  );
});

test('DuelSystem: Defensive ratings and dribbling ratings heavily influence tackle success', () => {
  const rng = new SeededRandom(101);

  const starDefender = createMockPlayer({
    shortName: 'Van Dijk',
    stats: { pac: 78, sho: 60, pas: 75, dri: 72, def: 92, phy: 90 },
    effStats: { pac: 78, sho: 60, pas: 75, dri: 72, def: 92, phy: 90 },
    ovr: 90,
    effOvr: 90
  });

  const weakDefender = createMockPlayer({
    shortName: 'Weak Def',
    stats: { pac: 65, sho: 40, pas: 60, dri: 60, def: 65, phy: 68 },
    effStats: { pac: 65, sho: 40, pas: 65, dri: 60, def: 65, phy: 68 },
    ovr: 66,
    effOvr: 66
  });

  const starDribbler = createMockPlayer({
    shortName: 'Vinicius',
    stats: { pac: 95, sho: 84, pas: 80, dri: 92, def: 35, phy: 74 },
    effStats: { pac: 95, sho: 84, pas: 80, dri: 92, def: 35, phy: 74 },
    ovr: 89,
    effOvr: 89
  });

  let vanDijkStops = 0;
  let weakDefStops = 0;
  const trials = 100;

  for (let i = 0; i < trials; i++) {
    const res1 = DuelSystem.resolveTackle(starDefender, starDribbler, rng, i, 0);
    if (res1.success) vanDijkStops++;

    const res2 = DuelSystem.resolveTackle(weakDefender, starDribbler, rng, i, 0);
    if (res2.success) weakDefStops++;
  }

  assert.ok(
    vanDijkStops > weakDefStops + 15,
    `Star defender should win significantly more duels against star dribbler than weak defender (Van Dijk: ${vanDijkStops}, Weak: ${weakDefStops})`
  );
});

test('Magnetic Ball Control: BallSystem magnetically locks ball under carrier foot and handles reception', () => {
  const ballSystem = new BallSystem(0);
  const carrier = createMockPlayer({
    x: 45.0,
    y: 30.0,
    heading: 0,
    action: 'IDLE'
  });

  ballSystem.setControlled(carrier);
  assert.equal(ballSystem.getCarrierId(), carrier.id);
  assert.equal(ballSystem.getState().mode, 'CONTROLLED');

  const ballPos = ballSystem.getPosition();
  // Ball should be positioned cleanly in front of carrier along heading vector
  assert.ok(ballPos.x > carrier.x, 'Ball should be placed ahead of carrier heading');
  assert.ok(Math.abs(ballPos.y - carrier.y) < 0.1, 'Ball y should match carrier y');

  // Move carrier and update physics
  carrier.x = 48.0;
  carrier.y = 31.0;
  carrier.heading = Math.PI / 4; // 45 degrees
  ballSystem.updatePhysics(0.016, [carrier], () => {}, () => {});

  const newBallPos = ballSystem.getPosition();
  assert.ok(newBallPos.x > 48.0, 'Ball x should follow carrier');
  assert.ok(newBallPos.y > 31.0, 'Ball y should follow carrier');
});
