import { useState, useEffect } from 'preact/hooks';
import { ControllerSDK } from '@platform/sdk-controller';
import type { SessionStateType } from '@platform/sdk-core';
import { FootballGamepad } from './FootballGamepad';
import { BluffTriviaController } from './BluffTriviaController';
import { MiniTetrisGamepad } from './MiniTetrisGamepad';
import { LostAndFoundGamepad } from './LostAndFoundGamepad';

const sdk = new ControllerSDK(`http://${window.location.hostname}:2567`);

export function App() {
  const [view, setView] = useState<'join' | 'connected'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Canlı Oyun Durumu
  const [rawState, setRawState] = useState<SessionStateType | null>(null);
  const [gameStatus, setGameStatus] = useState('lobby');
  const [activeGameId, setActiveGameId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('reaction-rush');
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [countdown, setCountdown] = useState(3);
  const [winnerNickname, setWinnerNickname] = useState('');

  // Quiz Durumu
  const [quizTimeLeft, setQuizTimeLeft] = useState(15);
  const [quizCorrectIndex, setQuizCorrectIndex] = useState(-1);

  // Football Durumu
  const [myTeam, setMyTeam] = useState<'blue' | 'red' | ''>('');
  const [controlledPlayerId, setControlledPlayerId] = useState('');

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

  // Colyseus State Revision Tick (force re-render on nested state mutations)
  const [tick, setTick] = useState(0);

  // Bluff Ayarları (Yönetici)
  const [bluffCategory, setBluffCategory] = useState<'genel' | 'cografya' | 'tarih' | 'spor' | 'sinema' | 'bilim' | 'arkadas'>('genel');
  const [bluffSubmitTime, setBluffSubmitTime] = useState(30);
  const [bluffVoteTime, setBluffVoteTime] = useState(20);
  const [bluffRevealTime, setBluffRevealTime] = useState(10);
  const [bluffRounds, setBluffRounds] = useState(5);

  const handleUpdateBluffSettings = (updated: Partial<{
    category: 'genel' | 'cografya' | 'tarih' | 'spor' | 'sinema' | 'bilim' | 'arkadas';
    submittingTimeSeconds: number;
    votingTimeSeconds: number;
    revealDurationSeconds: number;
    totalRounds: number;
  }>) => {
    const newCat = updated.category ?? bluffCategory;
    const newSub = updated.submittingTimeSeconds ?? bluffSubmitTime;
    const newVote = updated.votingTimeSeconds ?? bluffVoteTime;
    const newRev = updated.revealDurationSeconds ?? bluffRevealTime;
    const newRounds = updated.totalRounds ?? bluffRounds;

    if (updated.category) setBluffCategory(updated.category);
    if (updated.submittingTimeSeconds) setBluffSubmitTime(updated.submittingTimeSeconds);
    if (updated.votingTimeSeconds) setBluffVoteTime(updated.votingTimeSeconds);
    if (updated.revealDurationSeconds) setBluffRevealTime(updated.revealDurationSeconds);
    if (updated.totalRounds) setBluffRounds(updated.totalRounds);

    sdk.updateBluffSettings({
      category: newCat,
      submittingTimeSeconds: newSub,
      votingTimeSeconds: newVote,
      revealDurationSeconds: newRev,
      totalRounds: newRounds
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setRoomCode(code.toUpperCase());
    }

    sdk.onStateChange = (state: SessionStateType) => {
      setRawState(state);
      setTick((t) => t + 1);
      setGameStatus(state.status || 'lobby');
      setActiveGameId(state.activeGameId || '');
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
        setMyTeam((found.team as any) || '');
        setControlledPlayerId(found.controlledPlayerId || '');
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
              🧠 Quiz
            </button>
            <button
              class={`lobby-tab-btn ${selectedGameId === 'mini-football' ? 'active' : ''}`}
              onClick={() => handleSelectGame('mini-football')}
            >
              ⚽ Futbol
            </button>
            <button
              class={`lobby-tab-btn ${selectedGameId === 'bluff-trivia' ? 'active' : ''}`}
              onClick={() => handleSelectGame('bluff-trivia')}
            >
              🎭 Blöf
            </button>
            <button
              class={`lobby-tab-btn ${selectedGameId === 'mini-tetris' ? 'active' : ''}`}
              onClick={() => handleSelectGame('mini-tetris')}
            >
              🧱 Tetris
            </button>
            <button
              class={`lobby-tab-btn ${selectedGameId === 'lost-and-found' ? 'active' : ''}`}
              onClick={() => handleSelectGame('lost-and-found')}
            >
              🧸 Lost & Found
            </button>
          </div>
        )}

        {!isHost && (
          <div style={{ color: '#38bdf8', marginBottom: '1.2rem', fontWeight: 700 }}>
            Seçili Oyun:{' '}
            {selectedGameId === 'quiz-arena'
              ? '🧠 Quiz Arena'
              : selectedGameId === 'mini-football'
              ? '⚽ Mini Football'
              : selectedGameId === 'bluff-trivia'
              ? '🎭 Bluff Trivia'
              : selectedGameId === 'mini-tetris'
              ? '🧱 Mini Tetris'
              : selectedGameId === 'lost-and-found'
              ? '🧸 Lost & Found'
              : '⚡ Reaction Rush'}
          </div>
        )}

        {/* Futbol Takım Seçimi */}
        {selectedGameId === 'mini-football' && (
          <div style={{ marginBottom: '1.2rem', width: '100%', maxWidth: '320px' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 600 }}>
              Takımını Seç:
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                style={{
                  background: myTeam === 'blue' ? '#2563eb' : '#1e293b',
                  border: '2px solid #3b82f6',
                  color: 'white',
                  padding: '0.6rem 0.4rem',
                  fontSize: '1rem',
                  margin: 0,
                  flex: 1
                }}
                onClick={() => sdk.chooseFootballTeam('blue')}
              >
                🔵 Mavi Takım
              </button>
              <button
                type="button"
                style={{
                  background: myTeam === 'red' ? '#dc2626' : '#1e293b',
                  border: '2px solid #ef4444',
                  color: 'white',
                  padding: '0.6rem 0.4rem',
                  fontSize: '1rem',
                  margin: 0,
                  flex: 1
                }}
                onClick={() => sdk.chooseFootballTeam('red')}
              >
                🔴 Kırmızı Takım
              </button>
            </div>
          </div>
        )}

        {/* Bluff Trivia Host Ayarları */}
        {selectedGameId === 'bluff-trivia' && isHost && (
          <div
            style={{
              background: '#1e293b',
              border: '2px solid #8b5cf6',
              borderRadius: '1rem',
              padding: '1rem',
              width: '100%',
              maxWidth: '360px',
              marginBottom: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              textAlign: 'left',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ color: '#c084fc', fontWeight: 800, fontSize: '1.1rem', textAlign: 'center' }}>
              ⚙️ Blöf Oyunu Ayarları
            </div>

            {/* Kategori Seçimi */}
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Kategori Seçimi:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {[
                  { id: 'genel', label: '🌐 Genel Kültür' },
                  { id: 'cografya', label: '🌍 Coğrafya' },
                  { id: 'tarih', label: '🏛️ Tarih' },
                  { id: 'spor', label: '⚽ Spor' },
                  { id: 'sinema', label: '🎬 Sinema' },
                  { id: 'bilim', label: '🔬 Bilim' },
                  { id: 'arkadas', label: '🌟 Özel Arkadaş Modu' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    style={{
                      background: bluffCategory === cat.id ? '#8b5cf6' : '#0f172a',
                      border: `1.5px solid ${bluffCategory === cat.id ? '#c084fc' : '#334155'}`,
                      color: 'white',
                      padding: '0.45rem 0.5rem',
                      fontSize: '0.85rem',
                      fontWeight: bluffCategory === cat.id ? 800 : 500,
                      borderRadius: '0.5rem',
                      margin: 0,
                      gridColumn: cat.id === 'arkadas' ? 'span 2' : 'span 1'
                    }}
                    onClick={() => handleUpdateBluffSettings({ category: cat.id as any })}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Süreler ve Round Sayısı */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  Blöf Yazma Süresi:
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[20, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      style={{
                        flex: 1,
                        background: bluffSubmitTime === sec ? '#8b5cf6' : '#0f172a',
                        border: `1px solid ${bluffSubmitTime === sec ? '#c084fc' : '#334155'}`,
                        color: 'white',
                        padding: '0.35rem 0.2rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.4rem',
                        margin: 0
                      }}
                      onClick={() => handleUpdateBluffSettings({ submittingTimeSeconds: sec })}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  Tur Sayısı:
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[3, 5, 7].map((r) => (
                    <button
                      key={r}
                      type="button"
                      style={{
                        flex: 1,
                        background: bluffRounds === r ? '#8b5cf6' : '#0f172a',
                        border: `1px solid ${bluffRounds === r ? '#c084fc' : '#334155'}`,
                        color: 'white',
                        padding: '0.35rem 0.2rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.4rem',
                        margin: 0
                      }}
                      onClick={() => handleUpdateBluffSettings({ totalRounds: r })}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  Oylama Süresi:
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[15, 20, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      style={{
                        flex: 1,
                        background: bluffVoteTime === sec ? '#8b5cf6' : '#0f172a',
                        border: `1px solid ${bluffVoteTime === sec ? '#c084fc' : '#334155'}`,
                        color: 'white',
                        padding: '0.35rem 0.2rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.4rem',
                        margin: 0
                      }}
                      onClick={() => handleUpdateBluffSettings({ votingTimeSeconds: sec })}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  İfşa Süresi:
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {[8, 10, 15].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      style={{
                        flex: 1,
                        background: bluffRevealTime === sec ? '#8b5cf6' : '#0f172a',
                        border: `1px solid ${bluffRevealTime === sec ? '#c084fc' : '#334155'}`,
                        color: 'white',
                        padding: '0.35rem 0.2rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.4rem',
                        margin: 0
                      }}
                      onClick={() => handleUpdateBluffSettings({ revealDurationSeconds: sec })}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>
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

  // ─── MINI FOOTBALL GAMEPAD EKRANI ───
  if (
    gameStatus === 'football_playing' ||
    (activeGameId === 'mini-football' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    return (
      <FootballGamepad
        tick={tick}
        sdk={sdk}
        myNickname={nickname}
        myTeam={myTeam || 'blue'}
        controlledPlayerId={controlledPlayerId}
        matchState={rawState?.footballMatch}
      />
    );
  }

  // ─── BLUFF TRIVIA KONTROLCÜ EKRANI ───
  if (
    gameStatus === 'bluff_playing' ||
    (activeGameId === 'bluff-trivia' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    const myId = sdk.sessionId;
    let foundMyPlayer: any = null;
    if (rawState?.players) {
      rawState.players.forEach((p) => {
        if (p.id === myId || (nickname && p.nickname === nickname)) {
          foundMyPlayer = p;
        }
      });
    }

    return (
      <BluffTriviaController
        tick={tick}
        sdk={sdk}
        myNickname={nickname}
        myPlayer={foundMyPlayer}
        matchState={rawState?.bluffTriviaMatch}
        totalScore={score}
      />
    );
  }

  // ─── MINI TETRIS GAMEPAD EKRANI ───
  if (
    gameStatus === 'tetris_playing' ||
    (activeGameId === 'mini-tetris' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    return (
      <MiniTetrisGamepad
        sdk={sdk}
        myNickname={nickname}
        myPlayerId={sdk.sessionId}
      />
    );
  }

  // ─── LOST & FOUND GAMEPAD EKRANI ───
  if (
    gameStatus === 'lost_and_found_playing' ||
    (activeGameId === 'lost-and-found' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    return (
      <LostAndFoundGamepad
        sdk={sdk}
        myNickname={nickname}
        myPlayerId={sdk.sessionId}
      />
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
