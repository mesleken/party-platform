import { BLUFF_QUESTIONS, FRIEND_QUESTION_TEMPLATES, getQuestionsForCategory } from '../shared/questions.js';
import type { BluffQuestion, BluffCategory } from '../shared/types.js';

export class QuestionManager {
  private category: BluffCategory = 'genel';
  private availableQuestions: BluffQuestion[] = [];
  private currentQuestion?: BluffQuestion;
  private friendTemplatesDeck: string[] = [];
  private usedQuestionIds: Set<string> = new Set();

  constructor() {
    this.resetDeck();
  }

  public setCategory(cat: BluffCategory) {
    this.category = cat;
    this.resetDeck();
  }

  public getCategory(): BluffCategory {
    return this.category;
  }

  public resetMatchDeck() {
    this.usedQuestionIds.clear();
    this.resetDeck();
  }

  public resetDeck() {
    if (this.category === 'arkadas') {
      this.friendTemplatesDeck = [...FRIEND_QUESTION_TEMPLATES].sort(() => Math.random() - 0.5);
    } else {
      const qs = getQuestionsForCategory(this.category);
      // Filter out already used questions in this match if possible
      const unused = qs.filter((q) => !this.usedQuestionIds.has(q.id));
      const pool = unused.length > 0 ? unused : qs;
      this.availableQuestions = [...pool].sort(() => Math.random() - 0.5);
    }
  }

  public nextQuestion(subjectPlayer?: { id: string; nickname: string }): BluffQuestion {
    if (this.category === 'arkadas' && subjectPlayer) {
      if (this.friendTemplatesDeck.length === 0) {
        this.friendTemplatesDeck = [...FRIEND_QUESTION_TEMPLATES].sort(() => Math.random() - 0.5);
      }
      const tmpl = this.friendTemplatesDeck.pop() || "{NAME}'in en sevdiği renk nedir?";
      const questionText = tmpl.replace('{NAME}', subjectPlayer.nickname);

      this.currentQuestion = {
        id: `friend_${Date.now()}`,
        category: '🌟 Arkadaş Modu',
        question: questionText,
        correctAnswer: '', // Will be assigned when subject player submits!
        defaultFakes: ['Mavi', 'Pizza', 'Kedi', 'Tembellik', 'Çikolata'],
        isFriendQuestion: true,
        subjectPlayerId: subjectPlayer.id,
        subjectPlayerNickname: subjectPlayer.nickname,
      };
      return this.currentQuestion;
    }

    if (this.availableQuestions.length === 0) {
      this.resetDeck();
    }
    this.currentQuestion = this.availableQuestions.pop() || BLUFF_QUESTIONS[0];
    this.usedQuestionIds.add(this.currentQuestion.id);
    return this.currentQuestion;
  }

  public setCurrentCorrectAnswer(answer: string) {
    if (this.currentQuestion) {
      this.currentQuestion.correctAnswer = answer;
    }
  }

  public getCurrentQuestion(): BluffQuestion | undefined {
    return this.currentQuestion;
  }
}
