import type { TrackWaypoint, TrackDecoration } from './types.js';

export const TRACK_CONFIG = {
  name: 'TOY WORKSHOP CIRCUIT',
  totalLaps: 3,
  trackWidth: 14,
  bounds: {
    minX: -85,
    maxX: 85,
    minZ: -65,
    maxZ: 65,
  },
};

/**
 * 18 Kontrol Noktası (Checkpoints / Waypoints)
 * Kapalı bir döngü oluşturur.
 */
export const TRACK_WAYPOINTS: TrackWaypoint[] = [
  { x: 0, z: -45, radius: 14 },     // 0: START / FINISH LINE
  { x: 30, z: -45, radius: 14 },    // 1: İlk Düzlük
  { x: 55, z: -38, radius: 14 },    // 2: Dönüş Girişi
  { x: 68, z: -15, radius: 13 },    // 3: Doğu Virajı
  { x: 60, z: 15, radius: 13 },     // 4: Doğu Çıkışı
  { x: 35, z: 32, radius: 14 },     // 5: Masa Kenarı Düzlüğü
  { x: 10, z: 28, radius: 13 },     // 6: S Viraj 1
  { x: -5, z: 42, radius: 13 },     // 7: S Viraj 2 (Kitap Kulesi Önü)
  { x: -28, z: 50, radius: 14 },    // 8: Güney Dönüşü
  { x: -55, z: 40, radius: 14 },    // 9: Güneybatı Virajı
  { x: -68, z: 18, radius: 14 },    // 10: Batı Düzlüğü
  { x: -62, z: -8, radius: 13 },    // 11: Pil Kutusu Yanı
  { x: -42, z: -20, radius: 13 },   // 12: Şikan Giriş
  { x: -50, z: -35, radius: 13 },   // 13: Şikan Çıkış
  { x: -35, z: -48, radius: 14 },   // 14: Son Viraj
  { x: -15, z: -46, radius: 14 },   // 15: Ana Düzlüğe Bağlantı
];

/**
 * Pist boyunca toplanabilecek Powerup Kutuları
 */
export const PICKUP_SPAWNS = [
  { id: 'item_0', x: 20, y: 1.0, z: -45 },
  { id: 'item_1', x: 64, y: 1.0, z: 0 },
  { id: 'item_2', x: 2, y: 1.0, z: 35 },
  { id: 'item_3', x: -45, y: 1.0, z: 46 },
  { id: 'item_4', x: -65, y: 1.0, z: 5 },
  { id: 'item_5', x: -25, y: 1.0, z: -47 },
];

/**
 * Re-Volt hissini veren devasa oda dekorasyonları
 */
export const TRACK_DECORATIONS: TrackDecoration[] = [
  // Dev Kitap Yığını (Güney Virajı)
  { type: 'book', x: -12, z: 56, rotation: 0.25, scale: 3.2, color: '#dc2626', label: 'RE-VOLT 99' },
  { type: 'book', x: -10, z: 54, rotation: -0.15, scale: 3.0, color: '#2563eb', label: 'RC MANUAL' },
  { type: 'book', x: -14, z: 55, rotation: 0.45, scale: 2.8, color: '#f59e0b', label: 'COMIC BOOK' },

  // Dev Kahve Kupası (İç Ada)
  { type: 'mug', x: 15, z: -10, rotation: 0.8, scale: 4.5, color: '#f8fafc' },

  // Dev Tahta Oyuncak Blokları
  { type: 'block', x: 45, z: -25, rotation: 0.1, scale: 3.5, color: '#e11d48', label: 'R' },
  { type: 'block', x: -30, z: -5, rotation: 0.6, scale: 3.0, color: '#16a34a', label: 'C' },
  { type: 'block', x: -25, z: 15, rotation: -0.3, scale: 3.2, color: '#eab308', label: '9' },

  // Dev AA Piller
  { type: 'battery', x: -60, z: -15, rotation: 1.57, scale: 2.4, color: '#d97706' },
  { type: 'battery', x: -56, z: -18, rotation: 1.4, scale: 2.4, color: '#d97706' },

  // Dev Gazoz Kutusu (Kuzeydoğu virajı)
  { type: 'can', x: 75, z: -25, rotation: 0.3, scale: 4.0, color: '#0ea5e9', label: 'VOLT COLA' },

  // Dev Kurşun Kalemler (Bariyer görevi)
  { type: 'pencil', x: 42, z: 42, rotation: 0.78, scale: 2.5, color: '#f59e0b' },
  { type: 'pencil', x: -68, z: 32, rotation: -0.65, scale: 2.5, color: '#10b981' },

  // Dev Silgi (Eraser)
  { type: 'eraser', x: -48, z: 8, rotation: -0.4, scale: 2.8, color: '#3b82f6', label: 'PELIKAN' },

  // Dev İngiliz Anahtarı (Wrench)
  { type: 'wrench', x: -2, z: 8, rotation: 0.52, scale: 3.0, color: '#94a3b8' },

  // Dev Kargo Kolileri (Cardboard Boxes)
  { type: 'box', x: -80, z: -55, rotation: 0.2, scale: 4.5, color: '#b45309', label: 'FRAGILE' },
  { type: 'box', x: 78, z: 48, rotation: -0.35, scale: 4.0, color: '#92400e', label: 'ACME TOYS' },

  // Domino Taşları Dizisi (Viraj Bariyeri)
  { type: 'domino', x: 58, z: 26, rotation: 0.4, scale: 2.2, color: '#18181b' },
  { type: 'domino', x: 55, z: 30, rotation: 0.6, scale: 2.2, color: '#18181b' },
  { type: 'domino', x: 51, z: 34, rotation: 0.8, scale: 2.2, color: '#18181b' },
  { type: 'domino', x: 46, z: 37, rotation: 1.0, scale: 2.2, color: '#18181b' },
];

export interface ObstacleCollider {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  bounceMultiplier: number;
}

/**
 * Fizik simülasyonu için çarpmaya açık engeller
 */
export const OBSTACLE_COLLIDERS: ObstacleCollider[] = [
  // Dev Kahve Kupası (İç Ada)
  { id: 'obs_mug', name: 'Kahve Kupası', x: 15, z: -10, radius: 10.5, bounceMultiplier: 1.4 },

  // Dev Kitap Yığını
  { id: 'obs_books', name: 'Kitap Yığını', x: -12, z: 55, radius: 9.0, bounceMultiplier: 1.2 },

  // Dev Tahta Oyuncak Blokları
  { id: 'obs_block1', name: 'Kırmızı Blok', x: 45, z: -25, radius: 6.5, bounceMultiplier: 1.5 },
  { id: 'obs_block2', name: 'Yeşil Blok', x: -30, z: -5, radius: 5.5, bounceMultiplier: 1.5 },
  { id: 'obs_block3', name: 'Sarı Blok', x: -25, z: 15, radius: 5.8, bounceMultiplier: 1.5 },

  // Dev AA Piller
  { id: 'obs_battery1', name: 'Pil 1', x: -60, z: -15, radius: 4.2, bounceMultiplier: 1.3 },
  { id: 'obs_battery2', name: 'Pil 2', x: -56, z: -18, radius: 4.2, bounceMultiplier: 1.3 },

  // Dev Gazoz Kutusu
  { id: 'obs_can', name: 'Gazoz Kutusu', x: 75, z: -25, radius: 7.8, bounceMultiplier: 1.4 },

  // Dev Kurşun Kalemler
  { id: 'obs_pencil1', name: 'Kalem 1', x: 42, z: 42, radius: 4.0, bounceMultiplier: 1.3 },
  { id: 'obs_pencil2', name: 'Kalem 2', x: -68, z: 32, radius: 4.0, bounceMultiplier: 1.3 },

  // Start / Finish Gantry Direkleri
  { id: 'obs_gantry_left', name: 'Start Direği Sol', x: 0, z: -53.5, radius: 1.5, bounceMultiplier: 1.2 },
  { id: 'obs_gantry_right', name: 'Start Direği Sağ', x: 0, z: -36.5, radius: 1.5, bounceMultiplier: 1.2 },
];

/**
 * 3D dünya koordinatlarını [0..1] normalize MiniMap koordinatlarına dönüştürür.
 */
export function getNormalizedMiniMapCoords(worldX: number, worldZ: number) {
  const { minX, maxX, minZ, maxZ } = TRACK_CONFIG.bounds;
  const padding = 10;
  const normX = (worldX - (minX - padding)) / ((maxX + padding) - (minX - padding));
  const normY = (worldZ - (minZ - padding)) / ((maxZ + padding) - (minZ - padding));
  return {
    x: Math.max(0, Math.min(1, normX)),
    y: Math.max(0, Math.min(1, normY)),
  };
}

// ─── PİST METRE İLERLEMESİ VE SPLINE MESAFESİ (RE-VOLT TELEMETRİSİ) ───
export const SEGMENT_LENGTHS: number[] = [];
export const CUMULATIVE_DISTANCES: number[] = [0];
let runningTrackLen = 0;
for (let i = 0; i < TRACK_WAYPOINTS.length; i++) {
  const p1 = TRACK_WAYPOINTS[i];
  const p2 = TRACK_WAYPOINTS[(i + 1) % TRACK_WAYPOINTS.length];
  const segDist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
  SEGMENT_LENGTHS.push(segDist);
  runningTrackLen += segDist;
  CUMULATIVE_DISTANCES.push(runningTrackLen);
}
export const TRACK_TOTAL_LENGTH = runningTrackLen;

/**
 * Bir aracın pist üzerindeki toplam metre ilerlemesini hesaplar
 */
export function getTrackDistanceAtPoint(x: number, z: number, nearIdx: number): number {
  const count = TRACK_WAYPOINTS.length;
  let bestDist = Infinity;
  let bestProgress = 0;

  for (let offset = -1; offset <= 2; offset++) {
    const i = (nearIdx + offset + count) % count;
    const p1 = TRACK_WAYPOINTS[i];
    const p2 = TRACK_WAYPOINTS[(i + 1) % count];
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const segLenSq = dx * dx + dz * dz;
    if (segLenSq === 0) continue;

    const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (z - p1.z) * dz) / segLenSq));
    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const dist = Math.hypot(x - projX, z - projZ);

    if (dist < bestDist) {
      bestDist = dist;
      bestProgress = CUMULATIVE_DISTANCES[i] + t * SEGMENT_LENGTHS[i];
    }
  }

  return bestProgress;
}
