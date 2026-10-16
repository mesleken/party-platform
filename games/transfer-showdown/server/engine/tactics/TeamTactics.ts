import { ManagerTactics, MentalityType, TouchlineShoutType } from '../../../shared/types.js';
import { AttackPlan, AttackPlanKind, EnginePlayerRuntime, EngineTeamRuntime, TeamStyle } from '../MatchState.js';
import { SeededRandom } from '../random/SeededRandom.js';
import { clamp, toOwn } from '../util/Geometry.js';

/**
 * Menajerin seçtiği mentalite + oyun stili + savunma çizgisi + kenar talimatını
 * simülasyonun gerçekten kullandığı sayısal "takım stili" parametrelerine çevirir.
 * Mentalite artık sadece dizilişi kaydırmaz; pas riski, şut isteği, baskı, hücuma katılım,
 * bek bindirmeleri ve kontra açığını da doğrudan değiştirir.
 */
export function computeTeamStyle(
  tactics: ManagerTactics,
  mentality: MentalityType,
  shout?: TouchlineShoutType
): TeamStyle {
  const s: TeamStyle = {
    lineHeight: 30,
    pressTrigger: 17,
    pressIntensity: 1.0,
    pressHighLine: 0.0,
    tempo: 1.0,
    riskTaking: 0.0,
    directness: 0.35,
    width: 1.0,
    shootRange: 0,
    shotEagerness: 1.0,
    forwardCommit: 0.5,
    fullBackOverlap: 0.5,
    counterLeak: 0.5,
    compactness: 1.0
  };

  // Oyun stili
  switch (tactics.playstyle) {
    case 'possession':
      s.tempo *= 0.92;
      s.directness -= 0.17;
      s.riskTaking -= 0.05;
      s.width += 0.1;
      s.pressTrigger -= 2;
      s.forwardCommit += 0.05;
      s.compactness += 0.05;
      break;
    case 'counter':
      s.lineHeight -= 3;
      s.directness += 0.28;
      s.tempo *= 1.12;
      s.riskTaking += 0.08;
      s.forwardCommit -= 0.08;
      s.counterLeak -= 0.1;
      s.pressTrigger -= 2;
      break;
    case 'high_press':
      s.lineHeight += 7;
      s.pressTrigger += 7;
      s.pressIntensity += 0.35;
      s.pressHighLine = 1.0;
      s.tempo *= 1.1;
      s.directness += 0.1;
      s.counterLeak += 0.18;
      s.forwardCommit += 0.1;
      break;
    default:
      break;
  }

  // Mentalite
  switch (mentality) {
    case 'defensive':
      s.lineHeight -= 5;
      s.forwardCommit -= 0.3;
      s.riskTaking -= 0.18;
      s.shootRange -= 3;
      s.shotEagerness *= 0.85;
      s.fullBackOverlap -= 0.35;
      s.tempo *= 0.95;
      s.pressIntensity -= 0.15;
      s.pressTrigger -= 3;
      s.directness += 0.08;
      s.counterLeak -= 0.25;
      s.compactness += 0.15;
      break;
    case 'attacking':
      s.lineHeight += 4;
      s.forwardCommit += 0.25;
      s.riskTaking += 0.12;
      s.shootRange += 2;
      s.shotEagerness *= 1.15;
      s.fullBackOverlap += 0.25;
      s.tempo *= 1.05;
      s.counterLeak += 0.15;
      s.pressIntensity += 0.1;
      s.pressTrigger += 2;
      break;
    case 'all_out_attack':
      s.lineHeight += 9;
      s.forwardCommit += 0.5;
      s.riskTaking += 0.28;
      s.shootRange += 4;
      s.shotEagerness *= 1.3;
      s.fullBackOverlap += 0.5;
      s.tempo *= 1.15;
      s.counterLeak += 0.4;
      s.pressIntensity += 0.2;
      s.pressTrigger += 4;
      s.directness += 0.1;
      s.compactness -= 0.1;
      break;
    default:
      break;
  }

  // Savunma çizgisi
  if (tactics.defensiveLine === 'high') {
    s.lineHeight += 6;
    s.counterLeak += 0.08;
  } else if (tactics.defensiveLine === 'low') {
    s.lineHeight -= 5;
    s.counterLeak -= 0.08;
  }

  // Aktif kenar talimatı
  if (shout === 'push_forward') {
    s.forwardCommit += 0.2;
    s.lineHeight += 3;
    s.riskTaking += 0.08;
    s.pressIntensity += 0.1;
  } else if (shout === 'tighten_up') {
    s.lineHeight -= 3;
    s.forwardCommit -= 0.2;
    s.riskTaking -= 0.1;
    s.compactness += 0.1;
  } else if (shout === 'play_creative') {
    s.riskTaking += 0.2;
    s.directness -= 0.08;
    s.shotEagerness *= 1.08;
  } else if (shout === 'demand_more') {
    s.pressIntensity += 0.2;
    s.tempo *= 1.05;
  }

  s.lineHeight = clamp(s.lineHeight, 20, 46);
  s.pressTrigger = clamp(s.pressTrigger, 11, 32);
  s.pressIntensity = clamp(s.pressIntensity, 0.6, 1.8);
  s.tempo = clamp(s.tempo, 0.8, 1.4);
  s.riskTaking = clamp(s.riskTaking, -0.3, 0.55);
  s.directness = clamp(s.directness, 0.05, 0.85);
  s.width = clamp(s.width, 0.8, 1.3);
  s.shootRange = clamp(s.shootRange, -4, 6);
  s.shotEagerness = clamp(s.shotEagerness, 0.7, 1.5);
  s.forwardCommit = clamp(s.forwardCommit, 0.1, 1.0);
  s.fullBackOverlap = clamp(s.fullBackOverlap, 0.0, 1.0);
  s.counterLeak = clamp(s.counterLeak, 0.0, 1.0);
  s.compactness = clamp(s.compactness, 0.8, 1.3);

  return s;
}

export function describeMentality(m: MentalityType): string {
  switch (m) {
    case 'defensive':
      return 'SAVUNMA';
    case 'attacking':
      return 'HÜCUM';
    case 'all_out_attack':
      return 'TAM HÜCUM';
    default:
      return 'DENGELİ';
  }
}

const PLAN_LABELS: Record<AttackPlanKind, string> = {
  BUILD_PATIENT: 'sabırlı oyun kurma',
  WING_OVERLOAD: 'kanat yüklenmesi',
  HALF_SPACE: 'ceza yayı çaprazından kanat içi hücum',
  CENTRAL_COMBO: 'ortadan kombinasyon',
  DIRECT_BALL: 'direkt uzun top',
  COUNTER_BREAK: 'hızlı kontra atak',
  SWITCH_PLAY: 'kanat değiştirme'
};

export interface PlanChoiceContext {
  startOwnP: number; // topun kazanıldığı yerin kendi kaleye göre konumu (0..100)
  startY: number;
  wonBallInMidfield: boolean;
  isRestartOrKeeper: boolean;
}

/**
 * Her top kazanma / yeniden başlama anında takımın izleyeceği hücum planını seçer.
 * Formasyon, oyun stili, mentalite ve topun kazanıldığı bölge planı belirler.
 * Farklı planlar oyuncuların koşu, destek ve final paslarında gerçekten farklı atak desenleri üretir.
 */
export function chooseAttackPlan(
  team: EngineTeamRuntime,
  ctx: PlanChoiceContext,
  rng: SeededRandom,
  simSec: number
): AttackPlan {
  const w: Record<AttackPlanKind, number> = {
    BUILD_PATIENT: 1.0,
    WING_OVERLOAD: 1.2,
    HALF_SPACE: 0.6,
    CENTRAL_COMBO: 1.0,
    DIRECT_BALL: 0.6,
    COUNTER_BREAK: 0.35,
    SWITCH_PLAY: 0.5
  };

  switch (team.tactics.formation) {
    case '5-3-2':
    case '3-5-2':
      w.WING_OVERLOAD += 1.5;
      w.DIRECT_BALL += 0.4;
      break;
    case '4-4-2':
      w.DIRECT_BALL += 0.6;
      w.WING_OVERLOAD += 0.6;
      break;
    case '4-3-3':
    case '3-4-3':
      w.WING_OVERLOAD += 0.6;
      w.HALF_SPACE += 0.8;
      break;
    case '4-2-3-1':
      w.CENTRAL_COMBO += 1.1;
      w.HALF_SPACE += 0.5;
      break;
    case '4-1-4-1':
      w.BUILD_PATIENT += 0.6;
      w.CENTRAL_COMBO += 0.4;
      break;
    default:
      break;
  }

  switch (team.tactics.playstyle) {
    case 'possession':
      w.BUILD_PATIENT += 1.3;
      w.CENTRAL_COMBO += 0.7;
      w.SWITCH_PLAY += 0.8;
      w.DIRECT_BALL -= 0.4;
      break;
    case 'counter':
      w.COUNTER_BREAK += 1.5;
      w.DIRECT_BALL += 1.1;
      w.BUILD_PATIENT -= 0.5;
      break;
    case 'high_press':
      w.COUNTER_BREAK += 0.9;
      w.CENTRAL_COMBO += 0.5;
      w.HALF_SPACE += 0.4;
      break;
    default:
      break;
  }

  switch (team.mentality) {
    case 'defensive':
      w.BUILD_PATIENT += 0.5;
      w.DIRECT_BALL += 0.5;
      w.COUNTER_BREAK += 0.4;
      break;
    case 'attacking':
      w.WING_OVERLOAD += 0.4;
      w.HALF_SPACE += 0.3;
      break;
    case 'all_out_attack':
      w.DIRECT_BALL += 0.9;
      w.WING_OVERLOAD += 0.7;
      w.COUNTER_BREAK += 0.3;
      break;
    default:
      break;
  }

  // Topun kazanıldığı bölgeye göre
  if (ctx.wonBallInMidfield && ctx.startOwnP >= 38) {
    w.COUNTER_BREAK += team.tactics.playstyle === 'counter' || team.tactics.playstyle === 'high_press' ? 1.4 : 0.6;
  }
  if (ctx.startOwnP < 24) {
    w.BUILD_PATIENT += 0.5;
    w.DIRECT_BALL += 0.4;
    w.SWITCH_PLAY += 0.3;
  }
  if (ctx.startOwnP > 62) {
    w.COUNTER_BREAK += 0.3;
    w.CENTRAL_COMBO += 0.5;
    w.BUILD_PATIENT -= 0.7;
  }

  // Ağırlıklı seçim
  const kinds = Object.keys(w) as AttackPlanKind[];
  let total = 0;
  for (const k of kinds) {
    w[k] = Math.max(0.05, w[k]);
    total += w[k];
  }
  let roll = rng.next() * total;
  let chosen: AttackPlanKind = 'BUILD_PATIENT';
  for (const k of kinds) {
    roll -= w[k];
    if (roll <= 0) {
      chosen = k;
      break;
    }
  }

  // Kanat seçimi: topa yakın kanat %62, uzak kanat %38
  let flank: 'TOP' | 'BOTTOM' | null = null;
  if (chosen === 'WING_OVERLOAD' || chosen === 'HALF_SPACE' || chosen === 'SWITCH_PLAY') {
    const nearFlank: 'TOP' | 'BOTTOM' = ctx.startY < 32 ? 'TOP' : 'BOTTOM';
    const farFlank: 'TOP' | 'BOTTOM' = nearFlank === 'TOP' ? 'BOTTOM' : 'TOP';
    flank = chosen === 'SWITCH_PLAY' ? farFlank : (rng.chance(0.62) ? nearFlank : farFlank);
  }

  const duration = chosen === 'COUNTER_BREAK' ? 14 : 24 + rng.range(0, 10);
  return {
    kind: chosen,
    flank,
    startedSec: simSec,
    expiresSec: simSec + duration,
    label: PLAN_LABELS[chosen]
  };
}

/** Sol/sağ kanat adı (takımın hücum yönüne göre) */
export function flankName(team: EngineTeamRuntime, flank: 'TOP' | 'BOTTOM' | null): string {
  if (!flank) return '';
  // Hücum yönü +1 iken y küçük = sol kanat
  const isLeft = team.attackDirection === 1 ? flank === 'TOP' : flank === 'BOTTOM';
  return isLeft ? 'sol' : 'sağ';
}

/** Takımın ofsayt çizgisinin "own-progress" karşılığı (rakip savunma hattı) */
export function opponentLineOwnP(attackers: EnginePlayerRuntime[], defenders: EnginePlayerRuntime[], dir: 1 | -1, ballX: number): number {
  const sorted = defenders
    .filter((d) => d.position !== 'GK')
    .map((d) => toOwn(d.x, dir))
    .sort((a, b) => b - a);
  const secondLast = sorted.length >= 1 ? sorted[0] : 90;
  return Math.max(50, Math.max(secondLast, toOwn(ballX, dir)));
}
