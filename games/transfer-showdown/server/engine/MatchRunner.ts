export interface FixedStepEngine {
  stepFixed(dt: number): void;
  isFinished(): boolean;
}

export class MatchRunner {
  private accumulator = 0;
  private readonly fixedStepSec: number;

  constructor(fixedStepSec: number = 0.05) {
    this.fixedStepSec = fixedStepSec;
  }

  /**
   * Sunucudan gelen değişken delta zamanını sabit zaman adımlarına (fixed steps) böler.
   */
  public advance(realDeltaSec: number, engine: FixedStepEngine) {
    // Aşırı gecikmelerde (spiral of death) en fazla 0.25 saniye işle
    this.accumulator += Math.min(realDeltaSec, 0.25);

    while (this.accumulator >= this.fixedStepSec && !engine.isFinished()) {
      engine.stepFixed(this.fixedStepSec);
      this.accumulator -= this.fixedStepSec;
    }
  }

  /**
   * Maçı görsel oynatma olmadan, saniyeler içinde baştan sona simüle eder.
   */
  public static runHeadlessToCompletion(
    engine: FixedStepEngine,
    fixedStepSec: number = 0.05,
    maxSteps: number = 150000
  ) {
    let steps = 0;
    while (!engine.isFinished() && steps < maxSteps) {
      engine.stepFixed(fixedStepSec);
      steps++;
    }
  }
}
