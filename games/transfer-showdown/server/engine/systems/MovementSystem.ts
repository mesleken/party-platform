import { EnginePlayerRuntime, EngineTeamRuntime } from '../MatchState.js';
import { clamp } from '../util/Geometry.js';

export class MovementSystem {
  /**
   * 22 Oyuncunun fiziksel hız sınırlarını, ivmelenmesini ve konumunu günceller.
   * Asla ışınlanma yapmaz; hız, ivme, kondisyon ve oyuncu reytingleri (effStats.pac / dri) üzerinden akıcı hareket sağlar.
   */
  public static updateMovement(
    players: EnginePlayerRuntime[],
    teams: [EngineTeamRuntime, EngineTeamRuntime],
    possessionTeam: 0 | 1,
    dt: number
  ) {
    const drainBase = dt * 0.11;

    for (const p of players) {
      if (p.tackleCooldownSec > 0) p.tackleCooldownSec = Math.max(0, p.tackleCooldownSec - dt);
      if (p.thinkTimerSec > 0) p.thinkTimerSec = Math.max(0, p.thinkTimerSec - dt);

      // Çalım yiyen veya ikili mücadelede dengesini kaybeden oyuncu kısa süre yavaşlar
      if (p.stunSec > 0) {
        p.stunSec = Math.max(0, p.stunSec - dt);
        p.vx *= Math.max(0, 1.0 - 10.0 * dt);
        p.vy *= Math.max(0, 1.0 - 10.0 * dt);
        p.x = clamp(p.x + p.vx * dt, 1.5, 98.5);
        p.y = clamp(p.y + p.vy * dt, 1.5, 62.5);
        continue;
      }

      const eff = p.effStats || p.stats;
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const distToTarget = Math.hypot(dx, dy);

      const isCarrying = p.action === 'CARRY';
      const isDivingGk = p.action === 'GK_DIVE';
      const isSprinting =
        !isCarrying &&
        (p.action === 'SPRINT_RUN' ||
          p.action === 'PRESS' ||
          isDivingGk ||
          p.action === 'INTERCEPT' ||
          (p.urgency ?? 0.7) >= 0.88);

      const urgencyMod = 0.80 + (p.urgency ?? 0.75) * 0.28;
      // Top süren oyuncunun hızı: dri, pac ve ovr yeteneklerine göre ölçeklenir
      const carrySkillMod = isCarrying
        ? clamp(0.80 + (eff.dri - 68) * 0.0065 + (eff.pac - 68) * 0.0045, 0.72, 1.05)
        : 1.0;
      const sprintMod = isDivingGk ? 1.50 : isCarrying ? carrySkillMod * 1.08 : isSprinting ? 1.32 : urgencyMod;
      const staminaFactor = Math.max(0.68, 0.75 + (p.stamina / 100.0) * 0.25);

      // 1. Maksimum Hız (saha birimi / sn): Reytingler sahada belirgin hız farkı yaratır (65 PAC -> 9.8, 95 PAC -> 13.25)
      const baseMaxSpeed = 9.8 + (eff.pac - 65.0) * 0.115;
      p.maxSpeed = baseMaxSpeed * sprintMod * staminaFactor;

      // 2. Maksimum İvmelenme (saha birimi / sn^2): pac + dri + ovr bazlı patlayıcılık ve çeviklik
      const agility = eff.pac * 0.40 + eff.dri * 0.40 + (p.effOvr || p.ovr) * 0.20;
      p.maxAcceleration = (isDivingGk ? 44.0 : 22.0) + (agility - 65.0) * 0.35;

      if (distToTarget > 0.06) {
        const dirX = dx / distToTarget;
        const dirY = dy / distToTarget;

        // Hedefe yaklaşırken yumuşak frenleme (Top süren veya depar atan hücumcular frenlemez; taktiksel yerine yerleşen oyuncular frenler)
        const isBraking = !isCarrying && !isSprinting && !isDivingGk && distToTarget < 2.0;
        const desiredSpeed = isBraking ? p.maxSpeed * Math.max(0.25, distToTarget / 2.0) : p.maxSpeed;
        const desiredVx = dirX * desiredSpeed;
        const desiredVy = dirY * desiredSpeed;

        const dvx = desiredVx - p.vx;
        const dvy = desiredVy - p.vy;
        const dv = Math.hypot(dvx, dvy);
        const maxDeltaV = p.maxAcceleration * dt;

        if (dv > maxDeltaV && dv > 0.001) {
          p.vx += (dvx / dv) * maxDeltaV;
          p.vy += (dvy / dv) * maxDeltaV;
        } else {
          p.vx = desiredVx;
          p.vy = desiredVy;
        }

        const currentSpeed = Math.hypot(p.vx, p.vy);
        if (currentSpeed > p.maxSpeed) {
          p.vx = (p.vx / currentSpeed) * p.maxSpeed;
          p.vy = (p.vy / currentSpeed) * p.maxSpeed;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (currentSpeed > 0.25) {
          p.heading = Math.atan2(p.vy, p.vx);
        }
      } else {
        p.vx *= Math.max(0, 1.0 - 14.0 * dt);
        p.vy *= Math.max(0, 1.0 - 14.0 * dt);
        if (Math.hypot(p.vx, p.vy) < 0.05) {
          p.vx = 0;
          p.vy = 0;
        }
      }

      // 3. Saha Sınırları (taç / aut çizgisi içinde tut)
      p.x = clamp(p.x, 1.5, 98.5);
      p.y = clamp(p.y, 1.5, 62.5);

      // 4. Kondisyon Tüketimi (PHY niteliği yüksek oyuncular daha geç yorulur)
      const team = teams[p.teamIndex];
      let pressMultiplier = team?.tactics?.playstyle === 'high_press' ? 1.28 : 1.0;
      if (team?.mentality === 'all_out_attack') pressMultiplier *= 1.18;
      if (team?.activeShout?.shout === 'demand_more') pressMultiplier *= 1.2;
      const phyResist = clamp(1.15 - (eff.phy - 70) * 0.006, 0.75, 1.25);
      const sprintCost = isSprinting ? 1.45 : 0.75;

      p.stamina = Math.max(48.0, p.stamina - drainBase * pressMultiplier * sprintCost * phyResist);
    }

    void possessionTeam;
  }
}
