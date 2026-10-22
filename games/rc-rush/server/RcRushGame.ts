import {
  RcRushInput,
  CarSnapshot,
  PickupSnapshot,
  ProjectileSnapshot,
  RaceEvent,
  RcRushSnapshot,
  PowerupType,
} from '../shared/types.js';
import {
  TRACK_CONFIG,
  TRACK_WAYPOINTS,
  PICKUP_SPAWNS,
  OBSTACLE_COLLIDERS,
  TRACK_TOTAL_LENGTH,
  getTrackDistanceAtPoint,
} from '../shared/track.js';
import { DEFAULT_VEHICLE_CONFIG } from '../shared/tuning.js';
import {
  stepVehicleDynamics,
  resolveObstacleCollisions,
  recoverPlayerToTrack,
  VehiclePhysicsState,
} from './VehicleDynamics.js';

interface PlayerRuntime extends VehiclePhysicsState {
  id: string;
  nickname: string;
  color: string;
  carModel: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vForward: number; // İleri yönlü hız bileşeni (km/h)
  vLateral: number; // Yanal savrulma hız bileşeni (km/h)
  rotation: number;
  pitch: number;
  roll: number;
  wheelSteer: number;
  wheelRotation: number;
  speed: number;
  filteredSteer: number;
  boostMeter: number;
  isBoosting: boolean;
  isDrifting: boolean;
  slipRatio: number; // 0..1 drift/skid oranı
  rpmNormalized: number; // 0..1 LED takometre devir oranı
  trackProgress: number; // Kümülatif metre ilerlemesi
  distanceToAheadM: number; // Öndeki araçla metre farkı (negatif)
  distanceToBehindM: number; // Arkadaki araçla metre farkı (pozitif)
  aheadRacerName?: string;
  behindRacerName?: string;
  isSpinning: boolean;
  spinTimerMs: number;
  item: PowerupType | null;
  hasShield: boolean;
  lap: number;
  checkpointIndex: number;
  position: number;
  previousPosition: number;
  lapStartTimeMs: number;
  lapTimeMs: number;
  bestLapMs: number;
  totalTimeMs: number;
  finished: boolean;
  isWrongWay: boolean;
  gapToLeaderSec: number;
  input: RcRushInput;
}

interface ProjectileRuntime {
  id: string;
  type: 'rocket' | 'oil';
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  rotation: number;
  lifeMs: number;
}

interface PickupRuntime {
  id: string;
  x: number;
  y: number;
  z: number;
  active: boolean;
  respawnTimerMs: number;
}

const CAR_COLORS = ['#38bdf8', '#f97316', '#22c55e', '#facc15', '#a855f7', '#ec4899', '#06b6d4', '#e11d48'];
const CAR_MODELS = ['buggy', 'sport', 'truck', 'formula'];

export class RcRushGame {
  private players: Map<string, PlayerRuntime> = new Map();
  private pickups: PickupRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private broadcastFn: (type: string, payload: any) => void;
  private interval?: NodeJS.Timeout;

  private phase: 'countdown' | 'racing' | 'completed' = 'countdown';
  private countdown = 3;
  private countdownElapsed = 0;
  private raceStartTime = 0;
  private elapsedMs = 0;
  private winnerNickname?: string;
  private nextProjectileId = 1;

  constructor(callbacks: {
    broadcast: (type: string, payload: any) => void;
    sendToPlayer?: (sessionId: string, type: string, payload: any) => void;
  }) {
    this.broadcastFn = callbacks.broadcast;

    // Pickupları ilklendir
    this.pickups = PICKUP_SPAWNS.map((p) => ({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      active: true,
      respawnTimerMs: 0,
    }));
  }

  public addPlayer(id: string, nickname: string, preferredColor?: string) {
    const pIndex = this.players.size;
    const color = preferredColor || CAR_COLORS[pIndex % CAR_COLORS.length];
    const carModel = CAR_MODELS[pIndex % CAR_MODELS.length];

    // Grid pozisyonu (Start çizgisinin gerisinde 2'li sıra, pist +X yönünde uzanır)
    const row = Math.floor(pIndex / 2);
    const col = pIndex % 2;
    const startX = -10 - (row * 8);
    const startZ = -45 + (col === 0 ? -2.5 : 2.5);

    const player: PlayerRuntime = {
      id,
      nickname,
      color,
      carModel,
      x: startX,
      y: 0.35,
      z: startZ,
      vx: 0,
      vz: 0,
      vForward: 0,
      vLateral: 0,
      rotation: Math.PI / 2, // Doğuya (+X yönüne, Waypoint 0 ve 1'e) bakıyor
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
      rpmNormalized: 0.15,
      trackProgress: 0,
      distanceToAheadM: 0,
      distanceToBehindM: 0,
      isSpinning: false,
      spinTimerMs: 0,
      item: null,
      hasShield: false,
      lap: 1,
      checkpointIndex: 0,
      position: pIndex + 1,
      previousPosition: pIndex + 1,
      lapStartTimeMs: 0,
      lapTimeMs: 0,
      bestLapMs: 0,
      totalTimeMs: 0,
      finished: false,
      isWrongWay: false,
      gapToLeaderSec: 0,
      input: { steer: 0, throttle: 0, brake: 0, boost: false, useItem: false },
    };

    this.players.set(id, player);
  }

  public removePlayer(id: string) {
    this.players.delete(id);
    if (this.players.size === 0) {
      this.stop();
    }
  }

  public handleInput(sessionId: string, input: RcRushInput) {
    const player = this.players.get(sessionId);
    if (!player || player.finished) return;

    player.input = {
      steer: Math.max(-1, Math.min(1, input?.steer || 0)),
      throttle: Math.max(0, Math.min(1, input?.throttle || 0)),
      brake: Math.max(0, Math.min(1, input?.brake || 0)),
      boost: Boolean(input?.boost),
      useItem: Boolean(input?.useItem),
      handbrake: Boolean(input?.handbrake),
      recover: Boolean(input?.recover),
    };

    // Item kullanıldıysa
    if (player.input.useItem && player.item) {
      this.usePlayerItem(player);
    }
  }

  public start() {
    this.phase = 'countdown';
    this.countdown = 3;
    this.countdownElapsed = 0;
    this.elapsedMs = 0;
    this.raceStartTime = 0;

    // 60Hz sabit fizik adımı, 30Hz snapshot yayını
    const dt = 1 / 60;
    let tickCount = 0;
    this.interval = setInterval(() => {
      this.update(dt);
      tickCount++;
      if (tickCount % 2 === 0 || this.phase === 'countdown' || this.phase === 'completed') {
        this.broadcastSnapshot();
      }
    }, 1000 / 60);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  private update(dt: number) {
    if (this.phase === 'countdown') {
      this.countdownElapsed += dt;
      const currentCount = 3 - Math.floor(this.countdownElapsed);
      if (currentCount !== this.countdown) {
        this.countdown = Math.max(0, currentCount);
        this.emitEvent({
          type: 'COUNTDOWN_TICK',
          gap: this.countdown,
          timestamp: Date.now(),
        });
      }

      if (this.countdownElapsed >= 3.5) {
        this.phase = 'racing';
        this.raceStartTime = Date.now();
        this.players.forEach((p) => {
          p.lapStartTimeMs = this.raceStartTime;
        });
        this.emitEvent({
          type: 'RACE_START',
          timestamp: Date.now(),
        });
      }
      return;
    }

    if (this.phase === 'completed') {
      return;
    }

    this.elapsedMs = Date.now() - this.raceStartTime;

    // 1. Araç Fiziği ve Hareketi
    this.players.forEach((p) => {
      this.updateCarPhysics(p, dt);
      this.updateCarCheckpoints(p);
    });

    // Araçlar Arası Çarpışma (Bumper Physics)
    const carList = Array.from(this.players.values());
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const c1 = carList[i];
        const c2 = carList[j];
        const dx = c2.x - c1.x;
        const dz = c2.z - c1.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 2.4; // İki araç genişliği toplamı
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minDist - dist;
          c1.x -= nx * overlap * 0.5;
          c1.z -= nz * overlap * 0.5;
          c2.x += nx * overlap * 0.5;
          c2.z += nz * overlap * 0.5;

          c1.speed *= 0.88;
          c2.speed *= 0.88;
        }
      }
    }

    // 2. Mermiler (Roket / Yağ)
    this.updateProjectiles(dt);

    // 3. Pickup Kutuları (Yenilenme)
    this.pickups.forEach((pickup) => {
      if (!pickup.active) {
        pickup.respawnTimerMs -= dt * 1000;
        if (pickup.respawnTimerMs <= 0) {
          pickup.active = true;
          pickup.respawnTimerMs = 0;
        }
      }
    });

    // 4. Sıralama (Leaderboard / Position Stack) ve Sollama Olayları
    this.updateRankings();

    // 5. Bitiş Kontrolü
    const allFinished = Array.from(this.players.values()).every((p) => p.finished);
    if (allFinished && this.players.size > 0) {
      this.phase = 'completed';
      const winner = Array.from(this.players.values()).sort((a, b) => a.position - b.position)[0];
      this.winnerNickname = winner?.nickname || 'Bilinmiyor';
      this.emitEvent({
        type: 'FINISH',
        playerId: winner?.id,
        playerName: winner?.nickname,
        timestamp: Date.now(),
      });
    }
  }

  private updateCarPhysics(p: PlayerRuntime, dt: number) {
    stepVehicleDynamics(p, p.input, dt);

    const hitObstacle = resolveObstacleCollisions(p, OBSTACLE_COLLIDERS);
    if (hitObstacle) {
      this.emitEvent({
        type: 'CRASH',
        playerId: p.id,
        playerName: p.nickname,
        timestamp: Date.now(),
      });
    }

    // Pist Dış Sınırları Çarpışması
    const b = TRACK_CONFIG.bounds;
    let hitBoundary = false;
    if (p.x < b.minX) { p.x = b.minX; p.vx = Math.abs(p.vx) * 0.5; hitBoundary = true; }
    else if (p.x > b.maxX) { p.x = b.maxX; p.vx = -Math.abs(p.vx) * 0.5; hitBoundary = true; }
    if (p.z < b.minZ) { p.z = b.minZ; p.vz = Math.abs(p.vz) * 0.5; hitBoundary = true; }
    else if (p.z > b.maxZ) { p.z = b.maxZ; p.vz = -Math.abs(p.vz) * 0.5; hitBoundary = true; }

    if (hitBoundary) {
      p.vForward = Math.min(p.vForward * 0.35, 18);
      p.speed = p.vForward;
      p.rotation = Math.atan2(p.vx, p.vz);
      this.emitEvent({
        type: 'CRASH',
        playerId: p.id,
        playerName: p.nickname,
        timestamp: Date.now(),
      });
    }

    // Pickup Çarpışma Kontrolü
    this.checkCarPickups(p);

    // Süre Sayacı
    p.lapTimeMs = Date.now() - p.lapStartTimeMs;
    p.totalTimeMs = this.elapsedMs;
  }

  private updateCarCheckpoints(p: PlayerRuntime) {
    if (p.finished) return;

    const nextIdx = (p.checkpointIndex + 1) % TRACK_WAYPOINTS.length;
    const nextCp = TRACK_WAYPOINTS[nextIdx];

    const dx = nextCp.x - p.x;
    const dz = nextCp.z - p.z;
    const distSq = dx * dx + dz * dz;

    // Checkpoint geçişi
    if (distSq < nextCp.radius * nextCp.radius) {
      p.checkpointIndex = nextIdx;

      // Finish Çizgisi Geçildi mi? (Waypoint 0'a ulaşıldı ve önceki son waypoint'ti)
      if (nextIdx === 0) {
        const lapDuration = Date.now() - p.lapStartTimeMs;
        if (p.bestLapMs === 0 || lapDuration < p.bestLapMs) {
          p.bestLapMs = lapDuration;
        }

        if (p.lap >= TRACK_CONFIG.totalLaps) {
          p.finished = true;
          this.emitEvent({
            type: 'FINISH',
            playerId: p.id,
            playerName: p.nickname,
            gap: p.totalTimeMs,
            timestamp: Date.now(),
          });
        } else {
          p.lap += 1;
          p.lapStartTimeMs = Date.now();
          if (p.lap === TRACK_CONFIG.totalLaps) {
            this.emitEvent({
              type: 'FINAL_LAP',
              playerId: p.id,
              playerName: p.nickname,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    // Ters Yön Tespiti (Wrong Way)
    const targetAngle = Math.atan2(dx, dz);
    let diffAngle = targetAngle - p.rotation;
    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

    p.isWrongWay = Math.abs(diffAngle) > Math.PI * 0.72 && p.speed > 15;
  }

  private getDistanceToTrack(x: number, z: number): number {
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

  private checkCarPickups(p: PlayerRuntime) {
    if (p.item) return; // Zaten item taşıyor

    for (const pickup of this.pickups) {
      if (!pickup.active) continue;

      const dx = pickup.x - p.x;
      const dz = pickup.z - p.z;
      if (dx * dx + dz * dz < 9.0) {
        // Kutuyu aldı!
        pickup.active = false;
        pickup.respawnTimerMs = 5000;

        const rand = Math.random();
        let granted: PowerupType = 'turbo';
        if (rand < 0.45) granted = 'rocket';
        else if (rand < 0.75) granted = 'turbo';
        else if (rand < 0.90) granted = 'oil';
        else granted = 'shield';

        p.item = granted;

        this.emitEvent({
          type: 'ITEM_PICKED',
          playerId: p.id,
          playerName: p.nickname,
          item: granted,
          timestamp: Date.now(),
        });
        break;
      }
    }
  }

  private usePlayerItem(p: PlayerRuntime) {
    if (!p.item) return;
    const item = p.item;
    p.item = null;

    if (item === 'turbo') {
      p.boostMeter = 100;
      p.speed = Math.min(145, p.speed + 35);
      this.emitEvent({
        type: 'BOOST',
        playerId: p.id,
        playerName: p.nickname,
        timestamp: Date.now(),
      });
    } else if (item === 'rocket') {
      // İleriye roket fırlat
      const rocketSpeed = 45; // m/s
      this.projectiles.push({
        id: `proj_${this.nextProjectileId++}`,
        type: 'rocket',
        ownerId: p.id,
        x: p.x + Math.sin(p.rotation) * 2.5,
        y: 0.5,
        z: p.z + Math.cos(p.rotation) * 2.5,
        vx: Math.sin(p.rotation) * rocketSpeed,
        vz: Math.cos(p.rotation) * rocketSpeed,
        rotation: p.rotation,
        lifeMs: 3500,
      });

      this.emitEvent({
        type: 'ITEM_USED',
        playerId: p.id,
        playerName: p.nickname,
        item: 'rocket',
        timestamp: Date.now(),
      });
    } else if (item === 'oil') {
      // Arkaya yağ bırak
      this.projectiles.push({
        id: `proj_${this.nextProjectileId++}`,
        type: 'oil',
        ownerId: p.id,
        x: p.x - Math.sin(p.rotation) * 2.5,
        y: 0.1,
        z: p.z - Math.cos(p.rotation) * 2.5,
        vx: 0,
        vz: 0,
        rotation: 0,
        lifeMs: 15000,
      });

      this.emitEvent({
        type: 'ITEM_USED',
        playerId: p.id,
        playerName: p.nickname,
        item: 'oil',
        timestamp: Date.now(),
      });
    } else if (item === 'shield') {
      p.hasShield = true;
      setTimeout(() => {
        p.hasShield = false;
      }, 7000);
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.lifeMs -= dt * 1000;

      if (proj.lifeMs <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      proj.x += proj.vx * dt;
      proj.z += proj.vz * dt;

      // Çarpışma kontrolü
      for (const p of this.players.values()) {
        if (p.id === proj.ownerId && proj.lifeMs > 3200) continue; // Yeni atılan roket sahibini vurmasın

        const dx = p.x - proj.x;
        const dz = p.z - proj.z;
        if (dx * dx + dz * dz < 4.5) {
          if (p.hasShield) {
            p.hasShield = false; // Kalkan patladı
          } else {
            p.isSpinning = true;
            p.spinTimerMs = 1400;
            p.speed = 15;

            this.emitEvent({
              type: proj.type === 'rocket' ? 'ROCKET_HIT' : 'OIL_SLIP',
              targetId: p.id,
              targetName: p.nickname,
              timestamp: Date.now(),
            });
          }

          this.projectiles.splice(i, 1);
          break;
        }
      }
    }
  }

  private updateRankings() {
    const list = Array.from(this.players.values());

    // 1. Her aracın toplam metre ilerlemesini (TotalProgress) spline üzerinden hesapla
    list.forEach((p) => {
      const splineDist = getTrackDistanceAtPoint(p.x, p.z, p.checkpointIndex);
      p.trackProgress = (p.lap - 1) * TRACK_TOTAL_LENGTH + splineDist;
    });

    // 2. TotalProgress değerine göre sırala (Re-Volt Progression Model)
    list.sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      if (a.finished && b.finished) return a.totalTimeMs - b.totalTimeMs;
      return b.trackProgress - a.trackProgress;
    });

    const leaderTime = list[0]?.totalTimeMs || 0;

    list.forEach((p, index) => {
      p.previousPosition = p.position;
      p.position = index + 1;
      p.gapToLeaderSec = Math.max(0, (p.totalTimeMs - leaderTime) / 1000);

      // Re-Volt öndeki ve arkadaki araç mesafe farkları (Metre)
      const aheadCar = list[index - 1];
      const behindCar = list[index + 1];

      if (aheadCar) {
        p.distanceToAheadM = -Math.round(Math.max(0, aheadCar.trackProgress - p.trackProgress));
        p.aheadRacerName = aheadCar.nickname;
      } else {
        p.distanceToAheadM = 0;
        p.aheadRacerName = undefined;
      }

      if (behindCar) {
        p.distanceToBehindM = Math.round(Math.max(0, p.trackProgress - behindCar.trackProgress));
        p.behindRacerName = behindCar.nickname;
      } else {
        p.distanceToBehindM = 0;
        p.behindRacerName = undefined;
      }

      // Sollama (Overtake) tespiti
      if (p.position < p.previousPosition) {
        this.emitEvent({
          type: 'OVERTAKE',
          playerId: p.id,
          playerName: p.nickname,
          newPosition: p.position,
          timestamp: Date.now(),
        });
      }
    });
  }

  private emitEvent(event: RaceEvent) {
    this.broadcastFn('EVENT', {
      gameId: 'rc-rush',
      event,
    });
  }

  public getSnapshot(): RcRushSnapshot {
    const cars: CarSnapshot[] = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      carModel: p.carModel,
      x: p.x,
      y: p.y,
      z: p.z,
      rotation: p.rotation,
      pitch: p.pitch,
      roll: p.roll,
      wheelSteer: p.wheelSteer,
      wheelRotation: p.wheelRotation,
      speed: Math.round(p.speed),
      boostMeter: Math.round(p.boostMeter),
      isBoosting: p.isBoosting,
      isDrifting: p.isDrifting,
      slipRatio: Number(p.slipRatio.toFixed(2)),
      rpmNormalized: Number(p.rpmNormalized.toFixed(2)),
      trackProgress: Math.round(p.trackProgress),
      distanceToAheadM: p.distanceToAheadM,
      distanceToBehindM: p.distanceToBehindM,
      aheadRacerName: p.aheadRacerName,
      behindRacerName: p.behindRacerName,
      isSpinning: p.isSpinning,
      item: p.item,
      lap: p.lap,
      checkpointIndex: p.checkpointIndex,
      position: p.position,
      lapTimeMs: p.lapTimeMs,
      bestLapMs: p.bestLapMs,
      totalTimeMs: p.totalTimeMs,
      finished: p.finished,
      isWrongWay: p.isWrongWay,
      gapToLeaderSec: Number(p.gapToLeaderSec.toFixed(1)),
    }));

    const pickups: PickupSnapshot[] = this.pickups.map((pu) => ({
      id: pu.id,
      x: pu.x,
      y: pu.y,
      z: pu.z,
      active: pu.active,
    }));

    const projectiles: ProjectileSnapshot[] = this.projectiles.map((pr) => ({
      id: pr.id,
      type: pr.type,
      ownerId: pr.ownerId,
      x: pr.x,
      y: pr.y,
      z: pr.z,
      rotation: pr.rotation,
    }));

    return {
      phase: this.phase,
      countdown: this.countdown,
      elapsedMs: this.elapsedMs,
      totalLaps: TRACK_CONFIG.totalLaps,
      cars,
      pickups,
      projectiles,
      winnerNickname: this.winnerNickname,
      trackName: TRACK_CONFIG.name,
    };
  }

  private broadcastSnapshot() {
    this.broadcastFn('STATE', {
      gameId: 'rc-rush',
      state: this.getSnapshot(),
    });
  }
}
