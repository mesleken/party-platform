import { Room, Client } from '@colyseus/core';
import {
  SessionState,
  SessionStateType,
  PlayerState,
  PlayerStateType,
  QUIZ_QUESTIONS,
  QuizQuestion
} from '@platform/sdk-core';

export class LobbyRoom extends Room<{ state: SessionStateType }> {
  maxClients = 16; // 1 Ekran + 15 Telefon
  private gameTimeout?: NodeJS.Timeout;
  private countdownInterval?: NodeJS.Timeout;
  private quizInterval?: NodeJS.Timeout;

  private currentQuizQuestion?: QuizQuestion;
  private questionStartTime = 0;

  onCreate(options: any) {
    this.setState(new SessionState());

    // Karışması zor karakterlerden 6 haneli oda kodu üret
    const chars = '2346789ABCDEFGHJKMNPQRTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    this.roomId = code;
    this.state.roomCode = code;
    this.state.status = 'lobby';
    this.state.activeGameId = '';
    this.state.selectedGameId = 'reaction-rush'; // Varsayılan oyun
    this.state.currentRound = 0;
    this.state.totalRounds = 3;
    this.state.countdown = 0;
    this.state.greenTimestamp = 0;
    this.state.winnerNickname = '';

    // Quiz alanları
    this.state.quizQuestion = '';
    this.state.quizCategory = '';
    this.state.quizOptionA = '';
    this.state.quizOptionB = '';
    this.state.quizOptionC = '';
    this.state.quizOptionD = '';
    this.state.quizCorrectIndex = -1;
    this.state.quizTimeLeft = 0;

    console.log(`[LobbyRoom] Oda oluşturuldu. Kod: ${this.roomId}`);

    // Hazır durumunu değiştirme
    this.onMessage('READY', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !player.isReady;
        console.log(`[LobbyRoom] Oyuncu ${player.nickname} hazır durumu: ${player.isReady}`);
      }
    });

    // Lobide oyun seçme
    this.onMessage('SELECT_GAME', (client, message: { gameId: string }) => {
      if (message && (message.gameId === 'reaction-rush' || message.gameId === 'quiz-arena')) {
        this.state.selectedGameId = message.gameId;
        console.log(`[LobbyRoom] Seçili oyun güncellendi: ${this.state.selectedGameId}`);
      }
    });

    // Oyunu başlatma (Host veya Ekran)
    this.onMessage('START_GAME', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için oyun başlatamaz.`);
        return;
      }

      if (this.state.selectedGameId === 'quiz-arena') {
        this.startQuizGame();
      } else {
        this.startReactionRushGame();
      }
    });

    // Reaction Rush: Butona basma
    this.onMessage('PRESS', (client) => {
      this.handleReactionPress(client.sessionId);
    });

    // Quiz Arena: Şık seçme
    this.onMessage('ANSWER_QUIZ', (client, message: { optionIndex: number }) => {
      this.handleQuizAnswer(client.sessionId, message.optionIndex);
    });

    // Lobiye geri dönme
    this.onMessage('RETURN_TO_LOBBY', () => {
      this.resetToLobby();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 1: REACTION RUSH (REFLEKS YARIŞI)
  // ═══════════════════════════════════════════════════════════

  private startReactionRushGame() {
    console.log(`[LobbyRoom] Reaction Rush oyunu başlatılıyor!`);
    this.state.activeGameId = 'reaction-rush';
    this.state.currentRound = 1;
    this.state.totalRounds = 3;
    this.state.winnerNickname = '';

    // Skorları sıfırla
    this.state.players.forEach((p: PlayerStateType) => {
      p.score = 0;
      p.rank = 0;
      p.hasPressed = false;
      p.lastReactionTime = 0;
    });

    this.startReactionCountdown();
  }

  private startReactionCountdown() {
    this.clearTimers();
    this.state.status = 'countdown';
    this.state.countdown = 3;

    this.state.players.forEach((p: PlayerStateType) => {
      p.hasPressed = false;
      p.lastReactionTime = 0;
    });

    this.countdownInterval = setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.startRedPhase();
      }
    }, 1000);
  }

  private startRedPhase() {
    this.clearTimers();
    this.state.status = 'red';
    console.log(`[LobbyRoom] Reaction Rush Round ${this.state.currentRound} - Kırmızı Faz`);

    const randomDelay = Math.floor(Math.random() * 3000) + 2000;

    this.gameTimeout = setTimeout(() => {
      this.startGreenPhase();
    }, randomDelay);
  }

  private startGreenPhase() {
    this.clearTimers();
    this.state.status = 'green';
    this.state.greenTimestamp = Date.now();
    console.log(`[LobbyRoom] Reaction Rush Round ${this.state.currentRound} - YEŞİL!`);

    this.gameTimeout = setTimeout(() => {
      this.endReactionRound();
    }, 3500);
  }

  private handleReactionPress(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    if (player.hasPressed) return;

    if (this.state.status === 'red') {
      player.hasPressed = true;
      player.lastReactionTime = -1; // Faul
      player.score = Math.max(0, player.score - 40);
      console.log(`[LobbyRoom] ${player.nickname} erken bastı (FAUL)! -40 puan`);
    } else if (this.state.status === 'green') {
      const reactionMs = Date.now() - this.state.greenTimestamp;
      player.hasPressed = true;
      player.lastReactionTime = reactionMs;

      let successfulPressCount = 0;
      this.state.players.forEach((p: PlayerStateType) => {
        if (p.lastReactionTime > 0) successfulPressCount++;
      });

      player.rank = successfulPressCount;

      let points = 30;
      if (player.rank === 1) points = 100;
      else if (player.rank === 2) points = 70;
      else if (player.rank === 3) points = 50;

      player.score += points;
      console.log(`[LobbyRoom] ${player.nickname} bastı: ${reactionMs}ms (Sıra: ${player.rank}, +${points} puan)`);
    }

    let allPressed = true;
    this.state.players.forEach((p: PlayerStateType) => {
      if (p.isConnected && !p.hasPressed) {
        allPressed = false;
      }
    });

    if (allPressed) {
      this.endReactionRound();
    }
  }

  private endReactionRound() {
    this.clearTimers();
    this.state.status = 'round_result';

    this.gameTimeout = setTimeout(() => {
      if (this.state.currentRound < this.state.totalRounds) {
        this.state.currentRound++;
        this.startReactionCountdown();
      } else {
        this.endGame();
      }
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 2: QUIZ ARENA (TRIVIA / BİLGİ SAVAŞI)
  // ═══════════════════════════════════════════════════════════

  private startQuizGame() {
    console.log(`[LobbyRoom] Quiz Arena oyunu başlatılıyor!`);
    this.state.activeGameId = 'quiz-arena';
    this.state.currentRound = 1;
    this.state.totalRounds = 5; // 5 soruluk yarışma
    this.state.winnerNickname = '';

    // Skor ve streak'leri sıfırla
    this.state.players.forEach((p: PlayerStateType) => {
      p.score = 0;
      p.rank = 0;
      p.streak = 0;
      p.selectedOption = -1;
      p.isCorrect = false;
      p.hasPressed = false;
    });

    this.startQuizRound();
  }

  private startQuizRound() {
    this.clearTimers();
    this.state.status = 'quiz_question';

    // Soruyu belirle (liste içinden round indeksine göre)
    const qIndex = (this.state.currentRound - 1) % QUIZ_QUESTIONS.length;
    this.currentQuizQuestion = QUIZ_QUESTIONS[qIndex];
    this.questionStartTime = Date.now();

    // Şemayı güncelle
    this.state.quizQuestion = this.currentQuizQuestion.question;
    this.state.quizCategory = this.currentQuizQuestion.category;
    this.state.quizOptionA = this.currentQuizQuestion.options[0];
    this.state.quizOptionB = this.currentQuizQuestion.options[1];
    this.state.quizOptionC = this.currentQuizQuestion.options[2];
    this.state.quizOptionD = this.currentQuizQuestion.options[3];
    this.state.quizCorrectIndex = -1; // Cevap henüz gizli!
    this.state.quizTimeLeft = this.currentQuizQuestion.timeLimit;

    // Oyuncuları bu soru için sıfırla
    this.state.players.forEach((p: PlayerStateType) => {
      p.selectedOption = -1;
      p.isCorrect = false;
      p.hasPressed = false;
    });

    console.log(`[LobbyRoom] Quiz Round ${this.state.currentRound}: "${this.currentQuizQuestion.question}"`);

    // Saniye sayacı
    this.quizInterval = setInterval(() => {
      this.state.quizTimeLeft--;
      if (this.state.quizTimeLeft <= 0) {
        if (this.quizInterval) clearInterval(this.quizInterval);
        this.endQuizRound();
      }
    }, 1000);
  }

  private handleQuizAnswer(sessionId: string, optionIndex: number) {
    if (this.state.status !== 'quiz_question') return;

    const player = this.state.players.get(sessionId);
    if (!player || player.hasPressed) return;

    player.selectedOption = optionIndex;
    player.hasPressed = true;
    console.log(`[LobbyRoom] ${player.nickname} şık seçti: ${optionIndex}`);

    // Herkes cevapladı mı kontrol et
    let allAnswered = true;
    this.state.players.forEach((p: PlayerStateType) => {
      if (p.isConnected && !p.hasPressed) {
        allAnswered = false;
      }
    });

    if (allAnswered) {
      this.endQuizRound();
    }
  }

  private endQuizRound() {
    this.clearTimers();
    if (!this.currentQuizQuestion) return;

    const correctIdx = this.currentQuizQuestion.correctIndex;
    this.state.quizCorrectIndex = correctIdx; // Doğru cevabı ifşa et!
    this.state.status = 'quiz_result';

    const duration = Math.max(1, (Date.now() - this.questionStartTime) / 1000);

    // Skorları hesapla
    this.state.players.forEach((p: PlayerStateType) => {
      if (p.selectedOption === correctIdx) {
        p.isCorrect = true;
        p.streak++;

        // Hız bonusu: 15 saniyeden kalan süreye göre 500 taban + 500 hız bonusu
        const speedBonus = Math.max(50, Math.round(500 * (Math.max(0, 15 - duration) / 15)));
        const streakBonus = Math.min(200, (p.streak - 1) * 50);
        const earned = 500 + speedBonus + streakBonus;

        p.score += earned;
        console.log(`[LobbyRoom] ${p.nickname} DOĞRU BİLDİ! +${earned} puan (Streak: ${p.streak})`);
      } else {
        p.isCorrect = false;
        p.streak = 0;
        console.log(`[LobbyRoom] ${p.nickname} YANLIŞ CEVAP verdi.`);
      }
    });

    // 4.5 saniye sonuçları gösterip sonraki soruya geç
    this.gameTimeout = setTimeout(() => {
      if (this.state.currentRound < this.state.totalRounds) {
        this.state.currentRound++;
        this.startQuizRound();
      } else {
        this.endGame();
      }
    }, 4500);
  }

  // ═══════════════════════════════════════════════════════════
  // ORTAK METOTLAR: OYUN SONU VE LOBİ
  // ═══════════════════════════════════════════════════════════

  private endGame() {
    this.clearTimers();
    this.state.status = 'game_over';

    let topScore = -1;
    let winner = 'Kimse';
    this.state.players.forEach((p: PlayerStateType) => {
      if (p.score > topScore) {
        topScore = p.score;
        winner = p.nickname;
      }
    });

    this.state.winnerNickname = winner;
    console.log(`[LobbyRoom] Oyun Bitti! Şampiyon: ${winner} (${topScore} puan)`);
  }

  private resetToLobby() {
    this.clearTimers();
    this.state.status = 'lobby';
    this.state.activeGameId = '';
    this.state.currentRound = 0;
    this.state.winnerNickname = '';

    this.state.players.forEach((p: PlayerStateType) => {
      p.isReady = false;
      p.hasPressed = false;
      p.lastReactionTime = 0;
      p.score = 0;
      p.rank = 0;
      p.selectedOption = -1;
      p.isCorrect = false;
      p.streak = 0;
    });

    console.log(`[LobbyRoom] Lobiye dönüldü.`);
  }

  private clearTimers() {
    if (this.gameTimeout) {
      clearTimeout(this.gameTimeout);
      this.gameTimeout = undefined;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
    if (this.quizInterval) {
      clearInterval(this.quizInterval);
      this.quizInterval = undefined;
    }
  }

  onJoin(client: Client, options: any) {
    console.log(`[LobbyRoom] İstemci bağlandı: ${client.sessionId}`);

    const role = options.role || 'controller';

    if (role === 'controller') {
      const player = new PlayerState();
      player.id = client.sessionId;
      player.nickname = options.nickname || 'Misafir';
      player.avatar = options.avatar || 'default';
      player.isConnected = true;
      player.isReady = false;
      player.score = 0;
      player.lastReactionTime = 0;
      player.hasPressed = false;
      player.rank = 0;
      player.selectedOption = -1;
      player.isCorrect = false;
      player.streak = 0;

      let hostExists = false;
      this.state.players.forEach((p: PlayerStateType) => {
        if (p.isHost) hostExists = true;
      });

      if (!hostExists) {
        player.isHost = true;
      }

      this.state.players.set(client.sessionId, player);
    }
  }

  async onLeave(client: Client, code?: number) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isConnected = false;
      console.log(`[LobbyRoom] Oyuncu düştü: ${player.nickname}`);

      try {
        if (code === 1000) {
          throw new Error('consented leave');
        }

        await this.allowReconnection(client, 60);
        player.isConnected = true;
        console.log(`[LobbyRoom] Oyuncu geri geldi: ${player.nickname}`);
      } catch (e) {
        this.state.players.delete(client.sessionId);
        console.log(`[LobbyRoom] Oyuncu odadan ayrıldı: ${player?.nickname}`);
      }
    }
  }

  onDispose() {
    this.clearTimers();
    console.log(`[LobbyRoom] Oda kapatıldı: ${this.roomId}`);
  }
}
