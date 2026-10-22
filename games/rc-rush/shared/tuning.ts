export interface VehicleConfig {
  // Speed & Acceleration (in KM/H and KM/H/s)
  maxSpeed: number;              // Normal top speed (e.g. 118 km/h)
  boostSpeed: number;            // Turbo top speed (e.g. 165 km/h)
  reverseSpeed: number;          // Maximum reverse speed (e.g. 32 km/h)
  accelRate: number;             // Forward acceleration rate (e.g. 52 km/h/s)
  boostAccelRate: number;        // Boost acceleration rate (e.g. 90 km/h/s)
  brakeRate: number;             // Braking deceleration rate (e.g. 110 km/h/s)
  reverseAccelRate: number;      // Reverse acceleration rate (e.g. 38 km/h/s)
  frictionRate: number;          // Coasting rolling resistance (e.g. 20 km/h/s)

  // Steering & Turning Dynamics (in radians/sec)
  steerSensitivity: number;      // Base turning angular rate (e.g. 2.75 rad/s)
  driftTurnSensitivity: number;  // Angular turn rate while drifting (e.g. 3.4 rad/s)
  steerFilterRate: number;       // Smooth ramp-up / return-to-center rate (e.g. 14.0/s)
  steerHighSpeedDamping: number; // Factor reducing turn sharpness at extreme speeds

  // Grip & Lateral Slip Damping (damping factor/s)
  normalGrip: number;            // High grip on asphalt/floor (e.g. 15.0/s)
  driftGrip: number;             // Reduced grip during drift/handbrake (e.g. 4.2/s)
  offroadGrip: number;           // Reduced grip in offroad zone (e.g. 7.5/s)

  // Offroad / Rough Zone
  offroadSpeedCap: number;       // Maximum speed when cutting deep offroad (e.g. 50 km/h)
  offroadDecel: number;          // Deceleration rate on rough surface (e.g. 45 km/h/s)

  // Boost Energy
  boostDrainRate: number;        // Percent per second consumed (e.g. 40 %/s)
  boostRechargeRate: number;     // Percent per second passively recharged (e.g. 9 %/s)

  // Collision
  wallSlideRestitution: number;  // Tangential velocity retention on barrier collision (e.g. 0.75)
}

export const DEFAULT_VEHICLE_CONFIG: VehicleConfig = {
  maxSpeed: 118,
  boostSpeed: 165,
  reverseSpeed: 32,
  accelRate: 52,
  boostAccelRate: 90,
  brakeRate: 110,
  reverseAccelRate: 38,
  frictionRate: 20,

  steerSensitivity: 2.75,
  driftTurnSensitivity: 3.4,
  steerFilterRate: 14.0,
  steerHighSpeedDamping: 0.006,

  normalGrip: 15.0,
  driftGrip: 4.2,
  offroadGrip: 7.5,

  offroadSpeedCap: 50,
  offroadDecel: 45,

  boostDrainRate: 40,
  boostRechargeRate: 9,

  wallSlideRestitution: 0.75,
};
