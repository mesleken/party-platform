import { TeamId, PlayerRole } from './types.js';

export interface FormationSpot {
  role: PlayerRole;
  homeX: number;
  homeZ: number;
  isGoalkeeper?: boolean;
}

export const TEAM_COLORS = {
  blue: {
    name: 'Mavi Takım',
    primary: '#2563eb',
    accent: '#60a5fa',
    indicator: '#38bdf8',
    gkColor: '#f59e0b'
  },
  red: {
    name: 'Kırmızı Takım',
    primary: '#dc2626',
    accent: '#f87171',
    indicator: '#f87171',
    gkColor: '#10b981'
  }
};

/**
 * Returns team formation spots based on number of field players (1 to 5).
 * Blue defends -Z (homeZ negative), Red defends +Z (homeZ positive).
 */
export function getFormation(teamId: TeamId, fieldPlayersCount: number): FormationSpot[] {
  const dir = teamId === 'blue' ? -1 : 1;

  const gk: FormationSpot = {
    role: 'goalkeeper',
    homeX: 0,
    homeZ: 41 * dir,
    isGoalkeeper: true
  };

  const fieldSpots: FormationSpot[] = [];

  if (fieldPlayersCount === 1) {
    // 1v1: 1 all-rounder
    fieldSpots.push({ role: 'midfielder', homeX: 0, homeZ: 18 * dir });
  } else if (fieldPlayersCount === 2) {
    // 2v2: 1 Defender, 1 Forward
    fieldSpots.push({ role: 'defender', homeX: 0, homeZ: 26 * dir });
    fieldSpots.push({ role: 'forward', homeX: 0, homeZ: 12 * dir });
  } else if (fieldPlayersCount === 3) {
    // 3v3: 1 Defender, 1 Midfielder, 1 Forward
    fieldSpots.push({ role: 'defender', homeX: 0, homeZ: 28 * dir });
    fieldSpots.push({ role: 'midfielder', homeX: -10, homeZ: 16 * dir });
    fieldSpots.push({ role: 'forward', homeX: 10, homeZ: 10 * dir });
  } else if (fieldPlayersCount === 4) {
    // 4v4: 1 Defender, 2 Midfielders, 1 Forward
    fieldSpots.push({ role: 'defender', homeX: 0, homeZ: 28 * dir });
    fieldSpots.push({ role: 'midfielder', homeX: -14, homeZ: 16 * dir });
    fieldSpots.push({ role: 'midfielder', homeX: 14, homeZ: 16 * dir });
    fieldSpots.push({ role: 'forward', homeX: 0, homeZ: 8 * dir });
  } else {
    // 5v5: 2 Defenders, 2 Midfielders, 1 Forward
    fieldSpots.push({ role: 'defender', homeX: -12, homeZ: 28 * dir });
    fieldSpots.push({ role: 'defender', homeX: 12, homeZ: 28 * dir });
    fieldSpots.push({ role: 'midfielder', homeX: -14, homeZ: 15 * dir });
    fieldSpots.push({ role: 'midfielder', homeX: 14, homeZ: 15 * dir });
    fieldSpots.push({ role: 'forward', homeX: 0, homeZ: 7 * dir });
  }

  return [gk, ...fieldSpots];
}
