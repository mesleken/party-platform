import { Room, Client } from '@colyseus/core';
import {
  SessionState,
  SessionStateType,
  PlayerState,
  PlayerStateType,
  QUIZ_QUESTIONS,
  QuizQuestion,
  filterAndShuffleQuestions
} from '@platform/sdk-core';
import { MiniFootballGame } from '@games/mini-football';
import { BluffTriviaGame } from '@games/bluff-trivia';
import { MiniTetrisGame, type TetrisInput, type TetrisMatchSnapshot } from '@games/mini-tetris';
import { LostAndFoundGame, type PlayerInput as LostAndFoundInput, type LostAndFoundSnapshot } from '@games/lost-and-found';
import { RcRushGame, type RcRushInput, type RcRushSnapshot } from '@games/rc-rush';
import {
  TransferShowdownGame,
  type BidAction,
  type TacticsSubmission,
  type ManagerTactics,
  type LiveTacticsAction,
  type ShoutAction
} from '@games/transfer-showdown';

export class LobbyRoom extends Room<{ state: SessionStateType }> {
  maxClients = 16; // 1 Ekran + 15 Telefon
  private gameTimeout?: NodeJS.Timeout;
  private countdownInterval?: NodeJS.Timeout;
  private quizInterval?: NodeJS.Timeout;

  private currentQuizQuestion?: QuizQuestion;
  private activeQuizQuestions: QuizQuestion[] = [];
  private questionStartTime = 0;

  private footballGame?: MiniFootballGame;
  private bluffTriviaGame?: BluffTriviaGame;
  private miniTetrisGame?: MiniTetrisGame;
  private lostAndFoundGame?: LostAndFoundGame;
  private rcRushGame?: RcRushGame;
  private transferShowdownGame?: TransferShowdownGame;

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
    this.state.isPaused = false;
    this.state.pauseReason = '';
    this.state.stageSettings = '';

    // Quiz alanları
    this.state.quizQuestion = '';
    this.state.quizCategory = '';
    this.state.quizOptionA = '';
    this.state.quizOptionB = '';
    this.state.quizOptionC = '';
    this.state.quizOptionD = '';
    this.state.quizCorrectIndex = -1;
    this.state.quizTimeLeft = 0;

    // Oyun Entegrasyonları
    this.footballGame = new MiniFootballGame(this);
    this.bluffTriviaGame = new BluffTriviaGame(this);

    console.log(`[LobbyRoom] Oda oluşturuldu. Kod: ${this.roomId}`);

    // Hazır durumunu değiştirme
    this.onMessage('READY', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !player.isReady;
        console.log(`[LobbyRoom] Oyuncu ${player.nickname} hazır durumu: ${player.isReady}`);
      }
    });

    // Lobide veya Duraklatma / Staging anında oyun seçme (Host veya Ekran)
    this.onMessage('SELECT_GAME', (client, message: { gameId: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için oyun seçemez.`);
        return;
      }
      if (
        message &&
        (message.gameId === 'reaction-rush' ||
          message.gameId === 'quiz-arena' ||
          message.gameId === 'mini-football' ||
          message.gameId === 'bluff-trivia' ||
          message.gameId === 'mini-tetris' ||
          message.gameId === 'lost-and-found' ||
          message.gameId === 'rc-rush' ||
          message.gameId === 'transfer-showdown')
      ) {
        this.state.selectedGameId = message.gameId;
        console.log(`[LobbyRoom] Seçili oyun güncellendi: ${this.state.selectedGameId}`);

        // Eğer oyun duraklatılmışken (pause) veya staging evresindeyken oyun değiştiriliyorsa:
        if (this.state.isPaused || this.state.status === 'game_staging') {
          this.switchGameFromPause(message.gameId);
        }
      }
    });

    // Lobiden Oyun İçi Özel Arayüze / Staging'e Geçiş (Host veya Ekran)
    this.onMessage('START_GAME', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için oyun başlatamaz.`);
        return;
      }

      this.enterGameStaging(this.state.selectedGameId);
    });

    // Oyun İçi Özel Arayüzden (Staging) Fiilen Maçı Başlatma (Host veya Ekran)
    this.onMessage('LAUNCH_MATCH', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için maçı başlatamaz.`);
        return;
      }

      this.launchCurrentMatch();
    });

    // Oyuncu Renk & Kostüm Özelleştirmesi (Her oyuncu kendi görünümünü seçebilir)
    this.onMessage('CUSTOMIZE_PLAYER', (client, message: { color?: string; costume?: string; avatar?: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        if (message.color) player.color = message.color;
        if (message.costume) player.costume = message.costume;
        if (message.avatar) player.avatar = message.avatar;
        console.log(`[LobbyRoom] Oyuncu ${player.nickname} özelleştirildi: Renk=${player.color}, Kostüm=${player.costume}, Avatar=${player.avatar}`);
      }
    });

    // Oyun Ayarlarını Güncelleme (Sadece Host veya Ekran)
    this.onMessage('UPDATE_GAME_SETTINGS', (client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) return;
      this.state.stageSettings = JSON.stringify(message.settings || message);
    });

    // Oyunu Duraklatma (Pause) - Sadece Oda Yöneticisi
    this.onMessage('PAUSE_GAME', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için oyunu duraklatamaz.`);
        return;
      }
      this.pauseGame();
    });

    // Oyunu Devam Ettirme (Resume) - Sadece Oda Yöneticisi
    this.onMessage('RESUME_GAME', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için oyunu devam ettiremez.`);
        return;
      }
      this.resumeGame();
    });

    // Reaction Rush: Butona basma
    this.onMessage('PRESS', (client) => {
      if (this.state.isPaused) return;
      this.handleReactionPress(client.sessionId);
    });

    // Quiz Arena: Şık seçme
    this.onMessage('ANSWER_QUIZ', (client, message: { optionIndex: number }) => {
      if (this.state.isPaused) return;
      this.handleQuizAnswer(client.sessionId, message.optionIndex);
    });

    // Mini Football Kontrolleri
    this.onMessage('FOOTBALL_INPUT', (client, message: any) => {
      if (this.state.isPaused) return;
      this.footballGame?.handleInput(client, message);
    });

    this.onMessage('FOOTBALL_SWITCH', (client) => {
      if (this.state.isPaused) return;
      this.footballGame?.handleSwitch(client);
    });

    this.onMessage('FOOTBALL_CHOOSE_TEAM', (client, message: { team: 'blue' | 'red' }) => {
      this.footballGame?.handleChooseTeam(client, message.team);
    });

    // Bluff Trivia Kontrolleri
    this.onMessage('BLUFF_SETTINGS', (client, message: any) => {
      const player = this.state.players.get(client.sessionId);
      if (player?.isHost) {
        this.bluffTriviaGame?.applySettings(message);
      }
    });

    this.onMessage('SUBMIT_BLUFF', (client, message: { answer: string }) => {
      if (this.state.isPaused) return;
      this.bluffTriviaGame?.handlePlayerSubmitBluff(client, message?.answer);
    });

    this.onMessage('VOTE_BLUFF', (client, message: { choiceId: string }) => {
      if (this.state.isPaused) return;
      this.bluffTriviaGame?.handlePlayerVote(client, message?.choiceId);
    });

    // Mini Tetris Kontrolleri
    this.onMessage('INPUT', (client, message: any) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId === 'mini-tetris') {
        this.miniTetrisGame?.handleInput(client.sessionId, message);
      } else if (this.state.activeGameId === 'lost-and-found') {
        this.lostAndFoundGame?.handleInput(client.sessionId, message);
      }
    });

    this.onMessage('TETRIS_INPUT', (client, message: TetrisInput) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'mini-tetris') return;
      this.miniTetrisGame?.handleInput(client.sessionId, message);
    });

    // Lost & Found Kontrolleri
    this.onMessage('LOST_AND_FOUND_INPUT', (client, message: LostAndFoundInput) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'lost-and-found') return;
      this.lostAndFoundGame?.handleInput(client.sessionId, message);
    });

    // RC Rush Kontrolleri
    this.onMessage('RC_RUSH_INPUT', (client, message: RcRushInput) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'rc-rush') return;
      this.rcRushGame?.handleInput(client.sessionId, message);
    });

    // Transfer Showdown Kontrolleri (Açık Artırma, Taktik, Maç)
    this.onMessage('SHOWDOWN_BID', (client, message: BidAction) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handleBid(client.sessionId, message);
    });

    this.onMessage('SHOWDOWN_PICK_CARD', (client, message: { cardId: string }) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handlePickCard(client.sessionId, message.cardId);
    });

    this.onMessage('SHOWDOWN_TACTICS', (client, message: TacticsSubmission) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handleTacticsSubmission(client.sessionId, message);
    });

    this.onMessage('SHOWDOWN_HALFTIME', (client, message: Partial<ManagerTactics>) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handleHalftimeAdjustment(client.sessionId, message);
    });

    this.onMessage('SHOWDOWN_ALL_OUT_ATTACK', (client) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handleAllOutAttack(client.sessionId);
    });

    this.onMessage('SHOWDOWN_LIVE_TACTICS', (client, message: LiveTacticsAction) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handleLiveTactics(client.sessionId, message);
    });

    this.onMessage('SHOWDOWN_SHOUT', (client, message: ShoutAction) => {
      if (this.state.isPaused) return;
      if (this.state.activeGameId !== 'transfer-showdown') return;
      this.transferShowdownGame?.handleTouchlineShout(client.sessionId, message.shout);
    });

    // Lobiye geri dönme - Sadece Oda Yöneticisi veya Ekran
    this.onMessage('RETURN_TO_LOBBY', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isHost) {
        console.log(`[LobbyRoom] ${player.nickname} host olmadığı için lobiye dönemez.`);
        return;
      }
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
    this.state.winnerNickname = '';

    // Settings'ten kategori, soru sayısı ve süre ayarlarını al
    let settings: any = {};
    try {
      if (this.state.stageSettings) {
        settings = JSON.parse(this.state.stageSettings);
      }
    } catch (e) {}

    const selectedCategories: string[] = settings.selectedCategories || [];
    const questionCount: number = settings.questionCount || settings.totalRounds || 5;
    const customTimeLimit: number = settings.timeLimit || 15;

    // Soruları kategoriye göre filtrele ve rastgele karıştır
    this.activeQuizQuestions = filterAndShuffleQuestions(selectedCategories, questionCount);
    if (customTimeLimit) {
      this.activeQuizQuestions.forEach((q) => (q.timeLimit = customTimeLimit));
    }

    this.state.totalRounds = this.activeQuizQuestions.length;
    console.log(`[LobbyRoom] Quiz havuzu hazırlandı: ${this.activeQuizQuestions.length} soru (Kategoriler: ${selectedCategories.join(', ') || 'Tümü'})`);

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

    // Soruyu belirle (karıştırılmış soru listesi içinden round indeksine göre)
    const qIndex = this.state.currentRound - 1;
    this.currentQuizQuestion = this.activeQuizQuestions[qIndex] || this.activeQuizQuestions[0];
    if (!this.currentQuizQuestion) {
      this.endGame();
      return;
    }
    this.questionStartTime = Date.now();

    // Şemayı güncelle
    this.state.quizQuestion = this.currentQuizQuestion.question;
    this.state.quizCategory = this.currentQuizQuestion.categoryLabel || this.currentQuizQuestion.category;
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

    console.log(`[LobbyRoom] Quiz Round ${this.state.currentRound}: "${this.currentQuizQuestion.question}" (${this.state.quizCategory})`);

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
  // OYUN 3: MINI FOOTBALL (5v5 ARCADE FUTBOL)
  // ═══════════════════════════════════════════════════════════

  private startFootballGame() {
    console.log(`[LobbyRoom] Mini Football oyunu başlatılıyor!`);
    this.clearTimers();
    this.state.activeGameId = 'mini-football';
    this.state.status = 'football_playing';
    this.footballGame?.start();
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 4: BLUFF TRIVIA (BLÖF BİLGİ YARIŞMASI)
  // ═══════════════════════════════════════════════════════════

  private startBluffTriviaGame() {
    console.log(`[LobbyRoom] Bluff Trivia oyunu başlatılıyor!`);
    this.clearTimers();
    this.state.activeGameId = 'bluff-trivia';
    this.state.status = 'bluff_playing';
    this.bluffTriviaGame?.start();
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 5: MINI TETRIS (BATTLE ROYALE TETRIS)
  // ═══════════════════════════════════════════════════════════

  private startMiniTetrisGame() {
    console.log(`[LobbyRoom] Mini Tetris oyunu başlatılıyor!`);
    this.clearTimers();
    this.state.activeGameId = 'mini-tetris';
    this.state.status = 'tetris_playing';

    this.miniTetrisGame = new MiniTetrisGame({
      broadcast: (type, payload: any) => {
        this.broadcast(type, payload);

        // Oyun bittiğinde Colyseus state'ini podyum için senkronize et
        if (payload?.gameId === 'mini-tetris' && payload?.state?.phase === 'finished') {
          const snap: TetrisMatchSnapshot = payload.state;
          snap.players.forEach((p) => {
            const player = this.state.players.get(p.id);
            if (player) {
              player.score = p.score;
              player.rank = p.place;
            }
          });

          if (snap.winnerId) {
            const winner = this.state.players.get(snap.winnerId);
            this.state.winnerNickname = winner?.nickname || 'Bilinmeyen';
          }
        }
      },
      sendToPlayer: (sessionId, type, payload) => {
        const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
        client?.send(type, payload);
      },
    });

    this.state.players.forEach((player: PlayerStateType) => {
      if (player.isConnected) {
        player.score = 0;
        player.rank = 0;
        this.miniTetrisGame?.addPlayer(player.id, player.nickname);
      }
    });

    this.miniTetrisGame.start();
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 5: LOST & FOUND (CO-OP ADVENTURE PLATFORMER)
  // ═══════════════════════════════════════════════════════════

  private startLostAndFoundGame() {
    console.log(`[LobbyRoom] Lost & Found oyunu başlatılıyor!`);
    this.clearTimers();
    this.state.activeGameId = 'lost-and-found';
    this.state.status = 'lost_and_found_playing';
    this.state.winnerNickname = '';

    this.lostAndFoundGame = new LostAndFoundGame({
      broadcast: (type: string, payload: any) => {
        this.broadcast(type, payload);

        // Seviye tamamlandığında podyum için state senkronizasyonu
        if (payload?.gameId === 'lost-and-found' && payload?.state?.phase === 'completed') {
          const snap: LostAndFoundSnapshot = payload.state;
          snap.players.forEach((p) => {
            const player = this.state.players.get(p.id);
            if (player) {
              player.score = p.score;
            }
          });
          this.state.winnerNickname = 'Milo & Nia (Ekip)';
          setTimeout(() => {
            if (this.state.activeGameId === 'lost-and-found') {
              this.endGame();
            }
          }, 3500);
        }
      },
      sendToPlayer: (sessionId: string, type: string, payload: any) => {
        const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
        client?.send(type, payload);
      },
    });

    this.state.players.forEach((player: PlayerStateType) => {
      if (player.isConnected) {
        player.score = 0;
        player.rank = 0;
        this.lostAndFoundGame?.addPlayer(player.id, player.nickname);
      }
    });

    this.lostAndFoundGame.start();
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 7: RC RUSH (3D ARCADE TOY RACING)
  // ═══════════════════════════════════════════════════════════

  private startRcRushGame() {
    console.log(`[LobbyRoom] RC Rush oyunu başlatılıyor!`);
    this.clearTimers();
    this.state.activeGameId = 'rc-rush';
    this.state.status = 'rc_rush_playing';
    this.state.winnerNickname = '';

    this.rcRushGame = new RcRushGame({
      broadcast: (type: string, payload: any) => {
        this.broadcast(type, payload);

        // Yarış tamamlandığında podyum için state senkronizasyonu
        if (payload?.gameId === 'rc-rush' && payload?.state?.phase === 'completed') {
          const snap: RcRushSnapshot = payload.state;
          snap.cars.forEach((car) => {
            const player = this.state.players.get(car.id);
            if (player) {
              // 1. = 1000, 2. = 750, 3. = 500, vb.
              player.score = Math.max(100, 1000 - (car.position - 1) * 200);
              player.rank = car.position;
            }
          });

          this.state.winnerNickname = snap.winnerNickname || 'Lider';
          setTimeout(() => {
            if (this.state.activeGameId === 'rc-rush') {
              this.endGame();
            }
          }, 5000);
        }
      },
      sendToPlayer: (sessionId: string, type: string, payload: any) => {
        const client = this.clients.find((candidate) => candidate.sessionId === sessionId);
        client?.send(type, payload);
      },
    });

    this.state.players.forEach((player: PlayerStateType) => {
      if (player.isConnected) {
        player.score = 0;
        player.rank = 0;
        this.rcRushGame?.addPlayer(player.id, player.nickname, player.color);
      }
    });

    this.rcRushGame.start();
  }

  // ═══════════════════════════════════════════════════════════
  // OYUN 8: TRANSFER SHOWDOWN (AÇIK ARTIRMA MENAJERLİK & MAÇ)
  // ═══════════════════════════════════════════════════════════

  private startTransferShowdownGame() {
    console.log(`[LobbyRoom] Transfer Showdown oyunu başlatılıyor!`);
    this.clearTimers();
    this.state.activeGameId = 'transfer-showdown';
    this.state.status = 'showdown_playing';
    this.state.winnerNickname = '';

    this.transferShowdownGame = new TransferShowdownGame(this);
    this.transferShowdownGame.init();
  }

  // ═══════════════════════════════════════════════════════════
  // ORTAK METOTLAR: OYUN STAGING, PAUSE, OYUN SONU VE LOBİ
  // ═══════════════════════════════════════════════════════════

  private stopAllActiveGames() {
    this.clearTimers();
    this.footballGame?.stop();
    this.bluffTriviaGame?.stop();
    this.miniTetrisGame?.stop();
    this.miniTetrisGame = undefined;
    this.lostAndFoundGame?.stop();
    this.lostAndFoundGame = undefined;
    this.rcRushGame?.stop();
    this.rcRushGame = undefined;
    this.transferShowdownGame?.destroy();
    this.transferShowdownGame = undefined;
  }

  private enterGameStaging(gameId: string) {
    console.log(`[LobbyRoom] Oyun staging (hazırlık) moduna geçiliyor: ${gameId}`);
    this.stopAllActiveGames();
    this.state.status = 'game_staging';
    this.state.selectedGameId = gameId;
    this.state.activeGameId = gameId;
    this.state.isPaused = false;
    this.state.pauseReason = '';

    const defaultSettings: Record<string, any> = {
      'reaction-rush': { totalRounds: 3, difficulty: 'normal' },
      'quiz-arena': {
        questionCount: 5,
        timeLimit: 15,
        selectedCategories: ['bilim', 'tarih', 'cografya', 'sinema', 'oyun', 'spor', 'genel']
      },
      'mini-football': { matchDuration: 90, ballSpeed: 'normal' },
      'bluff-trivia': { totalRounds: 3, bluffTime: 25 },
      'mini-tetris': { speed: 'normal', mode: 'battle' },
      'lost-and-found': { roundTime: 45, totalRounds: 3 },
      'rc-rush': { totalLaps: 3, speedClass: 'fast', powerUps: true },
      'transfer-showdown': { budget: 100, squadSize: 11, matchLength: 'fast' }
    };

    this.state.stageSettings = JSON.stringify(defaultSettings[gameId] || {});

    this.state.players.forEach((p: PlayerStateType) => {
      p.isReady = false;
      p.score = 0;
      p.rank = 0;
    });
  }

  private launchCurrentMatch() {
    const gameId = this.state.selectedGameId || this.state.activeGameId || 'reaction-rush';
    console.log(`[LobbyRoom] Maç fiilen başlatılıyor: ${gameId}`);
    this.state.isPaused = false;
    this.state.pauseReason = '';

    let settings: any = {};
    try {
      if (this.state.stageSettings) {
        settings = JSON.parse(this.state.stageSettings);
      }
    } catch (e) {
      settings = {};
    }

    switch (gameId) {
      case 'reaction-rush':
        if (settings.totalRounds) this.state.totalRounds = settings.totalRounds;
        this.startReactionRushGame();
        break;
      case 'quiz-arena':
        if (settings.questionCount) this.state.totalRounds = settings.questionCount;
        this.startQuizGame();
        break;
      case 'mini-football':
        this.startFootballGame();
        break;
      case 'bluff-trivia':
        this.startBluffTriviaGame();
        break;
      case 'mini-tetris':
        this.startMiniTetrisGame();
        break;
      case 'lost-and-found':
        this.startLostAndFoundGame();
        break;
      case 'rc-rush':
        this.startRcRushGame();
        break;
      case 'transfer-showdown':
        this.startTransferShowdownGame();
        break;
      default:
        this.startReactionRushGame();
        break;
    }
  }

  private pauseGame() {
    if (this.state.status === 'lobby' || this.state.status === 'game_over') return;
    this.state.isPaused = true;
    this.state.pauseReason = 'Oda yöneticisi oyunu duraklattı.';
    console.log(`[LobbyRoom] Oyun duraklatıldı (Host).`);
  }

  private resumeGame() {
    this.state.isPaused = false;
    this.state.pauseReason = '';
    console.log(`[LobbyRoom] Oyun devam ettirildi (Host).`);
  }

  private switchGameFromPause(newGameId: string) {
    console.log(`[LobbyRoom] Duraklatma / Staging esnasında oyun değiştirildi: ${newGameId}`);
    this.state.stageSettings = '';
    this.enterGameStaging(newGameId);
  }

  private endGame() {
    this.clearTimers();
    this.footballGame?.stop();
    this.bluffTriviaGame?.stop();
    this.miniTetrisGame?.stop();
    this.lostAndFoundGame?.stop();
    this.rcRushGame?.stop();
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
    this.stopAllActiveGames();
    this.state.isPaused = false;
    this.state.pauseReason = '';
    this.state.stageSettings = '';
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
      p.controlledPlayerId = '';
      p.bluffAnswer = '';
      p.bluffSubmitted = false;
      p.hasVotedBluff = false;
      p.votedBluffId = '';
      p.roundBluffGains = 0;
      p.trickedCount = 0;
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

    const role = options.role || (options.isScreen ? 'screen' : 'controller');

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
      player.team = '';
      player.controlledPlayerId = '';

      const defaultColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
      const defaultCostumes = ['standard', 'retro_racer', 'cyber_neon', 'stealth_shadow', 'golden_legend', 'toxic_surge'];
      const playerIndex = this.state.players.size;
      player.color = options.color || defaultColors[playerIndex % defaultColors.length];
      player.costume = options.costume || defaultCostumes[playerIndex % defaultCostumes.length];

      let hostExists = false;
      this.state.players.forEach((p: PlayerStateType) => {
        if (p.isHost && p.isConnected) hostExists = true;
      });

      if (!hostExists) {
        player.isHost = true;
      }

      this.state.players.set(client.sessionId, player);
    }
  }

  async onLeave(client: Client, code?: number) {
    this.footballGame?.handlePlayerLeave(client);
    this.miniTetrisGame?.removePlayer(client.sessionId);
    this.lostAndFoundGame?.removePlayer(client.sessionId);
    this.rcRushGame?.removePlayer(client.sessionId);
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
        const wasHost = player.isHost;
        this.state.players.delete(client.sessionId);
        console.log(`[LobbyRoom] Oyuncu odadan ayrıldı: ${player?.nickname}`);

        if (wasHost) {
          for (const remaining of this.state.players.values()) {
            if (remaining.isConnected) {
              remaining.isHost = true;
              console.log(`[LobbyRoom] Yeni Host atandı: ${remaining.nickname}`);
              break;
            }
          }
        }
      }
    }
  }

  onDispose() {
    this.clearTimers();
    this.footballGame?.stop();
    this.bluffTriviaGame?.stop();
    this.miniTetrisGame?.stop();
    this.miniTetrisGame = undefined;
    this.lostAndFoundGame?.stop();
    this.lostAndFoundGame = undefined;
    this.rcRushGame?.stop();
    this.rcRushGame = undefined;
    this.transferShowdownGame?.destroy();
    this.transferShowdownGame = undefined;
    console.log(`[LobbyRoom] Oda kapatıldı: ${this.roomId}`);
  }
}
