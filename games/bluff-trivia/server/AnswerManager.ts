import type { PlayerAnswerRecord } from '../shared/types.js';
import { formatBluffAnswer, normalizeForComparison } from '../shared/types.js';

export class AnswerManager {
  private answers = new Map<string, PlayerAnswerRecord>();

  public clear() {
    this.answers.clear();
  }

  public submitAnswer(
    sessionId: string,
    nickname: string,
    rawText: string,
    correctAnswer: string
  ): { success: boolean; formattedAnswer?: string; error?: string } {
    const formatted = formatBluffAnswer(rawText);

    if (!formatted) {
      return { success: false, error: 'Cevap boş olamaz.' };
    }

    if (formatted.length < 2) {
      return { success: false, error: 'Cevap en az 2 karakter olmalıdır.' };
    }

    if (formatted.length > 70) {
      return { success: false, error: 'Cevap en fazla 70 karakter olabilir.' };
    }

    // Check if player already submitted
    if (this.answers.has(sessionId)) {
      return { success: false, error: 'Zaten bir blöf gönderdiniz.' };
    }

    const normSubmitted = normalizeForComparison(formatted);

    // Kural 1: Gerçek cevabı yazamaz!
    if (correctAnswer && normSubmitted === normalizeForComparison(correctAnswer)) {
      return {
        success: false,
        error: 'Tebrikler ama bu zaten GERÇEK CEVAP! Gerçek cevabı yazamazsınız; diğer oyuncuları kandırmak için bir blöf yazın.'
      };
    }

    // Kural 2: Başka bir oyuncunun yazdığı cevabı yazamaz (Mükerrerlik engeli)!
    for (const existing of this.answers.values()) {
      if (normalizeForComparison(existing.answerText) === normSubmitted) {
        return {
          success: false,
          error: 'Bu cevap başka bir oyuncu tarafından zaten yazıldı! Lütfen farklı ve özgün bir blöf yazın.'
        };
      }
    }

    this.answers.set(sessionId, {
      sessionId,
      nickname,
      answerText: formatted,
      submittedAt: Date.now()
    });

    return { success: true, formattedAnswer: formatted };
  }

  public getAnswer(sessionId: string): PlayerAnswerRecord | undefined {
    return this.answers.get(sessionId);
  }

  public getAllAnswers(): PlayerAnswerRecord[] {
    return Array.from(this.answers.values());
  }

  public getCount(): number {
    return this.answers.size;
  }
}
