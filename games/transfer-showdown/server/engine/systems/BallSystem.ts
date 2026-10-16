import { PitchBallState } from '../../../shared/types.js';
import { AuthoritativeBallState, EnginePlayerRuntime, PassContext, RestartState, ShotContext, Vec2 } from '../MatchState.js';
import { clamp, dist } from '../util/Geometry.js';

export class BallSystem {
  private state: AuthoritativeBallState;
  private looseElapsedSec = 0;

  constructor(startingTeam: 0 | 1 = 0) {
    this.state = {
      mode: 'RESTART',
      restart: {
        type: 'KICK_OFF',
        takingTeam: startingTeam,
        takerId: null,
        spot: { x: 50, y: 32 },
        waitTimerSec: 0.8,
        elapsedSec: 0
      },
      position: { x: 50, y: 32 },
      possessionTeam: startingTeam
    };
  }

  public getState(): AuthoritativeBallState {
    return this.state;
  }

  public getPosition(): Vec2 {
    return this.state.position;
  }

  public getVelocity(): Vec2 {
    if (this.state.mode === 'LOOSE') {
      return this.state.velocity;
    }
    if (this.state.mode === 'IN_FLIGHT_PASS') {
      const p = this.state.pass;
      const dur = Math.max(0.1, p.flightDurationSec);
      return {
        x: (p.target.x - p.origin.x) / dur,
        y: (p.target.y - p.origin.y) / dur
      };
    }
    if (this.state.mode === 'IN_FLIGHT_SHOT') {
      const s = this.state.shot;
      const dur = Math.max(0.1, s.flightDurationSec);
      return {
        x: (s.targetPosition.x - s.startPosition.x) / dur,
        y: (s.targetPosition.y - s.startPosition.y) / dur
      };
    }
    return { x: 0, y: 0 };
  }

  public getPossessionTeam(): 0 | 1 {
    return this.state.possessionTeam;
  }

  public getCarrierId(): string | null {
    return this.state.mode === 'CONTROLLED' ? this.state.carrierId : null;
  }

  public setControlled(carrier: EnginePlayerRuntime) {
    this.looseElapsedSec = 0;
    const lead = 0.42;
    this.state = {
      mode: 'CONTROLLED',
      carrierId: carrier.id,
      possessionTeam: carrier.teamIndex,
      position: {
        x: clamp(carrier.x + Math.cos(carrier.heading || 0) * lead, 1.5, 98.5),
        y: clamp(carrier.y + Math.sin(carrier.heading || 0) * lead, 1.5, 62.5)
      }
    };
    carrier.action = 'CARRY';
  }

  public startPass(pass: PassContext) {
    this.looseElapsedSec = 0;
    this.state = {
      mode: 'IN_FLIGHT_PASS',
      pass,
      position: { ...pass.origin },
      height: 0,
      possessionTeam: pass.attackingTeam
    };
  }

  public startShot(shot: ShotContext) {
    this.looseElapsedSec = 0;
    this.state = {
      mode: 'IN_FLIGHT_SHOT',
      shot,
      position: { ...shot.startPosition },
      height: 0,
      possessionTeam: shot.attackingTeam
    };
  }

  public setRestart(restart: RestartState) {
    this.looseElapsedSec = 0;
    this.state = {
      mode: 'RESTART',
      restart: { ...restart, elapsedSec: restart.elapsedSec ?? 0 },
      position: { ...restart.spot },
      possessionTeam: restart.takingTeam
    };
  }

  public setLoose(position: Vec2, velocity: Vec2, lastTouchTeam: 0 | 1) {
    this.looseElapsedSec = 0;
    this.state = {
      mode: 'LOOSE',
      position: {
        x: clamp(position.x, 2.0, 98.0),
        y: clamp(position.y, 2.0, 62.0)
      },
      velocity: { ...velocity },
      height: 0,
      lastTouchTeam,
      possessionTeam: lastTouchTeam
    };
  }

  /**
   * Topun fiziksel ilerleyişini sabit delta süresiyle günceller.
   */
  public updatePhysics(
    dt: number,
    players: EnginePlayerRuntime[],
    onPassArrived: (pass: PassContext, receiver: EnginePlayerRuntime) => void,
    onShotArrived: (shot: ShotContext) => void,
    simSec = 0,
    onOutOfBounds?: (spot: Vec2, lastTouchTeam: 0 | 1) => void
  ) {
    if (this.state.mode === 'CONTROLLED') {
      const carrier = players.find((p) => p.id === (this.state as any).carrierId);
      if (carrier) {
        const lead = 0.42;
        this.state.position.x = clamp(carrier.x + Math.cos(carrier.heading || 0) * lead, 1.5, 98.5);
        this.state.position.y = clamp(carrier.y + Math.sin(carrier.heading || 0) * lead, 1.5, 62.5);
      }
    } else if (this.state.mode === 'IN_FLIGHT_PASS') {
      const pass = this.state.pass;
      pass.elapsedSec += dt;
      const rawProg = clamp(pass.elapsedSec / Math.max(0.05, pass.flightDurationSec), 0, 1);
      // Yerden paslar başta hızlı çıkıp hedefe doğru tatlıca yavaşlar; havadan paslar sabit hızla gider
      const easeProg = pass.maxHeight > 0.8 ? rawProg : 1 - Math.pow(1 - rawProg, 1.28);

      this.state.position.x = pass.origin.x + (pass.target.x - pass.origin.x) * easeProg;
      this.state.position.y = pass.origin.y + (pass.target.y - pass.origin.y) * easeProg;
      this.state.height = Math.sin(rawProg * Math.PI) * pass.maxHeight;

      const receiver = players.find((p) => p.id === pass.receiverId) || players[0];

      // Alıcı oyuncu topun yolu üzerindeyse ve top yerdeyse erken buluşma (yalnızca gerçek fiziksel mesafede <= 0.85m)
      if (
        rawProg >= 0.35 &&
        this.state.height < 0.65 &&
        receiver &&
        dist(receiver.x, receiver.y, this.state.position.x, this.state.position.y) <= 0.85
      ) {
        this.state.height = 0;
        this.setControlled(receiver);
        onPassArrived(pass, receiver);
        return;
      }

      if (rawProg >= 1.0) {
        this.state.height = 0;
        this.state.position.x = pass.target.x;
        this.state.position.y = pass.target.y;
        onPassArrived(pass, receiver);
      }
    } else if (this.state.mode === 'IN_FLIGHT_SHOT') {
      const shot = this.state.shot;
      shot.elapsedSec += dt;
      const progress = clamp(shot.elapsedSec / Math.max(0.05, shot.flightDurationSec), 0, 1);

      this.state.position.x = shot.startPosition.x + (shot.targetPosition.x - shot.startPosition.x) * progress;
      this.state.position.y = shot.startPosition.y + (shot.targetPosition.y - shot.startPosition.y) * progress;
      this.state.height = Math.sin(progress * Math.PI) * shot.maxHeight;

      if (progress >= 1.0) {
        this.state.height = 0;
        this.state.position.x = shot.targetPosition.x;
        this.state.position.y = shot.targetPosition.y;
        onShotArrived(shot);
      }
    } else if (this.state.mode === 'LOOSE') {
      this.looseElapsedSec += dt;
      const nextX = this.state.position.x + this.state.velocity.x * dt;
      const nextY = this.state.position.y + this.state.velocity.y * dt;

      // Taç çizgisi dışı kontrolü (y < 1.0 veya y > 63.0) -> THROW_IN (Taç Atışı)
      if ((nextY < 1.0 || nextY > 63.0) && nextX >= 2.0 && nextX <= 98.0 && onOutOfBounds) {
        const outSpot: Vec2 = {
          x: clamp(nextX, 8.0, 92.0),
          y: nextY < 1.0 ? 1.5 : 62.5
        };
        onOutOfBounds(outSpot, this.state.lastTouchTeam);
        return;
      }

      this.state.position.x = clamp(nextX, 1.5, 98.5);
      this.state.position.y = clamp(nextY, 1.2, 62.8);
      this.state.velocity.x *= Math.max(0, 1.0 - 2.3 * dt);
      this.state.velocity.y *= Math.max(0, 1.0 - 2.3 * dt);

      // En yakın uygun oyuncuyu bul (sahipsiz topun ortada kalmasını engelle)
      let closestPlayer: EnginePlayerRuntime | null = null;
      let closestDist = 999.0;
      for (const p of players) {
        if ((p.noClaimUntil ?? 0) > simSec || (p.stunSec ?? 0) > 0.05) continue;
        // Kaleci kendi ceza sahası dışındaysa uzaktaki sahipsiz topa koşmasın
        if (p.roleGroup === 'GK' && dist(p.x, p.y, this.state.position.x, this.state.position.y) > 9.0) continue;
        const d = dist(p.x, p.y, this.state.position.x, this.state.position.y);
        if (d < closestDist) {
          closestDist = d;
          closestPlayer = p;
        }
      }

      if (closestPlayer) {
        // Oyuncunun topa göre açısı (arkasındaki topu yüzünü dönmeden kapmasını kesin olarak engeller)
        const angleToBall = Math.atan2(this.state.position.y - closestPlayer.y, this.state.position.x - closestPlayer.x);
        const headingDiff = Math.abs(
          Math.atan2(
            Math.sin(angleToBall - (closestPlayer.heading || 0)),
            Math.cos(angleToBall - (closestPlayer.heading || 0))
          )
        );
        const isFacingBall = headingDiff <= Math.PI * 0.55; // <= ~100 derece ön görüş açısı

        // Fiziksel temas yarıçapı: Oyuncu ancak topla gerçekten temas edebileceği mesafedeyse (<= 0.85m) ve top arkasında değilse kontrol eder
        if (closestDist <= 0.85 && (isFacingBall || closestDist <= 0.40)) {
          this.setControlled(closestPlayer);
        } else {
          // Oyuncu topun olduğu noktaya doğru koşar ve yönünü topa çevirir (ışınlanmayı engeller)
          closestPlayer.targetX = this.state.position.x;
          closestPlayer.targetY = this.state.position.y;
          closestPlayer.urgency = 1.0;
          closestPlayer.action = 'SPRINT_RUN';
          if (!isFacingBall && closestDist < 3.5) {
            closestPlayer.heading = angleToBall;
          }
        }
      }
    } else if (this.state.mode === 'RESTART') {
      this.state.restart.elapsedSec = (this.state.restart.elapsedSec ?? 0) + dt;
    }
  }

  /**
   * İstemciye (TV / 2D Canvas) gönderilen PitchBallState nesnesini üretir.
   */
  public toPitchBallState(): PitchBallState {
    const pos = this.state.position;
    const vel = this.getVelocity();
    const isMoving =
      this.state.mode === 'IN_FLIGHT_PASS' ||
      this.state.mode === 'IN_FLIGHT_SHOT' ||
      (this.state.mode === 'LOOSE' && Math.hypot(vel.x, vel.y) > 0.4);

    let targetX = pos.x;
    let targetY = pos.y;
    let flightProgress = 0;
    let flightDurationSec = 0.5;
    let flightRemainingSec = 0;
    let passType: PitchBallState['passType'];
    let height = 0;

    if (this.state.mode === 'IN_FLIGHT_PASS') {
      targetX = this.state.pass.target.x;
      targetY = this.state.pass.target.y;
      flightDurationSec = this.state.pass.flightDurationSec;
      flightProgress = clamp(this.state.pass.elapsedSec / Math.max(0.05, flightDurationSec), 0, 1);
      flightRemainingSec = Math.max(0, flightDurationSec - this.state.pass.elapsedSec);
      passType = this.state.pass.passType;
      height = this.state.height;
    } else if (this.state.mode === 'IN_FLIGHT_SHOT') {
      targetX = this.state.shot.targetPosition.x;
      targetY = this.state.shot.targetPosition.y;
      flightDurationSec = this.state.shot.flightDurationSec;
      flightProgress = clamp(this.state.shot.elapsedSec / Math.max(0.05, flightDurationSec), 0, 1);
      flightRemainingSec = Math.max(0, flightDurationSec - this.state.shot.elapsedSec);
      passType = 'SHOT';
      height = this.state.height;
    } else if (this.state.mode === 'LOOSE') {
      targetX = clamp(pos.x + vel.x * 0.35, 2, 98);
      targetY = clamp(pos.y + vel.y * 0.35, 2, 62);
    }

    return {
      x: Number(pos.x.toFixed(1)),
      y: Number(pos.y.toFixed(1)),
      targetX: Number(targetX.toFixed(1)),
      targetY: Number(targetY.toFixed(1)),
      vx: Number(vel.x.toFixed(2)),
      vy: Number(vel.y.toFixed(2)),
      height: Number(height.toFixed(2)),
      carrierId: this.getCarrierId(),
      possessionTeam: this.state.possessionTeam,
      passType,
      isMoving,
      flightProgress: Number(flightProgress.toFixed(2)),
      flightDurationSec: Number(flightDurationSec.toFixed(2)),
      flightRemainingSec: Number(flightRemainingSec.toFixed(2))
    };
  }
}
