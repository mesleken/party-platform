import type { Room, Client } from '@colyseus/core';
import type { SessionStateType, PlayerStateType } from '@platform/sdk-core';
import {
  BluffTriviaMatchState,
  BluffChoiceEntity,
  BluffRevealEntity
} from '@platform/sdk-core';
import type { BluffSettings } from '../shared/types.js';
import { formatBluffAnswer } from '../shared/types.js';
import { QuestionManager } from './QuestionManager.js';
import { AnswerManager } from './AnswerManager.js';
import { VotingManager } from './VotingManager.js';
import { ScoreManager } from './ScoreManager.js';

export class BluffTriviaGame {
  private room: Room<{ state: SessionStateType }>;
  private questionManager: QuestionManager;
  private answerManager: AnswerManager;
  private votingManager: VotingManager;
  private scoreManager: ScoreManager;

  private stepTimer?: NodeJS.Timeout;
  private countdownInterval?: NodeJS.Timeout;

  private settings: BluffSettings = {
    category: 'genel',
    submittingTimeSeconds: 30,
    votingTimeSeconds: 20,
    revealDurationSeconds: 10,
    totalRounds: 5,
  };

  private friendSubjectIndex = 0;

  constructor(room: Room<{ state: SessionStateType }>) {
    this.room = room;
    this.questionManager = new QuestionManager();
    this.answerManager = new AnswerManager();
    this.votingManager = new VotingManager();
    this.scoreManager = new ScoreManager();

    if (!this.room.state.bluffTriviaMatch) {
      this.room.state.bluffTriviaMatch = new BluffTriviaMatchState();
    }
  }

  public applySettings(settings: Partial<BluffSettings>) {
    if (settings.category) {
      this.settings.category = settings.category;
      this.questionManager.setCategory(settings.category);
    }
    if (settings.submittingTimeSeconds) {
      this.settings.submittingTimeSeconds = settings.submittingTimeSeconds;
    }
    if (settings.votingTimeSeconds) {
      this.settings.votingTimeSeconds = settings.votingTimeSeconds;
    }
    if (settings.revealDurationSeconds) {
      this.settings.revealDurationSeconds = settings.revealDurationSeconds;
    }
    if (settings.totalRounds) {
      this.settings.totalRounds = settings.totalRounds;
    }
    console.log(`[BluffTriviaGame] Ayarlar güncellendi:`, this.settings);
  }

  public getSettings(): BluffSettings {
    return { ...this.settings };
  }

  public start(customRounds?: number) {
    this.stop();

    const totalRounds = customRounds || this.settings.totalRounds || 5;
    console.log(`[BluffTriviaGame] Oyun başlatılıyor! Kategori: ${this.settings.category}, Toplam Round: ${totalRounds}`);

    this.room.state.activeGameId = 'bluff-trivia';
    this.room.state.status = 'bluff_playing';
    this.room.state.currentRound = 1;
    this.room.state.totalRounds = totalRounds;
    this.room.state.winnerNickname = '';

    // Oyuncuların skorlarını ve durumlarını sıfırla
    this.room.state.players.forEach((p) => {
      p.score = 0;
      p.rank = 0;
      p.bluffAnswer = '';
      p.bluffSubmitted = false;
      p.hasVotedBluff = false;
      p.votedBluffId = '';
      p.roundBluffGains = 0;
      p.trickedCount = 0;
    });

    this.friendSubjectIndex = 0;
    this.questionManager.resetDeck();
    this.startQuestionPhase();
  }

  // ─── 1. SORU & BLÖF YAZMA EVRESİ ───
  private startQuestionPhase() {
    this.clearTimers();

    const connectedPlayers: PlayerStateType[] = [];
    this.room.state.players.forEach((p) => {
      if (p.isConnected) connectedPlayers.push(p);
    });

    // Arkadaş Modu için konu olan oyuncuyu belirle
    let subjectPlayer: { id: string; nickname: string } | undefined;
    if (this.settings.category === 'arkadas' && connectedPlayers.length > 0) {
      const idx = this.friendSubjectIndex % connectedPlayers.length;
      const target = connectedPlayers[idx];
      subjectPlayer = { id: target.id, nickname: target.nickname };
      this.friendSubjectIndex++;
    }

    const q = this.questionManager.nextQuestion(subjectPlayer);
    const match = this.room.state.bluffTriviaMatch!;

    match.phase = 'submitting';
    match.round = this.room.state.currentRound;
    match.totalRounds = this.room.state.totalRounds;
    match.questionId = q.id;
    match.questionText = q.question;
    match.questionCategory = q.category;
    match.timeLeft = this.settings.submittingTimeSeconds;
    match.submittedCount = 0;
    match.votedCount = 0;
    match.bluffMasterName = '';
    match.bluffMasterCount = 0;

    // Arkadaş Modu alanları
    match.isFriendsMode = Boolean(q.isFriendQuestion);
    match.subjectPlayerId = q.subjectPlayerId || '';
    match.subjectPlayerName = q.subjectPlayerNickname || '';

    match.choices.clear();
    match.reveals.clear();
    this.answerManager.clear();

    // Oyuncuları bu soru için sıfırla
    let activePlayerCount = 0;
    this.room.state.players.forEach((p) => {
      if (p.isConnected) activePlayerCount++;
      p.bluffAnswer = '';
      p.bluffSubmitted = false;
      p.hasVotedBluff = false;
      p.votedBluffId = '';
      p.roundBluffGains = 0;
      p.trickedCount = 0;
    });
    match.totalPlayersCount = activePlayerCount;

    console.log(
      `[BluffTriviaGame] Round ${match.round} - Kategori: ${match.questionCategory} - Soru: "${q.question}"`
    );

    // Saniye sayacı
    this.countdownInterval = setInterval(() => {
      match.timeLeft--;
      if (match.timeLeft <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.startVotingPhase();
      }
    }, 1000);
  }

  public handlePlayerSubmitBluff(client: Client, rawAnswer: string) {
    const match = this.room.state.bluffTriviaMatch;
    if (!match || match.phase !== 'submitting') return;

    const player = this.room.state.players.get(client.sessionId);
    if (!player || player.bluffSubmitted) return;

    const curQ = this.questionManager.getCurrentQuestion();
    if (!curQ) return;

    // Özel Arkadaş Modu: Eğer soru sorulan kişi ise GERÇEK cevabını yazıyor!
    if (match.isFriendsMode && client.sessionId === match.subjectPlayerId) {
      const formatted = formatBluffAnswer(rawAnswer);
      if (!formatted || formatted.length < 1) {
        client.send('BLUFF_ERROR', { error: 'Lütfen geçerli bir gerçek cevap yazın.' });
        return;
      }

      curQ.correctAnswer = formatted;
      player.bluffSubmitted = true;
      player.bluffAnswer = formatted;
      match.submittedCount = this.answerManager.getCount() + 1;

      client.send('BLUFF_SUCCESS', { formattedAnswer: formatted, isSubject: true });
      console.log(`[BluffTriviaGame] 🌟 ${player.nickname} sorunun GERÇEK cevabını yazdı: "${formatted}"`);

      if (this.checkAllSubmitted()) {
        this.startVotingPhase();
      }
      return;
    }

    // Normal Blöf Yazımı
    const res = this.answerManager.submitAnswer(
      client.sessionId,
      player.nickname,
      rawAnswer,
      curQ.correctAnswer
    );

    if (!res.success) {
      // Hata uyarısını oyuncunun telefonuna anında gönder
      client.send('BLUFF_ERROR', { error: res.error });
      return;
    }

    player.bluffSubmitted = true;
    player.bluffAnswer = res.formattedAnswer || rawAnswer.trim();

    const subjectOffset = match.isFriendsMode && this.room.state.players.get(match.subjectPlayerId)?.bluffSubmitted ? 1 : 0;
    match.submittedCount = this.answerManager.getCount() + subjectOffset;

    client.send('BLUFF_SUCCESS', { formattedAnswer: player.bluffAnswer });
    console.log(`[BluffTriviaGame] ${player.nickname} blöfünü yazdı: "${player.bluffAnswer}"`);

    // Eğer herkes cevabını verdiyse hemen oylamaya geç
    if (this.checkAllSubmitted()) {
      this.startVotingPhase();
    }
  }

  private checkAllSubmitted(): boolean {
    let all = true;
    this.room.state.players.forEach((p) => {
      if (p.isConnected && !p.bluffSubmitted) {
        all = false;
      }
    });
    return all;
  }

  // ─── 2. OYLAMA EVRESİ (ANONİM SEÇENEKLER) ───
  private startVotingPhase() {
    this.clearTimers();

    const curQ = this.questionManager.getCurrentQuestion();
    if (!curQ) return;

    const match = this.room.state.bluffTriviaMatch!;

    // Arkadaş Modunda konu olan oyuncu süre bitene kadar yazmadıysa varsayılan ata
    if (match.isFriendsMode && !curQ.correctAnswer) {
      const subject = this.room.state.players.get(match.subjectPlayerId);
      curQ.correctAnswer = subject?.bluffAnswer || 'Mavi';
    }

    match.phase = 'voting';
    match.timeLeft = this.settings.votingTimeSeconds;
    match.votedCount = 0;

    // Özel Arkadaş Modu: Konu olan oyuncu gerçek cevabı zaten biliyor, oy vermesine gerek yok
    if (match.isFriendsMode && match.subjectPlayerId) {
      const subject = this.room.state.players.get(match.subjectPlayerId);
      if (subject) {
        subject.hasVotedBluff = true;
      }
    }

    // Anonim seçenekleri üret ve karıştır
    const choices = this.votingManager.setupChoices(
      curQ.correctAnswer,
      this.answerManager.getAllAnswers(),
      curQ.defaultFakes
    );

    match.choices.clear();
    for (const c of choices) {
      const entity = new BluffChoiceEntity();
      entity.id = c.id;
      entity.text = c.text;
      match.choices.set(c.id, entity);
    }

    console.log(`[BluffTriviaGame] Oylama başladı! (${choices.length} seçenek karıştırıldı)`);

    this.countdownInterval = setInterval(() => {
      match.timeLeft--;
      if (match.timeLeft <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.startRevealPhase();
      }
    }, 1000);
  }

  public handlePlayerVote(client: Client, choiceId: string) {
    const match = this.room.state.bluffTriviaMatch;
    if (!match || match.phase !== 'voting') return;

    const player = this.room.state.players.get(client.sessionId);
    if (!player || player.hasVotedBluff) return;

    const res = this.votingManager.vote(client.sessionId, player.nickname, choiceId);

    if (res.success) {
      player.hasVotedBluff = true;
      player.votedBluffId = choiceId;
      match.votedCount = this.votingManager.getVoteCount();
      console.log(`[BluffTriviaGame] ${player.nickname} oy kullandı: ${choiceId}`);

      // Eğer herkes oy kullandıysa hemen sonuca geç
      if (this.checkAllVoted()) {
        this.startRevealPhase();
      }
    }
  }

  private checkAllVoted(): boolean {
    let all = true;
    this.room.state.players.forEach((p) => {
      if (p.isConnected && !p.hasVotedBluff) {
        all = false;
      }
    });
    return all;
  }

  // ─── 3. SONUÇ VE İFŞA EVRESİ (REVEAL) ───
  private startRevealPhase() {
    this.clearTimers();

    const curQ = this.questionManager.getCurrentQuestion();
    if (!curQ) return;

    const match = this.room.state.bluffTriviaMatch!;
    match.phase = 'reveal';
    match.timeLeft = this.settings.revealDurationSeconds;

    const results = this.scoreManager.calculateRoundResults(
      match.round,
      curQ.correctAnswer,
      this.votingManager.getChoices(),
      this.votingManager.getVotes()
    );

    // Populate reveals
    match.reveals.clear();
    for (const r of results.reveals) {
      const entity = new BluffRevealEntity();
      entity.id = r.id;
      entity.text = r.text;
      entity.isCorrect = r.isCorrect;
      entity.authorName = r.authorName;
      entity.authorSessionId = r.authorSessionId;
      entity.votes = r.votes;
      entity.votersList = r.voters.join(', ');
      match.reveals.set(r.id, entity);
    }

    match.bluffMasterName = results.bluffMasterName;
    match.bluffMasterCount = results.bluffMasterCount;

    // Skorları uygula
    for (const [sid, gain] of results.playerScores.entries()) {
      const p = this.room.state.players.get(sid);
      if (p) {
        p.score += gain.totalRound;
        p.roundBluffGains = gain.totalRound;
        p.trickedCount = Math.round(gain.trickGained / 150);
      }
    }

    // Özel Arkadaş Modu: Konu olan oyuncuya onu doğru bilen her arkadaşı için bonus puan (+100)
    if (match.isFriendsMode && match.subjectPlayerId) {
      const realChoice = results.reveals.find((r) => r.isCorrect);
      if (realChoice && realChoice.votes > 0) {
        const subject = this.room.state.players.get(match.subjectPlayerId);
        if (subject) {
          const friendBonus = realChoice.votes * 100;
          subject.score += friendBonus;
          subject.roundBluffGains = (subject.roundBluffGains || 0) + friendBonus;
          console.log(`[BluffTriviaGame] 🌟 ${subject.nickname} arkadaşlarının doğru tahmini sayesinde +${friendBonus} bonus kazandı!`);
        }
      }
    }

    console.log(
      `[BluffTriviaGame] Sonuçlar açıklandı! Doğru Cevap: "${curQ.correctAnswer}". Bluff Master: ${results.bluffMasterName || 'Yok'}`
    );

    this.stepTimer = setTimeout(() => {
      this.startRoundResultPhase();
    }, this.settings.revealDurationSeconds * 1000);
  }

  // ─── 4. ROUND SKOR TABLOSU ───
  private startRoundResultPhase() {
    this.clearTimers();

    const match = this.room.state.bluffTriviaMatch!;
    match.phase = 'round_result';
    match.timeLeft = 5;

    console.log(`[BluffTriviaGame] Round ${match.round} bitti. Skorlar gösteriliyor.`);

    this.stepTimer = setTimeout(() => {
      if (this.room.state.currentRound < this.room.state.totalRounds) {
        this.room.state.currentRound++;
        this.startQuestionPhase();
      } else {
        this.endGame();
      }
    }, 5000);
  }

  // ─── 5. OYUN SONU (PODYUM) ───
  private endGame() {
    this.clearTimers();
    this.room.state.status = 'game_over';

    let topScore = -1;
    let winner = 'Kimse';
    this.room.state.players.forEach((p: PlayerStateType) => {
      if (p.score > topScore) {
        topScore = p.score;
        winner = p.nickname;
      }
    });

    this.room.state.winnerNickname = winner;
    console.log(`[BluffTriviaGame] Oyun Bitti! Şampiyon: ${winner} (${topScore} puan)`);
  }

  public stop() {
    this.clearTimers();
  }

  private clearTimers() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = undefined;
    }
  }
}
