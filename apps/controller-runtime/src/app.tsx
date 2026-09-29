import { useState, useEffect } from 'preact/hooks';
import { ControllerSDK } from '@platform/sdk-controller';
import type { SessionStateType } from '@platform/sdk-core';

const sdk = new ControllerSDK(`http://${window.location.hostname}:2567`);

export function App() {
  const [view, setView] = useState<'join' | 'connected'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Canlı Oyun Durumu
  const [gameStatus, setGameStatus] = useState('lobby');
  const [selectedGameId, setSelectedGameId] = useState('reaction-rush');
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [countdown, setCountdown] = useState(3);
  const [winnerNickname, setWinnerNickname] = useState('');

  // Quiz Durumu
  const [quizTimeLeft, setQuizTimeLeft] = useState(15);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(-1);

  // Oyuncunun Kendi Durumu
  const [isReady, setIsReady] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [score, setScore] = useState(0);
  const [lastReactionTime, setLastReactionTime] = useState(0);
  const [hasPressed, setHasPressed] = useState(false);
  const [rank, setRank] = useState(0);
  const [selectedOption, setSelectedOption] = useState(-1);
  const [isCorrect, setIsCorrect] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setRoomCode(code.toUpperCase());
    }

    sdk.onStateChange = (state: SessionStateType) => {
      setGameStatus(state.status || 'lobby');
      setSelectedGameId(state.selectedGameId || 'reaction-rush');
      setCurrentRound(state.currentRound || 1);
      setTotalRounds(state.totalRounds || 3);
      setCountdown(state.countdown || 0);
      setWinnerNickname(state.winnerNickname || '');

      setQuizTimeLeft(state.quizTimeLeft || 0);
      setQuizCorrectIndex(state.quizCorrectIndex !== undefined ? state.quizCorrectIndex : -1);

      const myId = sdk.sessionId;
      let found: any = null;

      state.players.forEach((p) => {
        if (p.id === myId || (nickname && p.nickname === nickname)) {
          found = p;
        }
      });

      if (found) {
        setIsReady(Boolean(found.isReady));
        setIsHost(Boolean(found.isHost));
        setScore(found.score || 0);
        setLastReactionTime(found.lastReactionTime || 0);
        setHasPressed(Boolean(found.hasPressed));
        setRank(found.rank || 0);
        setSelectedOption(found.selectedOption !== undefined ? found.selectedOption : -1);
        setIsCorrect(Boolean(found.isCorrect));
        setStreak(found.streak || 0);
      }
    };
  }, [nickname]);

  const handleJoin = async () => {
    if (!roomCode || !nickname) {
      setErrorMsg('Lütfen oda kodunu ve isminizi girin.');
      return;
    }
    setErrorMsg('Bağlanıyor...');
    try {
      await sdk.joinSession(roomCode.toUpperCase(), nickname);
      setView('connected');
      setErrorMsg('');
    } catch (e: any) {
      setErrorMsg('Hata: Odaya ulaşılamadı. Kodu kontrol edin.');
    }
  };

  const handleToggleReady = () => {
    sdk.toggleReady();
  };

  const handleSelectGame = (gameId: string) => {
    sdk.selectGame(gameId);
  };

  const handleStartGame = () => {
    sdk.startGame();
  };

  const handleReactionPress = (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (hasPressed) return;

    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    setHasPressed(true);
    sdk.press();
  };

  const handleQuizAnswer = (optionIdx: number, e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (hasPressed || selectedOption !== -1) return;

    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
    setSelectedOption(optionIdx);
    setHasPressed(true);
    sdk.answerQuiz(optionIdx);
  };

  const handleReturnToLobby = () => {
    sdk.returnToLobby();
  };

  // ─── 1. KATILMA EKRANI ───
  if (view === 'join') {
    return (
      <div class="container">
        <h1>Odaya Katıl</h1>

        <div class="input-group">
          <label>Oda Kodu</label>
          <input
            type="text"
            maxLength={6}
            value={roomCode}
            placeholder="KOD"
            onInput={(e) => setRoomCode(e.currentTarget.value)}
          />
        </div>

        <div class="input-group">
          <label>Takma Adın</label>
          <input
            type="text"
            maxLength={12}
            value={nickname}
            placeholder="İSİM"
            onInput={(e) => setNickname(e.currentTarget.value)}
          />
        </div>

        <button onClick={handleJoin}>KATIL</button>

        {errorMsg && <div class="status-text">{errorMsg}</div>}
      </div>
    );
  }

  // ─── 2. LOBİ EKRANI (OYUN SEÇİCİ DAHİL) ───
  if (gameStatus === 'lobby') {
    return (
      <div class="container">
        <h2 style={{ color: '#94a3b8', margin: '0' }}>Oda: {roomCode}</h2>
        <h1 style={{ fontSize: '2.5rem', margin: '0.6rem 0' }}>{nickname}</h1>

        {isHost && (
          <div style={{ marginBottom: '1rem', color: '#fbbf24', fontWeight: 'bold' }}>
            👑 Oda Yöneticisisin
          </div>
        )}

        {/* Oyun Seçim Butonları (Host değiştirebilir) */}
        {isHost && (
          <div class="lobby-game-tabs">
            <button
              class={`lobby-tab-btn ${selectedGameId === 'reaction-rush' ? 'active' : ''}`}
              onClick={() => handleSelectGame('reaction-rush')}
            >
              ⚡ Refleks
            </button>
            <button
              class={`lobby-tab-btn ${selectedGameId === 'quiz-arena' ? 'active' : ''}`}
              onClick={() => handleSelectGame('quiz-arena')}
            >
              🧠 Bilgi (Quiz)
            </button>
          </div>
        )}

        {!isHost && (
          <div style={{ color: '#38bdf8', marginBottom: '1.2rem', fontWeight: 700 }}>
            Seçili Oyun: {selectedGameId === 'quiz-arena' ? '🧠 Quiz Arena' : '⚡ Reaction Rush'}
          </div>
        )}

        <button
          class={isReady ? 'cancel-btn' : 'ready-btn'}
          onClick={handleToggleReady}
        >
          {isReady ? 'İPTAL' : 'HAZIRIM!'}
        </button>

        {isHost && (
          <button class="host-start-btn" onClick={handleStartGame}>
            OYUNU BAŞLAT 🎮
          </button>
        )}
      </div>
    );
  }

  // ─── 3. REACTION RUSH GERİ SAYIM ───
  if (gameStatus === 'countdown') {
    return (
      <div class="game-container countdown-screen">
        <div style={{ color: '#94a3b8', fontSize: '1.4rem' }}>
          ROUND {currentRound} / {totalRounds}
        </div>
        <h1 style={{ fontSize: '6rem', margin: '1.5rem 0', color: '#38bdf8' }}>
          {countdown > 0 ? countdown : 'DİKKAT!'}
        </h1>
        <div style={{ fontSize: '1.4rem', color: '#cbd5e1' }}>
          Yeşil rengi bekleyin!
        </div>
      </div>
    );
  }

  // ─── 4. REACTION RUSH KIRMIZI EVRE ───
  if (gameStatus === 'red') {
    if (hasPressed && lastReactionTime === -1) {
      return (
        <div class="game-container red-screen">
          <div class="foul-box">
            ❌ FAUL!
            <div style={{ fontSize: '1.2rem', marginTop: '0.8rem', color: 'white' }}>
              Çok erken bastın! (-40 Puan)
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        class="game-container red-screen"
        onPointerDown={handleReactionPress}
        onClick={handleReactionPress}
      >
        <h1 style={{ fontSize: '3rem', color: 'white', margin: '0 0 1rem 0' }}>
          DUR! 🛑
        </h1>
        <div style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.9)' }}>
          Sakın basma, yeşili bekle!
        </div>
      </div>
    );
  }

  // ─── 5. REACTION RUSH YEŞİL EVRE ───
  if (gameStatus === 'green') {
    if (hasPressed) {
      if (lastReactionTime === -1) {
        return (
          <div class="game-container green-screen">
            <div class="foul-box">
              ❌ FAUL!
              <div style={{ fontSize: '1.2rem', marginTop: '0.8rem', color: 'white' }}>
                Kırmızıda bastığın için bu round elendin.
              </div>
            </div>
          </div>
        );
      }

      return (
        <div class="game-container green-screen">
          <div class="success-box">
            ⚡ {lastReactionTime > 0 ? `${lastReactionTime} ms!` : 'BASILDI!'}
            <div style={{ fontSize: '1.3rem', marginTop: '0.8rem', color: 'white' }}>
              {rank > 0 ? `${rank}. Sırada Bastın! 🚀` : 'Kayıt Alındı, Bekleniyor...'}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        class="game-container green-screen"
        onPointerDown={handleReactionPress}
        onClick={handleReactionPress}
      >
        <button
          type="button"
          class="rush-tap-button"
          onPointerDown={handleReactionPress}
          onClick={handleReactionPress}
        >
          BAS! ⚡
        </button>
      </div>
    );
  }

  // ─── 6. QUIZ ARENA: SORU EVRESİ (4 RENK DOKUNMATİK ŞIK) ───
  if (gameStatus === 'quiz_question') {
    const letters = ['A', 'B', 'C', 'D'];

    return (
      <div class="container" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '450px', marginBottom: '0.5rem', color: '#94a3b8', fontWeight: 'bold' }}>
          <span>SORU {currentRound} / {totalRounds}</span>
          <span style={{ color: quizTimeLeft <= 5 ? '#ef4444' : '#38bdf8' }}>⏱️ {quizTimeLeft}s</span>
        </div>

        {selectedOption !== -1 ? (
          <div class="success-box" style={{ width: '100%', maxWidth: '380px' }}>
            ✓ CEVABIN ALINDI!
            <div style={{ fontSize: '1.2rem', marginTop: '0.5rem', color: 'white' }}>
              Seçimin: <strong>{letters[selectedOption]} Şıkkı</strong>
            </div>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>
              Süre bitince doğru cevap açıklanacak...
            </div>
          </div>
        ) : (
          <div class="quiz-grid">
            <button
              class="quiz-answer-btn btn-a"
              onPointerDown={(e) => handleQuizAnswer(0, e)}
              onClick={(e) => handleQuizAnswer(0, e)}
            >
              ▲
              <span style={{ fontSize: '1.4rem', marginTop: '0.3rem' }}>A</span>
            </button>
            <button
              class="quiz-answer-btn btn-b"
              onPointerDown={(e) => handleQuizAnswer(1, e)}
              onClick={(e) => handleQuizAnswer(1, e)}
            >
              ■
              <span style={{ fontSize: '1.4rem', marginTop: '0.3rem' }}>B</span>
            </button>
            <button
              class="quiz-answer-btn btn-c"
              onPointerDown={(e) => handleQuizAnswer(2, e)}
              onClick={(e) => handleQuizAnswer(2, e)}
            >
              ●
              <span style={{ fontSize: '1.4rem', marginTop: '0.3rem' }}>C</span>
            </button>
            <button
              class="quiz-answer-btn btn-d"
              onPointerDown={(e) => handleQuizAnswer(3, e)}
              onClick={(e) => handleQuizAnswer(3, e)}
            >
              ★
              <span style={{ fontSize: '1.4rem', marginTop: '0.3rem' }}>D</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── 7. QUIZ ARENA: SONUÇ EVRESİ (FEEDBACK) ───
  if (gameStatus === 'quiz_result') {
    const letters = ['A', 'B', 'C', 'D'];
    const correctLetter = quizCorrectIndex >= 0 ? letters[quizCorrectIndex] : '?';

    return (
      <div class="container">
        {isCorrect ? (
          <div class="success-box" style={{ maxWidth: '360px' }}>
            🎉 DOĞRU CEVAP!
            <div style={{ fontSize: '1.3rem', marginTop: '0.8rem', color: 'white' }}>
              Doğru Şık: <strong>{correctLetter}</strong>
            </div>
            {streak > 1 && (
              <div style={{ color: '#facc15', fontSize: '1.1rem', marginTop: '0.5rem' }}>
                🔥 Seri: {streak} Doğru!
              </div>
            )}
          </div>
        ) : (
          <div class="foul-box" style={{ maxWidth: '360px' }}>
            ❌ YANLIŞ!
            <div style={{ fontSize: '1.2rem', marginTop: '0.8rem', color: 'white' }}>
              Doğru Cevap: <strong>{correctLetter}</strong>
            </div>
            <div style={{ fontSize: '1rem', marginTop: '0.4rem', opacity: 0.8 }}>
              {selectedOption === -1 ? 'Süre doldu, cevap vermedin.' : `Senin seçimin: ${letters[selectedOption]}`}
            </div>
          </div>
        )}

        <div style={{ fontSize: '1.8rem', margin: '1.5rem 0', color: '#facc15' }}>
          Toplam Puanın: {score}
        </div>
      </div>
    );
  }

  // ─── 8. REACTION RUSH ROUND SONUCU ───
  if (gameStatus === 'round_result') {
    return (
      <div class="container">
        <h2 style={{ color: '#38bdf8' }}>ROUND {currentRound} BİTTİ</h2>

        {lastReactionTime === -1 ? (
          <div style={{ color: '#ef4444', fontSize: '1.8rem', margin: '1rem 0', fontWeight: 'bold' }}>
            ❌ FAUL YAPTIN
          </div>
        ) : lastReactionTime > 0 ? (
          <div style={{ color: '#22c55e', fontSize: '1.8rem', margin: '1rem 0', fontWeight: 'bold' }}>
            ⚡ {lastReactionTime} ms (#{rank})
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '1.5rem', margin: '1rem 0' }}>
            Zamanında basamadın
          </div>
        )}

        <div style={{ fontSize: '1.8rem', margin: '1rem 0', color: '#facc15' }}>
          Toplam Puanın: {score}
        </div>

        <div style={{ color: '#94a3b8', marginTop: '1rem' }}>
          Sonraki round hazırlanıyor...
        </div>
      </div>
    );
  }

  // ─── 9. OYUN BİTTİ (PODYUM) ───
  if (gameStatus === 'game_over') {
    const isWinner = winnerNickname === nickname;

    return (
      <div class="container">
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>
          {isWinner ? '🏆' : '🏅'}
        </div>
        <h1 style={{ color: isWinner ? '#facc15' : '#38bdf8', margin: 0 }}>
          {isWinner ? 'KAZANDIN! ŞAMPİYONSUN!' : 'OYUN BİTTİ!'}
        </h1>
        <div style={{ fontSize: '1.6rem', margin: '1rem 0', color: '#e2e8f0' }}>
          Kazanan: <strong>{winnerNickname}</strong>
        </div>
        <div style={{ fontSize: '1.8rem', color: '#facc15', marginBottom: '1.5rem' }}>
          Toplam Puanın: {score}
        </div>

        {isHost && (
          <button class="host-start-btn" onClick={handleReturnToLobby}>
            LOBİYE DÖN 🏠
          </button>
        )}
      </div>
    );
  }

  return <div class="container">Bağlantı bekleniyor...</div>;
}
