import type { AnonymousChoice, PlayerAnswerRecord, VoteRecord } from '../shared/types.js';

export class VotingManager {
  private choices: AnonymousChoice[] = [];
  private votes = new Map<string, VoteRecord>();

  public setupChoices(
    correctAnswer: string,
    playerAnswers: PlayerAnswerRecord[],
    defaultFakes: string[] = []
  ): AnonymousChoice[] {
    this.choices = [];
    this.votes.clear();

    const rawList: Array<{
      text: string;
      isReal: boolean;
      authorSessionId: string;
      authorNickname: string;
    }> = [];

    // Real Answer
    rawList.push({
      text: correctAnswer,
      isReal: true,
      authorSessionId: '',
      authorNickname: 'Gerçek Cevap'
    });

    // Player Fake Answers
    for (const pa of playerAnswers) {
      rawList.push({
        text: pa.answerText,
        isReal: false,
        authorSessionId: pa.sessionId,
        authorNickname: pa.nickname
      });
    }

    // If fewer than 4 choices, supplement with default fake answers
    if (rawList.length < 4 && defaultFakes.length > 0) {
      for (const fake of defaultFakes) {
        if (rawList.length >= 4) break;
        // Don't add duplicate
        if (!rawList.some((r) => r.text.toLowerCase() === fake.toLowerCase())) {
          rawList.push({
            text: fake,
            isReal: false,
            authorSessionId: '',
            authorNickname: 'Sistem Blöfü'
          });
        }
      }
    }

    // Shuffle raw list (Fisher-Yates)
    for (let i = rawList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rawList[i], rawList[j]] = [rawList[j], rawList[i]];
    }

    // Assign IDs (opt_0, opt_1, ...)
    this.choices = rawList.map((item, idx) => ({
      id: `opt_${idx}`,
      text: item.text,
      isReal: item.isReal,
      authorSessionId: item.authorSessionId,
      authorNickname: item.authorNickname
    }));

    return this.choices;
  }

  public vote(
    voterSessionId: string,
    voterNickname: string,
    choiceId: string
  ): { success: boolean; error?: string } {
    const choice = this.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return { success: false, error: 'Geçersiz seçenek.' };
    }

    // Rule: Player cannot vote for their own bluff!
    if (choice.authorSessionId && choice.authorSessionId === voterSessionId) {
      return { success: false, error: 'Kendi yazdığınız blöfe oy veremezsiniz!' };
    }

    // Check if already voted
    if (this.votes.has(voterSessionId)) {
      return { success: false, error: 'Zaten oy kullandınız.' };
    }

    this.votes.set(voterSessionId, {
      voterSessionId,
      voterNickname,
      choiceId,
      votedAt: Date.now()
    });

    return { success: true };
  }

  public getChoice(choiceId: string): AnonymousChoice | undefined {
    return this.choices.find((c) => c.id === choiceId);
  }

  public getChoices(): AnonymousChoice[] {
    return this.choices;
  }

  public getVotes(): VoteRecord[] {
    return Array.from(this.votes.values());
  }

  public getVoteCount(): number {
    return this.votes.size;
  }
}
