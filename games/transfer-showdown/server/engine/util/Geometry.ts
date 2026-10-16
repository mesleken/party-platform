import { Vec2 } from '../MatchState.js';
import { SeededRandom } from '../random/SeededRandom.js';

/** Saha ölçüleri: x 0..100 (kale çizgileri x=0 ve x=100), y 0..64 */
export const PITCH_W = 100;
export const PITCH_H = 64;
export const GOAL_CENTER_Y = 32;
export const GOAL_POST_TOP = 28.5;
export const GOAL_POST_BOTTOM = 35.5;
export const BOX_DEPTH = 16.5;      // ceza sahası derinliği
export const BOX_HALF_WIDTH = 20.0; // ceza sahası yarı genişliği (merkezden)

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function distV(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Takımın hücum yönüne göre "kendi kalemden uzaklık" koordinatı (0 = kendi kale çizgisi, 100 = rakip kale çizgisi). */
export function toOwn(x: number, dir: 1 | -1): number {
  return dir === 1 ? x : 100 - x;
}

export function fromOwn(p: number, dir: 1 | -1): number {
  return dir === 1 ? p : 100 - p;
}

export function segmentClosest(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; t: number; d: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = 0;
  if (l2 > 1e-9) {
    t = clamp(((px - ax) * abx + (py - ay) * aby) / l2, 0, 1);
  }
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return { x: cx, y: cy, t, d: Math.hypot(px - cx, py - cy) };
}

/** Yaklaşık normal dağılım (3 uniform toplamı), ortalama 0, std ~1 */
export function gaussian(rng: SeededRandom): number {
  return ((rng.next() + rng.next() + rng.next()) - 1.5) * 2.0;
}

/** Rakip ceza sahası içinde mi? (hücum eden takımın perspektifinden, own-coord) */
export function inAttackingBox(ownP: number, y: number): boolean {
  return ownP >= 100 - BOX_DEPTH && Math.abs(y - GOAL_CENTER_Y) <= BOX_HALF_WIDTH;
}

export function inDefendingBox(ownP: number, y: number): boolean {
  return ownP <= BOX_DEPTH && Math.abs(y - GOAL_CENTER_Y) <= BOX_HALF_WIDTH;
}
