import { ScreenSDK } from '@platform/sdk-screen';
import QRCode from 'qrcode';

async function bootstrap() {
  const statusView = document.getElementById('status-view')!;
  const lobbyView = document.getElementById('lobby-view')!;
  const gameView = document.getElementById('game-view')!;
  const quizView = document.getElementById('quiz-view')!;
  const resultView = document.getElementById('result-view')!;
  const gameoverView = document.getElementById('gameover-view')!;

  const displayRoomCode = document.getElementById('display-room-code')!;
  const gameRoomCode = document.getElementById('game-room-code')!;
  const qrCanvas = document.getElementById('qr-code') as HTMLCanvasElement;
  const playersList = document.getElementById('players-list')!;
  const playerCount = document.getElementById('player-count')!;
  const startGameBtn = document.getElementById('start-game-btn')!;
  const returnLobbyBtn = document.getElementById('return-lobby-btn')!;

  // Game Selector Cards
  const cardReactionRush = document.getElementById('card-reaction-rush')!;
  const cardQuizArena = document.getElementById('card-quiz-arena')!;

  // Reaction Rush Elements
  const roundIndicator = document.getElementById('round-indicator')!;
  const stageHeadline = document.getElementById('stage-headline')!;
  const stageSubline = document.getElementById('stage-subline')!;
  const livePlayersContainer = document.getElementById('live-players-container')!;

  // Quiz Arena Elements
  const quizCategory = document.getElementById('quiz-category')!;
  const quizRoundText = document.getElementById('quiz-round-text')!;
  const quizTimer = document.getElementById('quiz-timer')!;
  const quizQuestion = document.getElementById('quiz-question')!;
  const screenOptTexts = [
    document.getElementById('screen-opt-text-0')!,
    document.getElementById('screen-opt-text-1')!,
    document.getElementById('screen-opt-text-2')!,
    document.getElementById('screen-opt-text-3')!
  ];
  const screenOptCards = [
    document.getElementById('screen-opt-0')!,
    document.getElementById('screen-opt-1')!,
    document.getElementById('screen-opt-2')!,
    document.getElementById('screen-opt-3')!
  ];
  const quizLivePlayers = document.getElementById('quiz-live-players')!;

  // Result & Game Over Elements
  const resultTitle = document.getElementById('result-title')!;
  const resultScoreList = document.getElementById('result-score-list')!;
  const finalScoreList = document.getElementById('final-score-list')!;
  const winnerName = document.getElementById('winner-name')!;

  try {
    const sdk = new ScreenSDK(`http://${window.location.hostname}:2567`);
    const roomCode = await sdk.createSession();

    statusView.style.display = 'none';
    lobbyView.style.display = 'flex';
    displayRoomCode.innerText = roomCode;
    gameRoomCode.innerText = `ODA: ${roomCode}`;

    // QR Kod Oluştur
    const joinUrl = `${window.location.protocol}//${window.location.hostname}:5174/join?code=${roomCode}`;
    await QRCode.toCanvas(qrCanvas, joinUrl, {
      width: 120,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    // Oyun Seçimi (Lobi)
    cardReactionRush.onclick = () => {
      sdk.selectGame('reaction-rush');
    };

    cardQuizArena.onclick = () => {
      sdk.selectGame('quiz-arena');
    };

    // Buton Eylemleri
    startGameBtn.onclick = () => {
      sdk.startGame();
    };

    returnLobbyBtn.onclick = () => {
      sdk.returnToLobby();
    };

    // Sunucu Durumunu Dinle
    sdk.onStateChange = (state) => {
      const status = state.status;
      const playersArray: any[] = [];
      state.players.forEach((p) => playersArray.push(p));

      // ─── 1. LOBİ DURUMU ───
      if (status === 'lobby') {
        lobbyView.style.display = 'flex';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';

        // Seçili oyunu güncelle
        const selected = state.selectedGameId || 'reaction-rush';
        if (selected === 'quiz-arena') {
          cardQuizArena.classList.add('selected');
          cardReactionRush.classList.remove('selected');
        } else {
          cardReactionRush.classList.add('selected');
          cardQuizArena.classList.remove('selected');
        }

        playersList.innerHTML = '';
        playersArray.forEach((p) => {
          const card = document.createElement('div');
          card.className = `player-card ${p.isReady ? 'ready' : ''}`;
          const hostBadge = p.isHost ? '👑 ' : '';
          const readyBadge = p.isReady
            ? '<span style="color:#22c55e;">HAZIR</span>'
            : '<span style="color:#94a3b8;">BEKLİYOR</span>';

          card.innerHTML = `
            <div>${hostBadge}${p.nickname}</div>
            <div>${readyBadge}</div>
          `;
          playersList.appendChild(card);
        });

        playerCount.innerText = playersArray.length.toString();
        return;
      }

      // ─── 2. REACTION RUSH OYUN EVRESİ ───
      if (status === 'countdown' || status === 'red' || status === 'green') {
        lobbyView.style.display = 'none';
        gameView.style.display = 'flex';
        quizView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';

        roundIndicator.innerText = `ROUND ${state.currentRound} / ${state.totalRounds}`;

        if (status === 'countdown') {
          gameView.style.backgroundColor = '#0f172a';
          stageHeadline.innerText = 'HAZIRLANIN!';
          stageHeadline.style.color = '#38bdf8';
          stageSubline.innerText = state.countdown > 0 ? state.countdown.toString() : 'BAŞLIYOR!';
        } else if (status === 'red') {
          gameView.style.backgroundColor = '#b91c1c';
          stageHeadline.innerText = 'DUR! SAKIN BASMA!';
          stageHeadline.style.color = '#ffffff';
          stageSubline.innerText = 'Yeşil yandığında en hızlı sen bas!';
        } else if (status === 'green') {
          gameView.style.backgroundColor = '#15803d';
          stageHeadline.innerText = 'ŞİMDİ BAS! ⚡';
          stageHeadline.style.color = '#ffffff';
          stageSubline.innerText = 'HIZLI OLAN KAZANIR!';
        }

        livePlayersContainer.innerHTML = '';
        playersArray.forEach((p) => {
          const badge = document.createElement('div');
          let text = p.nickname;
          let badgeClass = 'live-player-badge';

          if (p.hasPressed) {
            if (p.lastReactionTime === -1) {
              badgeClass += ' foul';
              text += ' ❌ FAUL!';
            } else {
              badgeClass += ' pressed';
              text += ` ⚡ ${p.lastReactionTime}ms (#${p.rank})`;
            }
          } else {
            text += ' ⏳';
          }

          badge.className = badgeClass;
          badge.innerText = text;
          livePlayersContainer.appendChild(badge);
        });

        return;
      }

      // ─── 3. QUIZ ARENA: SORU & SONUÇ EVRESİ ───
      if (status === 'quiz_question' || status === 'quiz_result') {
        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'flex';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';

        quizCategory.innerText = (state.quizCategory || 'GENEL KÜLTÜR').toUpperCase();
        quizRoundText.innerText = `SORU ${state.currentRound} / ${state.totalRounds}`;
        quizQuestion.innerText = state.quizQuestion || 'Soru yükleniyor...';

        const timeLeft = state.quizTimeLeft || 0;
        quizTimer.innerText = timeLeft.toString();
        if (timeLeft <= 5 && status === 'quiz_question') {
          quizTimer.classList.add('danger');
        } else {
          quizTimer.classList.remove('danger');
        }

        const options = [
          state.quizOptionA,
          state.quizOptionB,
          state.quizOptionC,
          state.quizOptionD
        ];

        for (let i = 0; i < 4; i++) {
          screenOptTexts[i].innerText = options[i] || `Seçenek ${i + 1}`;
          screenOptCards[i].classList.remove('correct', 'dimmed');

          // Eğer cevap açıklandıysa vurgula
          if (status === 'quiz_result') {
            if (i === state.quizCorrectIndex) {
              screenOptCards[i].classList.add('correct');
            } else {
              screenOptCards[i].classList.add('dimmed');
            }
          }
        }

        // Canlı Oyuncu Cevap Durumları
        quizLivePlayers.innerHTML = '';
        playersArray.forEach((p) => {
          const badge = document.createElement('div');
          let text = p.nickname;
          let badgeClass = 'live-player-badge';

          if (status === 'quiz_result') {
            if (p.isCorrect) {
              badgeClass += ' pressed';
              text += ` ✓ DOĞRU (+${p.score} Puan)`;
            } else {
              badgeClass += ' foul';
              text += ' ❌ YANLIŞ';
            }
          } else {
            if (p.hasPressed) {
              badgeClass += ' pressed';
              text += ' ✓ Cevap Verdi';
            } else {
              text += ' ⏳ Düşünüyor...';
            }
          }

          badge.className = badgeClass;
          badge.innerText = text;
          quizLivePlayers.appendChild(badge);
        });

        return;
      }

      // ─── 4. REACTION RUSH ROUND SONUCU ───
      if (status === 'round_result') {
        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        resultView.style.display = 'flex';
        gameoverView.style.display = 'none';

        resultTitle.innerText = `ROUND ${state.currentRound} SKORLARI`;
        resultScoreList.innerHTML = '';
        const sorted = [...playersArray].sort((a, b) => b.score - a.score);

        sorted.forEach((p, index) => {
          const row = document.createElement('div');
          row.className = 'score-row';
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

          let lastInfo = '';
          if (p.lastReactionTime === -1) {
            lastInfo = '<span style="color:#ef4444; font-size:1.1rem;">(FAUL -40)</span>';
          } else if (p.lastReactionTime > 0) {
            lastInfo = `<span style="color:#22c55e; font-size:1.1rem;">(${p.lastReactionTime}ms)</span>`;
          }

          row.innerHTML = `
            <div>${medal} ${p.nickname} ${lastInfo}</div>
            <div style="color: #facc15;">${p.score} Puan</div>
          `;
          resultScoreList.appendChild(row);
        });

        return;
      }

      // ─── 5. OYUN BİTTİ (PODYUM) ───
      if (status === 'game_over') {
        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'flex';

        winnerName.innerText = state.winnerNickname || '---';

        finalScoreList.innerHTML = '';
        const sorted = [...playersArray].sort((a, b) => b.score - a.score);

        sorted.forEach((p, index) => {
          const row = document.createElement('div');
          row.className = 'score-row';
          const medal = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
          row.innerHTML = `
            <div>${medal} ${p.nickname}</div>
            <div style="color: #facc15;">${p.score} Puan</div>
          `;
          finalScoreList.appendChild(row);
        });

        return;
      }
    };
  } catch (err: any) {
    statusView.innerText = 'HATA: ' + (err.message || err.toString());
    statusView.style.color = '#ef4444';
    console.error('[ScreenSDK] Başlatma Hatası:', err);
  }
}

bootstrap();
