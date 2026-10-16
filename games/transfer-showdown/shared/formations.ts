import { CardPosition, FormationSlot, FormationType, PlayerCard } from './types.js';

export const FORMATIONS: Record<FormationType, FormationSlot[]> = {
  '4-3-3': [
    { slotIndex: 0, role: 'GK', requiredPosition: 'GK', x: 50, y: 88 },
    { slotIndex: 1, role: 'LB', requiredPosition: 'DEF', x: 18, y: 72 },
    { slotIndex: 2, role: 'LCB', requiredPosition: 'DEF', x: 38, y: 75 },
    { slotIndex: 3, role: 'RCB', requiredPosition: 'DEF', x: 62, y: 75 },
    { slotIndex: 4, role: 'RB', requiredPosition: 'DEF', x: 82, y: 72 },
    { slotIndex: 5, role: 'LCM', requiredPosition: 'MID', x: 30, y: 50 },
    { slotIndex: 6, role: 'CDM', requiredPosition: 'MID', x: 50, y: 55 },
    { slotIndex: 7, role: 'RCM', requiredPosition: 'MID', x: 70, y: 50 },
    { slotIndex: 8, role: 'LW', requiredPosition: 'FWD', x: 20, y: 25 },
    { slotIndex: 9, role: 'ST', requiredPosition: 'FWD', x: 50, y: 20 },
    { slotIndex: 10, role: 'RW', requiredPosition: 'FWD', x: 80, y: 25 }
  ],
  '4-4-2': [
    { slotIndex: 0, role: 'GK', requiredPosition: 'GK', x: 50, y: 88 },
    { slotIndex: 1, role: 'LB', requiredPosition: 'DEF', x: 18, y: 72 },
    { slotIndex: 2, role: 'LCB', requiredPosition: 'DEF', x: 38, y: 75 },
    { slotIndex: 3, role: 'RCB', requiredPosition: 'DEF', x: 62, y: 75 },
    { slotIndex: 4, role: 'RB', requiredPosition: 'DEF', x: 82, y: 72 },
    { slotIndex: 5, role: 'LM', requiredPosition: 'MID', x: 18, y: 48 },
    { slotIndex: 6, role: 'LCM', requiredPosition: 'MID', x: 38, y: 52 },
    { slotIndex: 7, role: 'RCM', requiredPosition: 'MID', x: 62, y: 52 },
    { slotIndex: 8, role: 'RM', requiredPosition: 'MID', x: 82, y: 48 },
    { slotIndex: 9, role: 'LST', requiredPosition: 'FWD', x: 38, y: 22 },
    { slotIndex: 10, role: 'RST', requiredPosition: 'FWD', x: 62, y: 22 }
  ],
  '4-2-3-1': [
    { slotIndex: 0, role: 'GK', requiredPosition: 'GK', x: 50, y: 88 },
    { slotIndex: 1, role: 'LB', requiredPosition: 'DEF', x: 18, y: 72 },
    { slotIndex: 2, role: 'LCB', requiredPosition: 'DEF', x: 38, y: 75 },
    { slotIndex: 3, role: 'RCB', requiredPosition: 'DEF', x: 62, y: 75 },
    { slotIndex: 4, role: 'RB', requiredPosition: 'DEF', x: 82, y: 72 },
    { slotIndex: 5, role: 'LDM', requiredPosition: 'MID', x: 38, y: 58 },
    { slotIndex: 6, role: 'RDM', requiredPosition: 'MID', x: 62, y: 58 },
    { slotIndex: 7, role: 'LAM', requiredPosition: 'MID', x: 22, y: 38 },
    { slotIndex: 8, role: 'CAM', requiredPosition: 'MID', x: 50, y: 36 },
    { slotIndex: 9, role: 'RAM', requiredPosition: 'MID', x: 78, y: 38 },
    { slotIndex: 10, role: 'ST', requiredPosition: 'FWD', x: 50, y: 20 }
  ],
  '3-5-2': [
    { slotIndex: 0, role: 'GK', requiredPosition: 'GK', x: 50, y: 88 },
    { slotIndex: 1, role: 'LCB', requiredPosition: 'DEF', x: 28, y: 75 },
    { slotIndex: 2, role: 'CB', requiredPosition: 'DEF', x: 50, y: 77 },
    { slotIndex: 3, role: 'RCB', requiredPosition: 'DEF', x: 72, y: 75 },
    { slotIndex: 4, role: 'LWB', requiredPosition: 'MID', x: 14, y: 52 },
    { slotIndex: 5, role: 'LCM', requiredPosition: 'MID', x: 35, y: 52 },
    { slotIndex: 6, role: 'CM', requiredPosition: 'MID', x: 50, y: 56 },
    { slotIndex: 7, role: 'RCM', requiredPosition: 'MID', x: 65, y: 52 },
    { slotIndex: 8, role: 'RWB', requiredPosition: 'MID', x: 86, y: 52 },
    { slotIndex: 9, role: 'LST', requiredPosition: 'FWD', x: 38, y: 22 },
    { slotIndex: 10, role: 'RST', requiredPosition: 'FWD', x: 62, y: 22 }
  ]
};

export function getFormationSlots(formation: FormationType): FormationSlot[] {
  return FORMATIONS[formation] || FORMATIONS['4-3-3'];
}

export function checkPositionAffinity(required: CardPosition, actual: CardPosition): number {
  if (required === actual) return 1.0;
  // Yakın mevkiler (örneğin DEF oyuncusu MID'de veya tam tersi)
  if ((required === 'DEF' && actual === 'MID') || (required === 'MID' && actual === 'DEF')) {
    return 0.75;
  }
  if ((required === 'MID' && actual === 'FWD') || (required === 'FWD' && actual === 'MID')) {
    return 0.8;
  }
  // Alakasız mevki (forvet defansta veya kaleci sahada)
  if (required === 'GK' || actual === 'GK') {
    return 0.2;
  }
  return 0.5;
}

export function autoAssignLineup(formation: FormationType, cards: PlayerCard[]): Record<number, string> {
  const slots = getFormationSlots(formation);
  const lineup: Record<number, string> = {};
  const remainingCards = [...cards];

  // 1. Önce tam eşleşen pozisyonları ata (GK -> GK, DEF -> DEF vb.)
  for (const slot of slots) {
    const perfectIndex = remainingCards.findIndex((c) => c.position === slot.requiredPosition);
    if (perfectIndex !== -1) {
      lineup[slot.slotIndex] = remainingCards[perfectIndex].id;
      remainingCards.splice(perfectIndex, 1);
    }
  }

  // 2. Kalan boş slotları en iyi uyum sağlayan kartlarla doldur
  for (const slot of slots) {
    if (!lineup[slot.slotIndex] && remainingCards.length > 0) {
      let bestCardIndex = 0;
      let bestAffinity = -1;
      for (let i = 0; i < remainingCards.length; i++) {
        const aff = checkPositionAffinity(slot.requiredPosition, remainingCards[i].position);
        if (aff > bestAffinity) {
          bestAffinity = aff;
          bestCardIndex = i;
        }
      }
      lineup[slot.slotIndex] = remainingCards[bestCardIndex].id;
      remainingCards.splice(bestCardIndex, 1);
    }
  }

  return lineup;
}
