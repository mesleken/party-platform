export interface TacticalRoleProfile {
  roleCode: string;
  isGoalkeeper: boolean;
  isCentreBack: boolean;
  isFullBack: boolean;
  isWingBack: boolean;
  isDefensiveMid: boolean;
  isCentralMid: boolean;
  isWideMid: boolean;
  isAttackingMid: boolean;
  isWinger: boolean;
  isStriker: boolean;
  widthPreference: number;         // 0..1 (0: merkez, 1: çizgiye basma)
  forwardRunPreference: number;    // 0..1 (hücumda ceza sahasına / son bölgeye çıkma isteği)
  defensiveResponsibility: number; // 0..1 (top rakipteyken geriye koşu ve hat kurma disiplini)
  riskTolerance: number;           // 0..1 (riskli dikine ara pası ve çalım tercihi)
  pressingResponsibility: number;  // 0..1 (ön alan pres ve topa baskı sorumluluğu)
}

const ROLE_PROFILES: Record<string, TacticalRoleProfile> = {
  GK: {
    roleCode: 'GK',
    isGoalkeeper: true,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.0,
    forwardRunPreference: 0.0,
    defensiveResponsibility: 1.0,
    riskTolerance: 0.05,
    pressingResponsibility: 0.0
  },
  CB: {
    roleCode: 'CB',
    isGoalkeeper: false,
    isCentreBack: true,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.2,
    forwardRunPreference: 0.12,
    defensiveResponsibility: 0.98,
    riskTolerance: 0.2,
    pressingResponsibility: 0.35
  },
  LCB: {
    roleCode: 'LCB',
    isGoalkeeper: false,
    isCentreBack: true,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.3,
    forwardRunPreference: 0.15,
    defensiveResponsibility: 0.96,
    riskTolerance: 0.22,
    pressingResponsibility: 0.38
  },
  RCB: {
    roleCode: 'RCB',
    isGoalkeeper: false,
    isCentreBack: true,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.3,
    forwardRunPreference: 0.15,
    defensiveResponsibility: 0.96,
    riskTolerance: 0.22,
    pressingResponsibility: 0.38
  },
  LB: {
    roleCode: 'LB',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: true,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.88,
    forwardRunPreference: 0.72,
    defensiveResponsibility: 0.82,
    riskTolerance: 0.45,
    pressingResponsibility: 0.65
  },
  RB: {
    roleCode: 'RB',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: true,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.88,
    forwardRunPreference: 0.72,
    defensiveResponsibility: 0.82,
    riskTolerance: 0.45,
    pressingResponsibility: 0.65
  },
  LWB: {
    roleCode: 'LWB',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: true,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.95,
    forwardRunPreference: 0.86,
    defensiveResponsibility: 0.70,
    riskTolerance: 0.55,
    pressingResponsibility: 0.72
  },
  RWB: {
    roleCode: 'RWB',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: true,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.95,
    forwardRunPreference: 0.86,
    defensiveResponsibility: 0.70,
    riskTolerance: 0.55,
    pressingResponsibility: 0.72
  },
  CDM: {
    roleCode: 'CDM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: true,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.2,
    forwardRunPreference: 0.35,
    defensiveResponsibility: 0.90,
    riskTolerance: 0.35,
    pressingResponsibility: 0.75
  },
  LDM: {
    roleCode: 'LDM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: true,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.35,
    forwardRunPreference: 0.38,
    defensiveResponsibility: 0.88,
    riskTolerance: 0.38,
    pressingResponsibility: 0.74
  },
  RDM: {
    roleCode: 'RDM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: true,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.35,
    forwardRunPreference: 0.38,
    defensiveResponsibility: 0.88,
    riskTolerance: 0.38,
    pressingResponsibility: 0.74
  },
  CM: {
    roleCode: 'CM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: true,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.4,
    forwardRunPreference: 0.60,
    defensiveResponsibility: 0.65,
    riskTolerance: 0.50,
    pressingResponsibility: 0.70
  },
  LCM: {
    roleCode: 'LCM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: true,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.5,
    forwardRunPreference: 0.64,
    defensiveResponsibility: 0.64,
    riskTolerance: 0.52,
    pressingResponsibility: 0.70
  },
  RCM: {
    roleCode: 'RCM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: true,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.5,
    forwardRunPreference: 0.64,
    defensiveResponsibility: 0.64,
    riskTolerance: 0.52,
    pressingResponsibility: 0.70
  },
  LM: {
    roleCode: 'LM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: true,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.86,
    forwardRunPreference: 0.74,
    defensiveResponsibility: 0.62,
    riskTolerance: 0.58,
    pressingResponsibility: 0.68
  },
  RM: {
    roleCode: 'RM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: true,
    isAttackingMid: false,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.86,
    forwardRunPreference: 0.74,
    defensiveResponsibility: 0.62,
    riskTolerance: 0.58,
    pressingResponsibility: 0.68
  },
  CAM: {
    roleCode: 'CAM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: true,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.45,
    forwardRunPreference: 0.82,
    defensiveResponsibility: 0.40,
    riskTolerance: 0.75,
    pressingResponsibility: 0.65
  },
  LAM: {
    roleCode: 'LAM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: true,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.72,
    forwardRunPreference: 0.84,
    defensiveResponsibility: 0.40,
    riskTolerance: 0.75,
    pressingResponsibility: 0.65
  },
  RAM: {
    roleCode: 'RAM',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: true,
    isWinger: false,
    isStriker: false,
    widthPreference: 0.72,
    forwardRunPreference: 0.84,
    defensiveResponsibility: 0.40,
    riskTolerance: 0.75,
    pressingResponsibility: 0.65
  },
  LW: {
    roleCode: 'LW',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: true,
    isStriker: false,
    widthPreference: 0.90,
    forwardRunPreference: 0.92,
    defensiveResponsibility: 0.35,
    riskTolerance: 0.78,
    pressingResponsibility: 0.75
  },
  RW: {
    roleCode: 'RW',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: true,
    isStriker: false,
    widthPreference: 0.90,
    forwardRunPreference: 0.92,
    defensiveResponsibility: 0.35,
    riskTolerance: 0.78,
    pressingResponsibility: 0.75
  },
  ST: {
    roleCode: 'ST',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: true,
    widthPreference: 0.30,
    forwardRunPreference: 0.96,
    defensiveResponsibility: 0.25,
    riskTolerance: 0.70,
    pressingResponsibility: 0.78
  },
  LST: {
    roleCode: 'LST',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: true,
    widthPreference: 0.45,
    forwardRunPreference: 0.96,
    defensiveResponsibility: 0.25,
    riskTolerance: 0.70,
    pressingResponsibility: 0.78
  },
  RST: {
    roleCode: 'RST',
    isGoalkeeper: false,
    isCentreBack: false,
    isFullBack: false,
    isWingBack: false,
    isDefensiveMid: false,
    isCentralMid: false,
    isWideMid: false,
    isAttackingMid: false,
    isWinger: false,
    isStriker: true,
    widthPreference: 0.45,
    forwardRunPreference: 0.96,
    defensiveResponsibility: 0.25,
    riskTolerance: 0.70,
    pressingResponsibility: 0.78
  }
};

export function getRoleProfile(role: string): TacticalRoleProfile {
  const normalized = role.trim().toUpperCase();
  if (ROLE_PROFILES[normalized]) {
    return ROLE_PROFILES[normalized];
  }

  // Fallback profile based on prefix/suffix:
  const isCB = normalized.includes('CB');
  const isWB = normalized.includes('WB');
  const isB = (normalized.includes('LB') || normalized.includes('RB')) && !isCB;
  const isW = (normalized.includes('LW') || normalized.includes('RW')) && !isCB;
  const isS = normalized.includes('ST');
  const isDM = normalized.includes('DM');
  const isAM = normalized.includes('AM');
  const isGK = normalized === 'GK';

  return {
    roleCode: normalized,
    isGoalkeeper: isGK,
    isCentreBack: isCB,
    isFullBack: isB,
    isWingBack: isWB,
    isDefensiveMid: isDM,
    isCentralMid: !isGK && !isCB && !isB && !isWB && !isW && !isS && !isAM,
    isWideMid: normalized.includes('LM') || normalized.includes('RM'),
    isAttackingMid: isAM,
    isWinger: isW,
    isStriker: isS,
    widthPreference: isWB ? 0.95 : (isB || isW ? 0.88 : 0.35),
    forwardRunPreference: isS ? 0.96 : (isW ? 0.92 : (isWB ? 0.85 : (isB ? 0.70 : 0.45))),
    defensiveResponsibility: isCB ? 0.96 : (isB ? 0.80 : (isDM ? 0.88 : 0.40)),
    riskTolerance: isW || isAM ? 0.75 : 0.45,
    pressingResponsibility: isS || isW ? 0.75 : 0.60
  };
}

/**
 * Bir oyuncunun kanat oyuncusu / kanat beki olup olmadığını güvenilir şekilde denetler.
 * Kesinlikle stoperleri (CB, LCB, RCB) kanat olarak seçmez!
 */
export function isFlankPlayer(profile: TacticalRoleProfile): boolean {
  return profile.isFullBack || profile.isWingBack || profile.isWinger || profile.isWideMid;
}

export type RoleGroup = 'GK' | 'CB' | 'FB' | 'WB' | 'DM' | 'CM' | 'WM' | 'AM' | 'W' | 'ST';

/**
 * Oyuncunun sahadaki "b�lge grubunu" (hangi hat / koridorda g�rev yapacagini) d�nd�r�r.
 * Konumlandirma sistemi her grup i�in ayri derinlik/genislik siniri uygular.
 */
export function getRoleGroup(role: string): RoleGroup {
  const p = getRoleProfile(role);
  if (p.isGoalkeeper) return 'GK';
  if (p.isCentreBack) return 'CB';
  if (p.isWingBack) return 'WB';
  if (p.isFullBack) return 'FB';
  if (p.isDefensiveMid) return 'DM';
  if (p.isWideMid) return 'WM';
  if (p.isAttackingMid) return 'AM';
  if (p.isWinger) return 'W';
  if (p.isStriker) return 'ST';
  return 'CM';
}
