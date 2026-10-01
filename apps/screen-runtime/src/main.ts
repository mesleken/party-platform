import { ScreenSDK } from '@platform/sdk-screen';
import QRCode from 'qrcode';
import { FootballRenderer3D } from './FootballRenderer3D';
import { TetrisRenderer } from './TetrisRenderer';
import { LostAndFoundRenderer3D } from './LostAndFoundRenderer3D';

async function bootstrap() {
  const statusView = document.getElementById('status-view')!;
  const lobbyView = document.getElementById('lobby-view')!;
  const gameView = document.getElementById('game-view')!;
  const quizView = document.getElementById('quiz-view')!;
  const footballView = document.getElementById('football-view')!;
  const lostAndFoundView = document.getElementById('lost-and-found-view')!;
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
  const cardMiniFootball = document.getElementById('card-mini-football')!;
  const cardBluffTrivia = document.getElementById('card-bluff-trivia')!;
  const cardMiniTetris = document.getElementById('card-mini-tetris')!;
  const cardLostAndFound = document.getElementById('card-lost-and-found')!;

  // Lost & Found Elements
  const lostAndFoundCanvasContainer = document.getElementById('lost-and-found-canvas-container')!;
  const lafObjectiveText = document.getElementById('laf-objective-text')!;
  const lafPhaseBadge = document.getElementById('laf-phase-badge')!;
  const lafTimer = document.getElementById('laf-timer')!;
  const lafMinigameOverlay = document.getElementById('laf-minigame-overlay')!;
  const lafSyncBar = document.getElementById('laf-sync-bar')!;
  const lafSyncPercent = document.getElementById('laf-sync-percent')!;
  const lafMiloVal = document.getElementById('laf-milo-val')!;
  const lafNiaVal = document.getElementById('laf-nia-val')!;
  // New adventure UI elements
  const lafPlayerANickname = document.getElementById('laf-player-a-nickname');
  const lafPlayerBNickname = document.getElementById('laf-player-b-nickname');
  const lafPlayerAAbility = document.getElementById('laf-player-a-ability');
  const lafPlayerBAbility = document.getElementById('laf-player-b-ability');
  const lafPlayerACooldown = document.getElementById('laf-player-a-cooldown');
  const lafPlayerBCooldown = document.getElementById('laf-player-b-cooldown');
  const lafLevelComplete = document.getElementById('laf-level-complete');
  const lafCompleteTime = document.getElementById('laf-complete-time');
  const lafCompleteScore = document.getElementById('laf-complete-score');
  const lafGoalNotification = document.getElementById('laf-goal-notification');
  const lafGoalText = document.getElementById('laf-goal-text');
  const lafInteractPrompt = document.getElementById('laf-interact-prompt');
  void lafInteractPrompt; // Reserved for future interaction prompt logic
  const lafCheckpointDots = document.getElementById('laf-checkpoint-dots');
  let lostAndFoundRenderer: LostAndFoundRenderer3D | null = null;
  let lafPrevVaultOpen = false;

  // Mini Football Elements
  const footballCanvasContainer = document.getElementById('football-canvas-container')!;
  const footballBlueScore = document.getElementById('football-blue-score')!;
  const footballRedScore = document.getElementById('football-red-score')!;
  const footballTimer = document.getElementById('football-timer')!;
  const footballGoalBanner = document.getElementById('football-goal-banner')!;
  const footballScorerText = document.getElementById('football-scorer-text')!;
  const footballCountdownBanner = document.getElementById('football-countdown-banner')!;
  const footballCountdownNum = document.getElementById('football-countdown-num')!;
  const footballMinimapCanvas = document.getElementById('football-minimap-canvas') as HTMLCanvasElement | null;
  let footballRenderer: FootballRenderer3D | null = null;

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

  // Bluff Trivia Elements
  const bluffView = document.getElementById('bluff-view')!;
  const bluffCatBadge = document.getElementById('bluff-cat-badge')!;
  const bluffRoundIndicator = document.getElementById('bluff-round-indicator')!;
  const bluffPhaseTitle = document.getElementById('bluff-phase-title')!;
  const bluffTimer = document.getElementById('bluff-timer')!;
  const bluffQuestionText = document.getElementById('bluff-question-text')!;
  const bluffStageSubmitting = document.getElementById('bluff-stage-submitting')!;
  const bluffSubmittingPlayers = document.getElementById('bluff-submitting-players')!;
  const bluffStageVoting = document.getElementById('bluff-stage-voting')!;
  const bluffChoicesGrid = document.getElementById('bluff-choices-grid')!;
  const bluffStageReveal = document.getElementById('bluff-stage-reveal')!;
  const bluffMasterBanner = document.getElementById('bluff-master-banner')!;
  const bluffMasterName = document.getElementById('bluff-master-name')!;
  const bluffMasterCount = document.getElementById('bluff-master-count')!;
  const bluffRevealsGrid = document.getElementById('bluff-reveals-grid')!;

  // Mini Tetris Elements
  const tetrisView = document.getElementById('tetris-view')!;
  const tetrisBoardsContainer = document.getElementById('tetris-boards-container')!;
  const tetrisTimer = document.getElementById('tetris-timer')!;
  const tetrisPhaseIndicator = document.getElementById('tetris-phase-indicator')!;
  let tetrisRenderer: TetrisRenderer | null = null;

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

    cardMiniFootball.onclick = () => {
      sdk.selectGame('mini-football');
    };

    cardBluffTrivia.onclick = () => {
      sdk.selectGame('bluff-trivia');
    };

    cardMiniTetris.onclick = () => {
      sdk.selectGame('mini-tetris');
    };

    cardLostAndFound.onclick = () => {
      sdk.selectGame('lost-and-found');
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
        if (footballRenderer) {
          footballRenderer.dispose();
          footballRenderer = null;
        }
        if (tetrisRenderer) {
          tetrisRenderer.dispose();
          tetrisRenderer = null;
        }
        if (lostAndFoundRenderer) {
          lostAndFoundRenderer.destroy();
          lostAndFoundRenderer = null;
        }

        lobbyView.style.display = 'flex';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        lostAndFoundView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';

        // Seçili oyunu güncelle
        const selected = state.selectedGameId || 'reaction-rush';
        cardReactionRush.classList.toggle('selected', selected === 'reaction-rush');
        cardQuizArena.classList.toggle('selected', selected === 'quiz-arena');
        cardMiniFootball.classList.toggle('selected', selected === 'mini-football');
        cardBluffTrivia.classList.toggle('selected', selected === 'bluff-trivia');
        cardMiniTetris.classList.toggle('selected', selected === 'mini-tetris');
        cardLostAndFound.classList.toggle('selected', selected === 'lost-and-found');

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
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
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
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
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

      // ─── 4. MINI FOOTBALL (3D ARCADE FUTBOL) ───
      if (
        status === 'football_playing' ||
        (state.activeGameId === 'mini-football' && status !== 'game_over' && status !== 'lobby')
      ) {
        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'flex';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';

        if (!footballRenderer) {
          footballRenderer = new FootballRenderer3D(footballCanvasContainer, footballMinimapCanvas || undefined);
        }

        if (state.footballMatch) {
          try {
            footballRenderer.updateMatchState(state.footballMatch);
          } catch (err) {
            console.error('[FootballRenderer3D] updateMatchState error:', err);
          }

          // Update Scoreboard HUD
          footballBlueScore.innerText = (state.footballMatch.blueScore || 0).toString();
          footballRedScore.innerText = (state.footballMatch.redScore || 0).toString();

          // Time formatting
          const remaining = Math.max(0, Math.floor(state.footballMatch.timeRemaining || 180));
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          footballTimer.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

          // Goal celebration banner
          if (state.footballMatch.phase === 'goal') {
            footballGoalBanner.style.display = 'flex';
            footballScorerText.innerText = state.footballMatch.lastScorerName || 'Gol!';
          } else {
            footballGoalBanner.style.display = 'none';
          }

          // Kickoff Countdown banner
          if (state.footballMatch.phase === 'countdown') {
            footballCountdownBanner.style.display = 'flex';
            const countNum = Math.ceil(state.footballMatch.phaseTimer || 3);
            footballCountdownNum.innerText = countNum > 0 ? countNum.toString() : 'BAŞLA!';
          } else {
            footballCountdownBanner.style.display = 'none';
          }
        }

        return;
      }

      // ─── 5. BLUFF TRIVIA (BLÖF BİLGİ YARIŞMASI) ───
      if (
        status === 'bluff_playing' ||
        (state.activeGameId === 'bluff-trivia' && status !== 'game_over' && status !== 'lobby')
      ) {
        if (footballRenderer) {
          footballRenderer.dispose();
          footballRenderer = null;
        }

        const match = state.bluffTriviaMatch;
        if (!match) return;

        // Round Result Phase
        if (match.phase === 'round_result') {
          lobbyView.style.display = 'none';
          gameView.style.display = 'none';
          quizView.style.display = 'none';
          footballView.style.display = 'none';
          bluffView.style.display = 'none';
          tetrisView.style.display = 'none';
          resultView.style.display = 'flex';
          gameoverView.style.display = 'none';

          resultTitle.innerText = `ROUND ${match.round} SKORLARI`;
          resultScoreList.innerHTML = '';
          const sorted = [...playersArray].sort((a, b) => b.score - a.score);

          sorted.forEach((p, index) => {
            const row = document.createElement('div');
            row.className = 'score-row';
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            const roundGain = p.roundBluffGains ? `<span style="color:#22c55e; font-size:1.1rem; margin-left:0.5rem;">(+${p.roundBluffGains} Puan)</span>` : '';
            const trickInfo = p.trickedCount > 0 ? `<span style="color:#f59e0b; font-size:1rem; margin-left:0.5rem;">(${p.trickedCount} kişiyi kandırdı)</span>` : '';

            row.innerHTML = `
              <div>${medal} ${p.nickname} ${roundGain} ${trickInfo}</div>
              <div style="color: #facc15;">${p.score} Puan</div>
            `;
            resultScoreList.appendChild(row);
          });
          return;
        }

        // Active Bluff Playing Views
        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        tetrisView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';
        bluffView.style.display = 'flex';

        // Update Header
        if (match.isFriendsMode) {
          bluffCatBadge.innerText = '🌟 ÖZEL ARKADAŞ MODU';
          bluffCatBadge.style.background = '#ec4899';
        } else {
          bluffCatBadge.innerText = match.questionCategory || 'GENEL KÜLTÜR';
          bluffCatBadge.style.background = '#8b5cf6';
        }

        bluffRoundIndicator.innerText = `ROUND ${match.round || 1} / ${match.totalRounds || 5}`;
        const secLeft = Math.max(0, match.timeLeft || 0);
        bluffTimer.innerText = secLeft.toString();
        bluffTimer.classList.toggle('danger', secLeft <= 5);
        bluffQuestionText.innerText = match.questionText || 'Soru yükleniyor...';

        // Phase 1: Submitting
        if (match.phase === 'submitting') {
          if (match.isFriendsMode && match.subjectPlayerName) {
            bluffPhaseTitle.innerText = `${match.subjectPlayerName.toUpperCase()} HAKKINDA BLÖFLER YAZILIYOR ✍️`;
          } else {
            bluffPhaseTitle.innerText = 'BLÖFLER YAZILIYOR ✍️';
          }
          bluffStageSubmitting.style.display = 'flex';
          bluffStageVoting.style.display = 'none';
          bluffStageReveal.style.display = 'none';

          bluffSubmittingPlayers.innerHTML = '';
          playersArray.forEach((p) => {
            const isSubject = Boolean(match.isFriendsMode && (p.id === match.subjectPlayerId || p.nickname === match.subjectPlayerName));
            const badge = document.createElement('div');
            badge.className = `live-player-badge ${p.bluffSubmitted ? 'pressed' : ''}`;
            const statusIcon = p.bluffSubmitted ? '✓' : '⏳';
            let statusText = p.bluffSubmitted ? 'Cevabını Yazdı' : 'Yazıyor...';
            if (isSubject) {
              statusText = p.bluffSubmitted ? 'Gerçek Cevabı Yazdı 👑' : 'Gerçek Cevabı Yazıyor... 👑';
            }
            const nameDisplay = isSubject ? `👑 ${p.nickname}` : p.nickname;
            badge.innerHTML = `<span>${nameDisplay}</span> <span style="font-size:1.1rem; opacity:0.8;">${statusIcon} ${statusText}</span>`;
            bluffSubmittingPlayers.appendChild(badge);
          });
        }

        // Phase 2: Voting
        else if (match.phase === 'voting') {
          bluffPhaseTitle.innerText = 'GERÇEK CEVABI SEÇİN 🤔';
          bluffStageSubmitting.style.display = 'none';
          bluffStageVoting.style.display = 'flex';
          bluffStageReveal.style.display = 'none';

          bluffChoicesGrid.innerHTML = '';
          const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          let choiceIdx = 0;
          match.choices.forEach((choice) => {
            const card = document.createElement('div');
            card.className = 'bluff-choice-card';
            const letter = letters[choiceIdx] || `${choiceIdx + 1}`;
            card.innerHTML = `
              <div class="choice-letter">${letter}</div>
              <div style="flex:1;">${choice.text}</div>
            `;
            bluffChoicesGrid.appendChild(card);
            choiceIdx++;
          });
        }

        // Phase 3: Reveal
        else if (match.phase === 'reveal') {
          bluffPhaseTitle.innerText = 'SONUÇLAR VE İFŞALAR! 🎭';
          bluffStageSubmitting.style.display = 'none';
          bluffStageVoting.style.display = 'none';
          bluffStageReveal.style.display = 'flex';

          if (match.bluffMasterName && match.bluffMasterCount > 0) {
            bluffMasterBanner.style.display = 'block';
            bluffMasterName.innerText = match.bluffMasterName;
            bluffMasterCount.innerText = match.bluffMasterCount.toString();
          } else {
            bluffMasterBanner.style.display = 'none';
          }

          bluffRevealsGrid.innerHTML = '';
          match.reveals.forEach((r) => {
            const card = document.createElement('div');
            if (r.isCorrect) {
              card.className = 'bluff-reveal-card real-answer';
              const votersText = r.votersList ? `🎉 Doğru Bilenler: <strong>${r.votersList}</strong> (+100 Puan)` : 'Kimse doğru cevabı bulamadı!';
              const realTitle = match.isFriendsMode && match.subjectPlayerName
                ? `👑 ${match.subjectPlayerName.toUpperCase()}'İN GERÇEK CEVABI`
                : '✓ DOĞRU CEVAP';
              card.innerHTML = `
                <div style="font-size:1.1rem; color:${match.isFriendsMode ? '#ec4899' : '#22c55e'}; font-weight:900; letter-spacing:0.05rem;">
                  ${realTitle}
                </div>
                <div style="font-size:1.8rem; font-weight:800; color:white;">
                  "${r.text}"
                </div>
                <div style="font-size:1.2rem; color:#86efac; margin-top:0.3rem;">
                  ${votersText}
                </div>
              `;
            } else {
              card.className = 'bluff-reveal-card fake-bluff';
              const victimCount = r.votes || 0;
              const victimText = victimCount > 0
                ? `😈 Kandırılanlar (${victimCount}): <strong>${r.votersList}</strong> (+${victimCount * 150} Puan)`
                : '😅 Kimse kanmadı!';
              card.innerHTML = `
                <div style="font-size:1.1rem; color:#f59e0b; font-weight:800;">
                  ✍️ ${r.authorName}'in Blöfü
                </div>
                <div style="font-size:1.6rem; font-weight:700; color:#e2e8f0;">
                  "${r.text}"
                </div>
                <div style="font-size:1.1rem; color:#cbd5e1; margin-top:0.3rem;">
                  ${victimText}
                </div>
              `;
            }
            bluffRevealsGrid.appendChild(card);
          });
        }

        return;
      }

      // ─── 6. MINI TETRIS (BATTLE ROYALE TETRIS) ───
      if (
        status === 'tetris_playing' ||
        (state.activeGameId === 'mini-tetris' && status !== 'game_over' && status !== 'lobby')
      ) {
        if (footballRenderer) {
          footballRenderer.dispose();
          footballRenderer = null;
        }

        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';
        tetrisView.style.display = 'flex';

        if (!tetrisRenderer) {
          tetrisRenderer = new TetrisRenderer(
            tetrisBoardsContainer,
            tetrisTimer,
            tetrisPhaseIndicator
          );
        }

        return;
      }

      // ─── 7. LOST & FOUND (CO-OP ADVENTURE PLATFORMER) ───
      if (
        status === 'lost_and_found_playing' ||
        (state.activeGameId === 'lost-and-found' && status !== 'game_over' && status !== 'lobby')
      ) {
        if (footballRenderer) {
          footballRenderer.dispose();
          footballRenderer = null;
        }
        if (tetrisRenderer) {
          tetrisRenderer.dispose();
          tetrisRenderer = null;
        }

        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';
        lostAndFoundView.style.display = 'flex';

        if (!lostAndFoundRenderer) {
          lostAndFoundRenderer = new LostAndFoundRenderer3D(lostAndFoundCanvasContainer);
        }

        return;
      }

      // ─── 8. REACTION RUSH ROUND SONUCU ───
      if (status === 'round_result') {
        if (footballRenderer) {
          footballRenderer.dispose();
          footballRenderer = null;
        }
        if (tetrisRenderer) {
          tetrisRenderer.dispose();
          tetrisRenderer = null;
        }

        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
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

      // ─── 8. OYUN BİTTİ (PODYUM) ───
      if (status === 'game_over') {
        if (footballRenderer) {
          footballRenderer.dispose();
          footballRenderer = null;
        }
        if (tetrisRenderer) {
          tetrisRenderer.dispose();
          tetrisRenderer = null;
        }

        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
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

    // Tetris Canlı Snapshot Dinleyicisi
    sdk.onTetrisState = (tetrisState) => {
      if (tetrisView.style.display === 'flex' || tetrisRenderer) {
        if (!tetrisRenderer) {
          tetrisRenderer = new TetrisRenderer(
            tetrisBoardsContainer,
            tetrisTimer,
            tetrisPhaseIndicator
          );
        }
        tetrisRenderer.update(tetrisState);
      }
    };

    // Lost & Found Canlı Snapshot Dinleyicisi
    sdk.onLostAndFoundState = (lafState: any) => {
      if (lostAndFoundView.style.display === 'flex' || lostAndFoundRenderer) {
        if (!lostAndFoundRenderer) {
          lostAndFoundRenderer = new LostAndFoundRenderer3D(lostAndFoundCanvasContainer);
        }
        lostAndFoundRenderer.updateSnapshot(lafState);

        // ─── Update HUD ───

        // Objective
        if (lafObjectiveText && lafState.objectiveText) {
          lafObjectiveText.innerText = lafState.objectiveText;
        }

        // Phase Badge
        if (lafPhaseBadge) {
          lafPhaseBadge.innerText =
            lafState.phase === 'minigame'
              ? 'KASA KİLİDİ'
              : lafState.phase === 'completed'
              ? 'TAMAMLANDI'
              : 'OYNANIYOR';
          lafPhaseBadge.style.background =
            lafState.phase === 'minigame'
              ? '#f59e0b'
              : lafState.phase === 'completed'
              ? '#22c55e'
              : '#2563eb';
        }

        // Timer
        if (lafTimer && lafState.elapsedMs !== undefined) {
          const totalSec = Math.floor(lafState.elapsedMs / 1000);
          const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
          const s = (totalSec % 60).toString().padStart(2, '0');
          lafTimer.innerText = `${m}:${s}`;
        }

        // ─── Player Cards ───
        const miloP = lafState.players?.find((p: any) => p.role === 'milo');
        const niaP = lafState.players?.find((p: any) => p.role === 'nia');

        if (miloP) {
          if (lafPlayerANickname) lafPlayerANickname.innerText = miloP.nickname;
          if (lafPlayerAAbility) {
            lafPlayerAAbility.innerText = miloP.abilityActive ? 'AKTİF' : 'MIKNATIS';
          }
          if (lafPlayerACooldown) {
            lafPlayerACooldown.style.width = miloP.abilityActive ? '0%' : '100%';
            lafPlayerACooldown.style.background = miloP.abilityActive ? '#22c55e' : '#f97316';
          }
        }
        if (niaP) {
          if (lafPlayerBNickname) lafPlayerBNickname.innerText = niaP.nickname;
          if (lafPlayerBAbility) {
            lafPlayerBAbility.innerText = niaP.abilityActive ? 'AKTİF' : 'KANCA';
          }
          if (lafPlayerBCooldown) {
            lafPlayerBCooldown.style.width = niaP.abilityActive ? '0%' : '100%';
            lafPlayerBCooldown.style.background = niaP.abilityActive ? '#22c55e' : '#06b6d4';
          }
        }

        // ─── Checkpoint Progress ───
        if (lafCheckpointDots) {
          const steps = [
            lafState.platforms?.find((p: any) => p.id === 'gate_1')?.isOpen,
            lafState.powerCore?.isInserted,
            lafState.platforms?.find((p: any) => p.id === 'piston_1')?.isOpen,
            lafState.vaultDoorOpen,
          ];
          lafCheckpointDots.innerHTML = steps.map((done: boolean) =>
            `<span style="width:10px; height:10px; border-radius:50%; background:${done ? '#22c55e' : 'rgba(255,255,255,0.15)'};"></span>`
          ).join('');
        }

        // ─── Goal Notification (Vault opens) ───
        if (lafGoalNotification && lafState.vaultDoorOpen && !lafPrevVaultOpen) {
          if (lafGoalText) lafGoalText.innerText = '✓ Kasa Açıldı! Portala Koşun!';
          lafGoalNotification.style.display = 'flex';
          setTimeout(() => {
            if (lafGoalNotification) lafGoalNotification.style.display = 'none';
          }, 3000);
        }
        lafPrevVaultOpen = lafState.vaultDoorOpen || false;

        // ─── Level Complete Overlay ───
        if (lafLevelComplete) {
          if (lafState.phase === 'completed') {
            lafLevelComplete.style.display = 'flex';
            if (lafCompleteTime && lafState.completionTimeMs) {
              const sec = Math.floor(lafState.completionTimeMs / 1000);
              const cm = Math.floor(sec / 60).toString().padStart(2, '0');
              const cs = (sec % 60).toString().padStart(2, '0');
              lafCompleteTime.innerText = `${cm}:${cs}`;
            }
            if (lafCompleteScore) {
              const totalScore = (miloP?.score || 0) + (niaP?.score || 0);
              lafCompleteScore.innerText = `${totalScore} P`;
            }
          } else {
            lafLevelComplete.style.display = 'none';
          }
        }

        // ─── Mini-Game Overlay ───
        if (lafMinigameOverlay) {
          if (lafState.phase === 'minigame') {
            lafMinigameOverlay.style.display = 'block';
            if (lafSyncBar) lafSyncBar.style.width = `${lafState.miniGame.syncProgress}%`;
            if (lafSyncPercent) lafSyncPercent.innerText = `%${Math.round(lafState.miniGame.syncProgress)} EŞLEŞTİ`;
            if (lafMiloVal) lafMiloVal.innerText = `${Math.round(lafState.miniGame.miloFrequency)}%`;
            if (lafNiaVal) lafNiaVal.innerText = `${Math.round(lafState.miniGame.niaPhase)}°`;
          } else {
            lafMinigameOverlay.style.display = 'none';
          }
        }
      }
    };
  } catch (err: any) {
    statusView.innerText = 'HATA: ' + (err.message || err.toString());
    statusView.style.color = '#ef4444';
    console.error('[ScreenSDK] Başlatma Hatası:', err);
  }
}

bootstrap();
