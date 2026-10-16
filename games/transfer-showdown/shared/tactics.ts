import {
  DefensiveLineType,
  ManagerTactics,
  PlayerCard,
  PlaystyleType,
  TeamSynergy
} from './types.js';
import { checkPositionAffinity, getFormationSlots } from './formations.js';

export function calculateTeamSynergy(
  tactics: ManagerTactics,
  cards: PlayerCard[]
): TeamSynergy {
  const cardMap = new Map<string, PlayerCard>();
  cards.forEach((c) => cardMap.set(c.id, c));

  const slots = getFormationSlots(tactics.formation);

  let totalAtt = 0;
  let countAtt = 0;
  let totalMid = 0;
  let countMid = 0;
  let totalDef = 0;
  let countDef = 0;
  let gkRating = 75;
  let affinitySum = 0;

  for (const slot of slots) {
    const cardId = tactics.lineup[slot.slotIndex];
    const card = cardId ? cardMap.get(cardId) : undefined;
    if (!card) continue;

    const affinity = checkPositionAffinity(slot.requiredPosition, card.position);
    affinitySum += affinity;

    const effectiveOvr = card.ovr * (0.5 + 0.5 * affinity);

    if (slot.requiredPosition === 'GK') {
      gkRating = effectiveOvr;
    } else if (slot.requiredPosition === 'DEF') {
      const defVal = (card.stats.def * 0.45 + card.stats.phy * 0.35 + card.stats.pac * 0.2) * affinity;
      totalDef += defVal;
      countDef++;
    } else if (slot.requiredPosition === 'MID') {
      const midVal = (card.stats.pas * 0.4 + card.stats.dri * 0.35 + card.stats.phy * 0.25) * affinity;
      totalMid += midVal;
      countMid++;
    } else if (slot.requiredPosition === 'FWD') {
      const attVal = (card.stats.sho * 0.45 + card.stats.pac * 0.35 + card.stats.dri * 0.2) * affinity;
      totalAtt += attVal;
      countAtt++;
    }
  }

  const attack = countAtt > 0 ? Math.round(totalAtt / countAtt) : 70;
  const midfield = countMid > 0 ? Math.round(totalMid / countMid) : 70;
  const defense = countDef > 0 ? Math.round(totalDef / countDef) : 70;
  const goalkeeping = Math.round(gkRating);

  // Kimya (Chemistry): 11 oyuncunun mevki uyumu (max 100)
  const chemistry = Math.min(100, Math.round((affinitySum / 11) * 100));

  // Taktik & Oyun Stili Etkisi
  let attMod = 0;
  let midMod = 0;
  let defMod = 0;

  if (tactics.playstyle === 'possession') {
    midMod += 4;
    attMod -= 1;
  } else if (tactics.playstyle === 'counter') {
    attMod += 3;
    defMod += 2;
    midMod -= 3;
  } else if (tactics.playstyle === 'high_press') {
    attMod += 4;
    defMod -= 3;
  }

  if (tactics.defensiveLine === 'high') {
    midMod += 3;
    defMod -= 4;
  } else if (tactics.defensiveLine === 'low') {
    defMod += 4;
    attMod -= 3;
  }

  // Agresif Oyna (Son 15 dk açılabilen mod)
  if (tactics.allOutAttack) {
    attMod += 8;
    defMod -= 8;
  }

  const finalAtt = Math.max(50, Math.min(99, attack + attMod));
  const finalMid = Math.max(50, Math.min(99, midfield + midMod));
  const finalDef = Math.max(50, Math.min(99, defense + defMod));
  const overall = Math.round((finalAtt * 0.35 + finalMid * 0.3 + finalDef * 0.25 + goalkeeping * 0.1) * (0.85 + 0.15 * (chemistry / 100)));

  const toStars = (val: number): 1 | 2 | 3 => {
    if (val >= 83) return 3;
    if (val >= 75) return 2;
    return 1;
  };

  return {
    attack: finalAtt,
    midfield: finalMid,
    defense: finalDef,
    goalkeeping,
    chemistry,
    overall,
    attackStars: toStars(finalAtt),
    midfieldStars: toStars(finalMid),
    defenseStars: toStars(finalDef)
  };
}

export function toStarSymbols(stars: 1 | 2 | 3): string {
  if (stars === 3) return '★★★';
  if (stars === 2) return '★★☆';
  return '★☆☆';
}

export function adjustComparativeStars(
  syn0: TeamSynergy,
  syn1: TeamSynergy
): { team0: TeamSynergy; team1: TeamSynergy } {
  const adjustLine = (val0: number, val1: number, stars0: 1 | 2 | 3, stars1: 1 | 2 | 3): [1 | 2 | 3, 1 | 2 | 3] => {
    let s0 = stars0;
    let s1 = stars1;
    if (val0 - val1 >= 5 && s0 <= s1) {
      s0 = Math.min(3, s1 + 1) as 1 | 2 | 3;
      if (s0 === s1) s1 = Math.max(1, s0 - 1) as 1 | 2 | 3;
    } else if (val1 - val0 >= 5 && s1 <= s0) {
      s1 = Math.min(3, s0 + 1) as 1 | 2 | 3;
      if (s1 === s0) s0 = Math.max(1, s1 - 1) as 1 | 2 | 3;
    }
    return [s0, s1];
  };

  const [att0, att1] = adjustLine(syn0.attack, syn1.attack, syn0.attackStars, syn1.attackStars);
  const [mid0, mid1] = adjustLine(syn0.midfield, syn1.midfield, syn0.midfieldStars, syn1.midfieldStars);
  const [def0, def1] = adjustLine(syn0.defense, syn1.defense, syn0.defenseStars, syn1.defenseStars);

  return {
    team0: { ...syn0, attackStars: att0, midfieldStars: mid0, defenseStars: def0 },
    team1: { ...syn1, attackStars: att1, midfieldStars: mid1, defenseStars: def1 }
  };
}

export function getStyleMatchupBonus(
  styleA: PlaystyleType,
  styleB: PlaystyleType
): { homeAdvantage: number; awayAdvantage: number } {
  // Oyun Stili Taş-Kağıt-Makas Etkisi
  if (styleA === 'high_press' && styleB === 'possession') {
    return { homeAdvantage: 4, awayAdvantage: -2 };
  }
  if (styleB === 'high_press' && styleA === 'possession') {
    return { homeAdvantage: -2, awayAdvantage: 4 };
  }

  if (styleA === 'counter' && styleB === 'high_press') {
    return { homeAdvantage: 5, awayAdvantage: -3 };
  }
  if (styleB === 'counter' && styleA === 'high_press') {
    return { homeAdvantage: -3, awayAdvantage: 5 };
  }

  if (styleA === 'possession' && styleB === 'balanced') {
    return { homeAdvantage: 3, awayAdvantage: 0 };
  }
  if (styleB === 'possession' && styleA === 'balanced') {
    return { homeAdvantage: 0, awayAdvantage: 3 };
  }

  return { homeAdvantage: 0, awayAdvantage: 0 };
}
