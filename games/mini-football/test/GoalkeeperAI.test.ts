import test from 'node:test';
import assert from 'node:assert/strict';

import { FootballPlayerEntity, FootballBallEntity, type FootballPlayerEntityType } from '@platform/sdk-core';
import { PlayerControllerSystem } from '../dist/server/PlayerControllerSystem.js';
import { BallSystem } from '../dist/server/BallSystem.js';
import { PossessionSystem } from '../dist/server/PossessionSystem.js';
import { PassingSystem } from '../dist/server/PassingSystem.js';
import { GoalkeeperAI } from '../dist/server/GoalkeeperAI.js';
import { PITCH_CONFIG } from '../dist/shared/config.js';

function createMockEnvironment() {
  const ballEntity = new FootballBallEntity();
  const players = new Map<string, FootballPlayerEntityType>();

  const ballSystem = new BallSystem(ballEntity);
  const possessionSystem = new PossessionSystem(ballSystem, players);
  const controller = new PlayerControllerSystem(players);
  const passingSystem = new PassingSystem(ballSystem, possessionSystem, players);

  const gk = new FootballPlayerEntity();
  gk.id = 'blue_0';
  gk.team = 'blue';
  gk.role = 'goalkeeper';
  gk.isGoalkeeper = true;
  gk.x = 0;
  gk.y = 0;
  gk.z = -42.2;
  gk.vx = 0;
  gk.vz = 0;
  gk.hasBall = false;

  const outfieldMate = new FootballPlayerEntity();
  outfieldMate.id = 'blue_1';
  outfieldMate.team = 'blue';
  outfieldMate.role = 'forward';
  outfieldMate.isGoalkeeper = false;
  outfieldMate.x = 0;
  outfieldMate.y = 0;
  outfieldMate.z = 10;
  outfieldMate.vx = 0;
  outfieldMate.vz = 0;
  outfieldMate.hasBall = false;

  players.set(gk.id, gk);
  players.set(outfieldMate.id, outfieldMate);

  const gkAI = new GoalkeeperAI(controller, passingSystem, possessionSystem, ballEntity, players);

  return {
    ball: ballEntity,
    ballSystem,
    possessionSystem,
    controller,
    passingSystem,
    gk,
    outfieldMate,
    players,
    gkAI,
  };
}

test('GoalkeeperAI clamps goalkeeper firmly to goalmouth box even if pushed to corner coordinates', () => {
  const { gk, gkAI } = createMockEnvironment();

  // Try placing goalkeeper at corner flag coordinates (-28, -45)
  gk.x = -28;
  gk.z = -45;

  gkAI.update(gk, 1 / 60);

  // Must be strictly clamped within goal mouth safe box (max |x| <= 8.8, max z <= -33)
  assert.ok(Math.abs(gk.x) <= 8.8, `Goalkeeper X (${gk.x}) exceeded goalmouth safe width (8.8)`);
  assert.ok(gk.z >= -43 && gk.z <= -33, `Goalkeeper Z (${gk.z}) drifted out of goal box`);
});

test('Goalkeeper cancels all velocity when in possession and does not dribble', () => {
  const { gk, ball, possessionSystem, gkAI } = createMockEnvironment();

  // Give goalkeeper high lateral velocity towards corner
  gk.vx = 15.0;
  gk.vz = -10.0;
  possessionSystem.takePossession(gk);

  assert.equal(ball.possessorId, gk.id);

  // Update Goalkeeper AI
  gkAI.update(gk, 1 / 60);

  // Goalkeeper velocities must be immediately frozen to 0
  assert.equal(gk.vx, 0, 'Goalkeeper vx should be 0 when holding ball');
  assert.equal(gk.vz, 0, 'Goalkeeper vz should be 0 when holding ball');
});

test('Kicker cooldown prevents goalkeeper from instantly re-catching their own pass/clearance', () => {
  const { gk, ball, possessionSystem, passingSystem } = createMockEnvironment();

  possessionSystem.takePossession(gk);
  assert.equal(ball.possessorId, gk.id);

  // Execute pass upfield
  passingSystem.executePass(gk, 0, 25.0);

  // Possession must be cleared
  assert.equal(ball.possessorId, '', 'Ball possessor should be empty right after kick');

  // Immediately step possession system (simulating next frame where ball is still within reach)
  possessionSystem.update(1 / 60);

  // Goalkeeper must NOT re-possess due to kicker cooldown
  assert.notEqual(ball.possessorId, gk.id, 'Goalkeeper should not immediately re-catch own kick');
});
