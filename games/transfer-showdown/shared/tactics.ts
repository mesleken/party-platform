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

  return {
    attack: finalAtt,
    midfield: finalMid,
    defense: finalDef,
    goalkeeping,
    chemistry,
    overall
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
