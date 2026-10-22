import { RcRushInput } from '../shared/types.js';
import { TRACK_CONFIG, TRACK_WAYPOINTS, ObstacleCollider } from '../shared/track.js';
import { VehicleConfig, DEFAULT_VEHICLE_CONFIG } from '../shared/tuning.js';

export function getDistanceToTrackSpline(x: number, z: number): number {
  let minDist = Infinity;
  const len = TRACK_WAYPOINTS.length;
  for (let i = 0; i < len; i++) {
    const p1 = TRACK_WAYPOINTS[i];
    const p2 = TRACK_WAYPOINTS[(i + 1) % len];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (z - p1.z) * dz) / lenSq));
    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const dist = Math.hypot(x - projX, z - projZ);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

export interface VehiclePhysicsState {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vForward: number;     // Forward speed (km/h)
  vLateral: number;     // Lateral slip speed (km/h)
  rotation: number;     // Heading/Yaw in radians (normalized to [-PI, PI])
  pitch: number;        // Body pitch angle (radians)
  roll: number;         // Body roll tilt angle (radians)
  wheelSteer: number;   // Front wheel angle
  wheelRotation: number;// Wheel rolling rotation
  speed: number;        // Speed for HUD/display
  filteredSteer: number;// Smoothly ramped steering input [-1.0, 1.0]
  boostMeter: number;   // 0 - 100
  isBoosting: boolean;
  isDrifting: boolean;
  slipRatio: number;    // 0 - 1 drift ratio for smoke/skidmarks
  rpmNormalized: number;// 0 - 1 for LED tachometer
  isSpinning: boolean;
  spinTimerMs: number;
  finished: boolean;
  checkpointIndex: number;
}

/**
 * Respawns and aligns the car on the track at its last passed waypoint.
 */
export function recoverPlayerToTrack(p: VehiclePhysicsState): void {
  const currentWp = TRACK_WAYPOINTS[p.checkpointIndex] || TRACK_WAYPOINTS[0];
  const nextWp = TRACK_WAYPOINTS[(p.checkpointIndex + 1) % TRACK_WAYPOINTS.length];

  const dx = nextWp.x - currentWp.x;
  const dz = nextWp.z - currentWp.z;
  const targetHeading = Math.atan2(dx, dz);

  p.x = currentWp.x;
  p.y = 0.35;
  p.z = currentWp.z;
  p.rotation = targetHeading;
  p.vForward = 25; // Gentle rolling start forward
  p.vLateral = 0;
  p.vx = Math.sin(targetHeading) * (25 / 3.6);
  p.vz = Math.cos(targetHeading) * (25 / 3.6);
  p.pitch = 0;
  p.roll = 0;
  p.filteredSteer = 0;
  p.isSpinning = false;
  p.spinTimerMs = 0;
  p.isDrifting = false;
  p.slipRatio = 0;
}

/**
 * Pure arcade vehicle dynamics step.
 * Uses heading/yaw-based orientation with realistic tire grip damping on inertial lateral motion.
 * No artificial sideways position teleportation or arbitrary centripetal force injection.
 */
export function stepVehicleDynamics(
  p: VehiclePhysicsState,
  input: RcRushInput,
  dt: number,
  config: VehicleConfig = DEFAULT_VEHICLE_CONFIG
): void {
  // 1. Manual Recovery / Reset Command
  if (input.recover) {
    recoverPlayerToTrack(p);
    return;
  }

  // 2. Spinning State (Hit by missile or oil slip)
  if (p.isSpinning) {
    p.spinTimerMs -= dt * 1000;
    p.rotation += 14 * dt;
    // Normalize rotation
    while (p.rotation > Math.PI) p.rotation -= Math.PI * 2;
    while (p.rotation < -Math.PI) p.rotation += Math.PI * 2;

    p.vForward = Math.max(10, p.vForward - 60 * dt);
    p.vLateral *= Math.max(0, 1 - 6 * dt);
    const fwdX = Math.sin(p.rotation);
    const fwdZ = Math.cos(p.rotation);
    p.vx = fwdX * (p.vForward / 3.6);
    p.vz = fwdZ * (p.vForward / 3.6);
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.speed = p.vForward;
    p.slipRatio = 0.85;

    if (p.spinTimerMs <= 0) {
      p.isSpinning = false;
    }
    return;
  }

  // 3. Race Finished State (Graceful slow down)
  if (p.finished) {
    p.vForward = Math.max(0, p.vForward - 35 * dt);
    p.vLateral *= Math.max(0, 1 - 12 * dt);
    const fwdX = Math.sin(p.rotation);
    const fwdZ = Math.cos(p.rotation);
    p.vx = fwdX * (p.vForward / 3.6);
    p.vz = fwdZ * (p.vForward / 3.6);
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.speed = p.vForward;
    return;
  }

  // 4. Steer Input Normalization & Controlled Rate-Limiting (Smoothing)
  const rawSteer = Math.max(-1.0, Math.min(1.0, input.steer || 0));
  const steerFilterSpeed = config.steerFilterRate * dt;
  p.filteredSteer += (rawSteer - p.filteredSteer) * Math.min(1.0, steerFilterSpeed);
  if (Math.abs(p.filteredSteer) < 0.003 && rawSteer === 0) {
    p.filteredSteer = 0;
  }

  // 5. Boost / Nitro Dynamics
  p.isBoosting = false;
  if (input.boost && p.boostMeter > 5) {
    p.isBoosting = true;
    p.boostMeter = Math.max(0, p.boostMeter - config.boostDrainRate * dt);
  } else {
    p.boostMeter = Math.min(100, p.boostMeter + config.boostRechargeRate * dt);
  }

  const currentMaxSpeed = p.isBoosting ? config.boostSpeed : config.maxSpeed;

  // 6. Forward Acceleration / Braking / Reversing
  const throttle = Math.max(0, Math.min(1.0, input.throttle || 0));
  const brake = Math.max(0, Math.min(1.0, input.brake || 0));

  if (throttle > 0) {
    const targetForwardSpeed = currentMaxSpeed * throttle;
    const accel = p.isBoosting ? config.boostAccelRate : config.accelRate;
    if (p.vForward < targetForwardSpeed) {
      p.vForward = Math.min(targetForwardSpeed, p.vForward + accel * dt);
    }
  } else if (brake > 0) {
    if (p.vForward > 1.2) {
      // Regular braking
      p.vForward = Math.max(0, p.vForward - config.brakeRate * dt * brake);
    } else {
      // Reverse gear
      p.vForward = Math.max(-config.reverseSpeed, p.vForward - config.reverseAccelRate * dt * brake);
    }
  } else {
    // Natural friction / rolling resistance
    if (p.vForward > 0) {
      p.vForward = Math.max(0, p.vForward - config.frictionRate * dt);
    } else if (p.vForward < 0) {
      p.vForward = Math.min(0, p.vForward + config.frictionRate * dt);
    }
  }

  // 7. Offroad / Border Resistance
  const distToTrackCenter = getDistanceToTrackSpline(p.x, p.z);
  const isOffroad = distToTrackCenter > (TRACK_CONFIG.trackWidth / 2 + 1.2);
  if (isOffroad && !p.isBoosting && p.vForward > config.offroadSpeedCap) {
    p.vForward = Math.max(config.offroadSpeedCap, p.vForward - config.offroadDecel * dt);
  }

  // 8. Steering & Yaw Rotation
  // In Three.js coordinate convention:
  // Heading angle rotation (yaw around Y axis):
  // rotation = 0: Forward is +Z
  // rotation = PI/2: Forward is +X
  // Steering LEFT (negative input): turns counter-clockwise -> rotation INCREASES
  // Steering RIGHT (positive input): turns clockwise -> rotation DECREASES
  const absForwardSpeed = Math.abs(p.vForward);
  const speedRatio = Math.min(1.0, absForwardSpeed / 16.0); // No steering at complete stop
  const highSpeedDamping = 1.0 / (1.0 + Math.max(0, absForwardSpeed - 65) * config.steerHighSpeedDamping);

  // Drift Mode: triggered by handbrake button or aggressive turn at high speed
  const isHandbrake = Boolean(input.handbrake);
  const isAggressiveTurn = Math.abs(p.filteredSteer) > 0.70 && absForwardSpeed > 45;
  p.isDrifting = (isHandbrake || isAggressiveTurn) && absForwardSpeed > 22;

  const baseTurnSens = p.isDrifting ? config.driftTurnSensitivity : config.steerSensitivity;
  const directionSign = p.vForward >= -0.5 ? 1 : -1; // Invert steering when reversing

  const yawRate = -p.filteredSteer * baseTurnSens * speedRatio * highSpeedDamping * directionSign;
  p.rotation += yawRate * dt;

  // Normalize rotation to [-PI, PI]
  while (p.rotation > Math.PI) p.rotation -= Math.PI * 2;
  while (p.rotation < -Math.PI) p.rotation += Math.PI * 2;

  // Front wheel visual steer angle
  p.wheelSteer = -p.filteredSteer * 0.45;

  // 9. Coordinate Transformation & Realistic Lateral Grip Damping
  // Forward unit vector in world space:
  const fwdX = Math.sin(p.rotation);
  const fwdZ = Math.cos(p.rotation);
  // Right unit vector in world space:
  const rightX = Math.cos(p.rotation);
  const rightZ = -Math.sin(p.rotation);

  // Decompose world velocity into car's updated forward/lateral frame
  const currentFwdMps = p.vx * fwdX + p.vz * fwdZ;
  let currentLatMps = p.vx * rightX + p.vz * rightZ;

  // Apply tire grip damping to lateral velocity:
  const grip = p.isDrifting ? config.driftGrip : (isOffroad ? config.offroadGrip : config.normalGrip);
  currentLatMps *= Math.max(0, 1.0 - grip * dt);

  // Synchronize telemetry
  p.vLateral = currentLatMps * 3.6;
  p.speed = p.vForward;
  p.slipRatio = Math.min(1.0, Math.abs(p.vLateral) / (Math.abs(p.vForward) + 1.0));

  // Dynamic body roll tilt in turns (gentle suspension reaction)
  const targetRoll = -p.filteredSteer * (absForwardSpeed / config.maxSpeed) * 0.12;
  p.roll += (targetRoll - p.roll) * Math.min(1.0, 12 * dt);

  // 10. Integrate World Velocity & Position
  const vForwardMps = p.vForward / 3.6;
  p.vx = fwdX * vForwardMps + rightX * currentLatMps;
  p.vz = fwdZ * vForwardMps + rightZ * currentLatMps;

  p.x += p.vx * dt;
  p.z += p.vz * dt;

  // 11. Wheel Spin & Engine RPM
  p.wheelRotation += vForwardMps * dt * 4;
  const gearModulo = (absForwardSpeed % 36) / 36;
  p.rpmNormalized = absForwardSpeed > 140 ? 1.0 : Math.max(0.18, Math.min(1.0, 0.25 + gearModulo * 0.75));
}

/**
 * Resolves tangential wall/obstacle collisions (Re-Volt style smooth sliding).
 */
export function resolveObstacleCollisions(
  p: VehiclePhysicsState,
  obstacles: ObstacleCollider[],
  config: VehicleConfig = DEFAULT_VEHICLE_CONFIG
): boolean {
  let collided = false;

  for (const obs of obstacles) {
    const dx = p.x - obs.x;
    const dz = p.z - obs.z;
    const dist = Math.hypot(dx, dz);
    const minDist = obs.radius + 1.25;

    if (dist < minDist && dist > 0.001) {
      collided = true;
      const nx = dx / dist;
      const nz = dz / dist;

      // Push car outside obstacle boundary
      p.x = obs.x + nx * (minDist + 0.12);
      p.z = obs.z + nz * (minDist + 0.12);

      // Normal velocity component
      const dotNormal = p.vx * nx + p.vz * nz;
      if (dotNormal < 0) {
        // Remove velocity towards obstacle, retain tangential velocity (wall slide)
        p.vx -= dotNormal * nx;
        p.vz -= dotNormal * nz;
        p.vx *= config.wallSlideRestitution;
        p.vz *= config.wallSlideRestitution;

        // Damp forward speed proportionally
        p.vForward *= 0.88;
      }
    }
  }

  return collided;
}
