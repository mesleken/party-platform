export interface RandomSource {
  next(): number;
  range(min: number, max: number): number;
  nextInt(maxExclusive: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
}

/**
 * Mulberry32 deterministik 32-bit sözde rastgele sayı üreteci (PRNG).
 * Aynı seed ile her zaman birebir aynı sayı dizisini üretir.
 */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number = 20261016) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      return 0;
    }
    return Math.floor(this.next() * maxExclusive);
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return items[this.nextInt(items.length)];
  }

  public getSeed(): number {
    return this.state;
  }
}
