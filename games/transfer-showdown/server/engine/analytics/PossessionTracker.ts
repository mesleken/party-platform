export class PossessionTracker {
  private controlledSeconds: [number, number] = [0, 0];
  private looseSeconds = 0;

  public advance(dt: number, possessionTeam: 0 | 1 | null, isBallActive: boolean) {
    if (!isBallActive) return;

    if (possessionTeam === 0) {
      this.controlledSeconds[0] += dt;
    } else if (possessionTeam === 1) {
      this.controlledSeconds[1] += dt;
    } else {
      this.looseSeconds += dt;
    }
  }

  public getPercentages(): [number, number] {
    const t0 = this.controlledSeconds[0];
    const t1 = this.controlledSeconds[1];
    const total = t0 + t1;

    if (total <= 0) {
      return [50, 50];
    }

    const homePct = Math.round((t0 / total) * 100);
    const clampedHome = Math.max(15, Math.min(85, homePct));
    return [clampedHome, 100 - clampedHome];
  }

  public getControlledSeconds(): [number, number] {
    return [Number(this.controlledSeconds[0].toFixed(1)), Number(this.controlledSeconds[1].toFixed(1))];
  }

  public reset() {
    this.controlledSeconds = [0, 0];
    this.looseSeconds = 0;
  }
}
