import test from 'node:test';
import assert from 'node:assert/strict';

import {
  stepVehicleDynamics,
  recoverPlayerToTrack,
  resolveObstacleCollisions,
} from '../dist/server/VehicleDynamics.js';
import { DEFAULT_VEHICLE_CONFIG } from '../dist/shared/tuning.js';
import { TRACK_WAYPOINTS } from '../dist/shared/track.js';

function createMockVehicle(overrides: any = {}): any {
  return {
    id: 'p1',
    x: 0,
    y: 0.35,
    z: -45,
    vx: 0,
    vz: 0,
    vForward: 0,
    vLateral: 0,
    rotation: Math.PI / 2, // Facing East (+X)
    pitch: 0,
    roll: 0,
    wheelSteer: 0,
    wheelRotation: 0,
    speed: 0,
    filteredSteer: 0,
    boostMeter: 100,
    isBoosting: false,
    isDrifting: false,
    slipRatio: 0,
    rpmNormalized: 0.25,
    isSpinning: false,
    spinTimerMs: 0,
    finished: false,
    checkpointIndex: 0,
    ...overrides,
  };
}

test('Vehicle accelerates forward in its heading direction', () => {
  const car = createMockVehicle({ rotation: Math.PI / 2, vForward: 0 }); // East (+X)
  const dt = 1 / 60;

  // Apply full throttle for 30 ticks (0.5s)
  for (let i = 0; i < 30; i++) {
    stepVehicleDynamics(car, { steer: 0, throttle: 1.0, brake: 0, boost: false, useItem: false }, dt);
  }

  assert.ok(car.vForward > 10, 'Car should have accelerated forward');
  assert.ok(car.x > 0, 'Car should have moved along +X axis (East)');
  assert.ok(Math.abs(car.z - (-45)) < 0.05, 'Car should not slide along Z axis when driving straight');
});

test('Steering rotates vehicle heading angle without artificial lateral jump', () => {
  const car = createMockVehicle({ rotation: Math.PI / 2, vForward: 50, vx: 50 / 3.6, vz: 0 });
  const dt = 1 / 60;

  const initialZ = car.z;
  const initialRotation = car.rotation;

  // Step vehicle turning left (negative steer)
  stepVehicleDynamics(car, { steer: -1.0, throttle: 1.0, brake: 0, boost: false, useItem: false }, dt);

  // Steer left should rotate counter-clockwise (increasing rotation angle)
  assert.ok(car.rotation > initialRotation, 'Heading angle should rotate counter-clockwise on steer left');
  // Check that the car did not instantly jump sideways in a single frame
  assert.ok(Math.abs(car.vLateral) < 5.0, 'Lateral velocity should ramp smoothly through physics rather than spike instantly');
});

test('Tire grip damps lateral velocity over time', () => {
  const car = createMockVehicle({ rotation: 0, vForward: 60, vLateral: 30, vx: 30 / 3.6, vz: 60 / 3.6 });
  const dt = 1 / 60;

  const initialLateral = car.vLateral;

  // Simulate without steering input for 15 frames
  for (let i = 0; i < 15; i++) {
    stepVehicleDynamics(car, { steer: 0, throttle: 0.5, brake: 0, boost: false, useItem: false }, dt);
  }

  assert.ok(Math.abs(car.vLateral) < Math.abs(initialLateral) * 0.4, 'Tire grip should rapidly damp out lateral velocity');
});

test('Recovery command aligns vehicle back to track waypoint', () => {
  // Displace car far away in the desert/room
  const car = createMockVehicle({ x: 999, z: 999, rotation: -2.5, vForward: 80, checkpointIndex: 0 });

  recoverPlayerToTrack(car);

  const wp0 = TRACK_WAYPOINTS[0];
  assert.equal(car.x, wp0.x, 'Car should be reset to checkpoint 0 x');
  assert.equal(car.z, wp0.z, 'Car should be reset to checkpoint 0 z');
  assert.equal(car.vLateral, 0, 'Lateral velocity should be zeroed out on recovery');
  assert.ok(car.vForward > 0, 'Car should have rolling start forward');
});

test('Tangential wall collision deflects car without hard freeze', () => {
  const mockObstacle = {
    id: 'test_obs',
    name: 'Obstacle',
    x: 10,
    z: 0,
    radius: 5,
    bounceMultiplier: 1.2,
  };

  // Car moving towards the obstacle along +X at boundary
  const car = createMockVehicle({
    x: 4.0, // within radius (5 + 1.25 = 6.25 minDist)
    z: 0,
    vx: 15,
    vz: 0,
    vForward: 54,
  });

  const collided = resolveObstacleCollisions(car, [mockObstacle]);

  assert.ok(collided, 'Collision should be detected');
  assert.ok(car.x < 4.0, 'Car should be pushed outward away from obstacle');
  assert.ok(car.vForward > 0, 'Forward speed should be damped but car should not freeze dead');
});
