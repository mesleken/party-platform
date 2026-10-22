import { useState, useEffect } from 'preact/hooks';
import { ControllerSDK } from '@platform/sdk-controller';
import { QUIZ_CATEGORIES, type SessionStateType } from '@platform/sdk-core';
import { FootballGamepad } from './FootballGamepad';
import { BluffTriviaController } from './BluffTriviaController';
import { MiniTetrisGamepad } from './MiniTetrisGamepad';
import { LostAndFoundGamepad } from './LostAndFoundGamepad';
import { RcRushGamepad } from './RcRushGamepad';
import { TransferShowdownController } from './TransferShowdownController';

const COLOR_PALETTE = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16'
];

const COLOR_NAMES: Record<string, string> = {
  '#ef4444': 'Kırmızı Ateş',
  '#3b82f6': 'Okyanus Mavisi',
  '#10b981': 'Zümrüt Yeşili',
  '#f59e0b': 'Güneş Sarısı',
  '#8b5cf6': 'Kozmik Mor',
  '#ec4899': 'Neon Pembe',
  '#06b6d4': 'Buz Turkuazı',
  '#84cc16': 'Fıstık Yeşili'
};

const COSTUME_ITEMS = [
  { id: 'standard', name: 'Standart', icon: '🏎️' },
  { id: 'retro_racer', name: 'Retro 90s', icon: '🕹️' },
  { id: 'cyber_neon', name: 'Cyber Neon', icon: '⚡' },
  { id: 'stealth_shadow', name: 'Gizli Gölge', icon: '🥷' },
  { id: 'golden_legend', name: 'Altın Efsane', icon: '🏆' },
  { id: 'toxic_surge', name: 'Zehirli Fırtına', icon: '☣️' }
];

const GAME_METAS: Record<string, {
  icon: string;
  title: string;
  tutorials: { title: string; desc: string }[];
}> = {
  'reaction-rush': {
    icon: '⚡',
    title: 'Reaction Rush',
    tutorials: [
      { title: 'Kırmızı Işıkta Dur', desc: 'Ekran kırmızı olduğunda kesinlikle basma, faul yaparsın (-40 puan)!' },
      { title: 'Yeşil Işıkta Bas', desc: 'Yeşil yandığı anda telefonundaki butona en hızlı sen bas!' },
      { title: '3 Round Yarış', desc: 'En yüksek skoru toplayan refleks şampiyonu olur.' }
    ]
  },
  'quiz-arena': {
    icon: '🧠',
    title: 'Quiz Arena',
    tutorials: [
      { title: 'Soruyu Ekranda Oku', desc: 'Dev ekranda soru belirir, 15 saniye içinde cevabı düşün.' },
      { title: 'Telefonda Şıkkını Seç', desc: 'Telefonundaki 4 seçenekten doğru olana tıkla.' },
      { title: 'Streak Kombo Bonusu', desc: 'Arka arkaya doğru cevaplar puanını katlar!' }
    ]
  },
  'mini-football': {
    icon: '⚽',
    title: 'Mini Football',
    tutorials: [
      { title: 'Sol Başparmak: Joystick', desc: 'Sanal joystick ile oyuncunu yönlendir ve sahada pozisyon al.' },
      { title: 'Pas, Şut ve Kayma', desc: 'Top sendeyken PAS ve ŞUT butonları, rakipten alırken KAYARAK MÜDAHALE yap.' },
      { title: 'Hızlı Oyuncu Değişimi', desc: 'DEĞİŞTİR butonu ile topa en yakın serbest oyuncuya anında geç!' }
    ]
  },
  'bluff-trivia': {
    icon: '🎭',
    title: 'Bluff Trivia',
    tutorials: [
      { title: 'İnandırıcı Bir Yalan Yaz', desc: 'Herkesi kandıracak zekice bir sahte cevap uydur.' },
      { title: 'Gerçek Cevabı Bul', desc: 'Cevaplar arasından doğru olanı bulup oyla.' },
      { title: 'Rakipleri Kandır', desc: 'Senin yalanına inanan her oyuncudan puan topla!' }
    ]
  },
  'mini-tetris': {
    icon: '🧱',
    title: 'Mini Tetris',
    tutorials: [
      { title: 'D-Pad ile Blokları Yönet', desc: 'Sol/Sağ ile hareket ettir, Döndür ile çevir, Düşür ile kilitle.' },
      { title: 'Satır Temizle ve Saldır', desc: '2+ satır temizleyince diğer oyunculara çöp blok gönderirsin!' },
      { title: 'Son Ayakta Kalan Kazanır', desc: 'Tavanı aşmadan hayatta kal, zafere ulaş!' }
    ]
  },
  'lost-and-found': {
    icon: '🧸',
    title: 'Lost & Found',
    tutorials: [
      { title: 'Milo & Nia Ortaklığı', desc: 'Milo metal nesneleri iter/çeker, Nia kanca ile yukarı tırmanır.' },
      { title: 'Birlikte Bulmacaları Çöz', desc: 'Düğmelere basarak kapıları açın ve lazerleri aşın.' },
      { title: 'Kasa Açma Eşleşmesi', desc: 'Son aşamada frekans ve faz açılarını eşleştirip kasayı açın!' }
    ]
  },
  'rc-rush': {
    icon: '🏎️',
    title: 'RC Rush',
    tutorials: [
      { title: 'Direksiyon & Gaz', desc: 'Arcade kontrollerle virajları dön, rampalardan zıpla.' },
      { title: 'Alevli Nitro Turbo', desc: 'Düzlüklerde ve sollamalarda Nitro basarak en yüksek hıza çık!' },
      { title: 'Gizemli Güç Kutuları', desc: 'Pistteki kutulardan Roket ve Kalkan kazanarak rakiplerini geç!' }
    ]
  },
  'transfer-showdown': {
    icon: '⚽',
    title: 'Transfer Showdown',
    tutorials: [
      { title: 'Açık Artırma & 100 Kredi', desc: '100 kredi bütçeyle 11 futbolcu transfer et. Bütçe korumasına ve mevki kotalarına dikkat et!' },
      { title: 'Kadro & Taktik Belirle', desc: 'Dizilişini (4-3-3, 4-4-2 vb.), oyun stilini ve savunma çizgini rakibe göre ayarla.' },
      { title: 'Canlı Maç & Son 15 Dk', desc: 'Dev ekranda 3D maç pozisyonlarını izle, devrede taktiğini tazele, son 15 dk tüm hatlarıyla saldır!' }
    ]
  }
};

const serverUrl =
  (import.meta as any).env?.VITE_SERVER_URL ||
  (window.location.port === '5174'
    ? `http://${window.location.hostname}:2567`
    : `${window.location.protocol}//${window.location.host}`);

const sdk = new ControllerSDK(serverUrl);

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

  // Özelleştirme ve Staging Durumu
  const [myColor, setMyColor] = useState('#3b82f6');
  const [myCostume, setMyCostume] = useState('standard');
  const [stagingTab, setStagingTab] = useState<'customize' | 'tutorial' | 'settings'>('customize');
  const [stageSettings, setStageSettings] = useState<{
    totalRounds?: number;
    speed?: string;
    questionCount?: number;
    timeLimit?: number;
    selectedCategories?: string[];
    [key: string]: any;
  }>({
    totalRounds: 3,
    speed: 'normal',
    questionCount: 5,
    timeLimit: 15,
    selectedCategories: ['bilim', 'tarih', 'cografya', 'sinema', 'oyun', 'spor', 'genel']
  });

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
        if (found.color) setMyColor(found.color);
        if (found.costume) setMyCostume(found.costume);
      }

      if (state.stageSettings) {
        try {
          const parsed = JSON.parse(state.stageSettings);
          setStageSettings((s) => ({ ...s, ...parsed }));
        } catch (e) {}
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

  const handleSelectColor = (color: string) => {
    setMyColor(color);
    const costumeIcon = COSTUME_ITEMS.find((c) => c.id === myCostume)?.icon || '🏎️';
    sdk.customizePlayer({ color, costume: myCostume, avatar: costumeIcon });
  };

  const handleSelectCostume = (costume: string) => {
    setMyCostume(costume);
    const costumeIcon = COSTUME_ITEMS.find((c) => c.id === costume)?.icon || '🏎️';
    sdk.customizePlayer({ color: myColor, costume, avatar: costumeIcon });
  };

  const handleLaunchMatch = () => {
    sdk.launchMatch();
  };

  const handleUpdateStageSettings = (settings: any) => {
    const updated = { ...stageSettings, ...settings };
    setStageSettings(updated);
    sdk.updateGameSettings(updated);
  };

  const renderWithHostOverlay = (content: any) => (
    <>
      {isHost && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: 9999,
          display: 'flex',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1.5px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '20px',
          padding: '4px 8px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.6)'
        }}>
          <button
            type="button"
            style={{
              background: '#f59e0b',
              border: 'none',
              borderRadius: '14px',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '0.8rem',
              padding: '4px 9px',
              cursor: 'pointer',
              margin: 0
            }}
            onClick={() => sdk.pauseGame()}
          >
            ⏸️ Durdur
          </button>
          <button
            type="button"
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              border: '1px solid #ef4444',
              borderRadius: '14px',
              color: '#fca5a5',
              fontWeight: 800,
              fontSize: '0.8rem',
              padding: '4px 9px',
              cursor: 'pointer',
              margin: 0
            }}
            onClick={() => sdk.returnToLobby()}
          >
            🏠 Lobi
          </button>
        </div>
      )}
      {content}
    </>
  );

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
        <h2 style={{ color: '#94a3b8', margin: '0', fontSize: '0.95rem', letterSpacing: '0.06em' }}>ODA: {roomCode}</h2>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          margin: '0.6rem 0 1rem 0'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${myColor}55 0%, #0f172a 85%)`,
            border: `3px solid ${myColor}`,
            boxShadow: `0 0 20px ${myColor}77`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            transition: 'all 0.3s ease'
          }}>
            {COSTUME_ITEMS.find((c) => c.id === myCostume)?.icon || '🏎️'}
          </div>
          <h1 style={{ fontSize: '2.2rem', margin: 0, color: '#f8fafc' }}>{nickname}</h1>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            fontWeight: 800,
            color: myColor
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: myColor, boxShadow: `0 0 6px ${myColor}` }} />
            {COLOR_NAMES[myColor] || 'Renk Paketi'}
          </div>
        </div>

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
            <button
              class={`lobby-tab-btn ${selectedGameId === 'rc-rush' ? 'active' : ''}`}
              onClick={() => handleSelectGame('rc-rush')}
            >
              🏎️ RC Rush
            </button>
            <button
              class={`lobby-tab-btn ${selectedGameId === 'transfer-showdown' ? 'active' : ''}`}
              onClick={() => handleSelectGame('transfer-showdown')}
            >
              ⚽ Showdown
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
              : selectedGameId === 'rc-rush'
              ? '🏎️ RC Rush'
              : selectedGameId === 'transfer-showdown'
              ? '⚽ Transfer Showdown'
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

  // ─── GLOBAL PAUSE SCREEN (DURAKLATMA EKRANI) ───
  if (rawState?.isPaused) {
    return (
      <div class="container" style={{ maxHeight: '100vh', overflowY: 'auto', padding: '1.5rem', background: 'radial-gradient(circle at 50% 30%, rgba(30, 58, 138, 0.5) 0%, #0b0f19 80%)' }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.4rem', filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.5))' }}>⏸️</div>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#38bdf8', margin: '0 0 0.5rem', letterSpacing: '0.05em' }}>
          OYUN DURAKLATILDI
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '0 0 1.5rem', maxWidth: '340px' }}>
          {rawState?.pauseReason || 'Oda yöneticisi tarafından duraklatıldı.'}
        </p>

        {isHost ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', width: '100%', maxWidth: '340px' }}>
            {/* 1. Oyuna Devam Et */}
            <button
              type="button"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                color: 'white',
                fontWeight: 800,
                fontSize: '1.2rem',
                padding: '1rem',
                borderRadius: '0.9rem',
                cursor: 'pointer',
                margin: 0,
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)'
              }}
              onClick={() => sdk.resumeGame()}
            >
              ▶️ Oyuna Devam Et
            </button>

            {/* 2. Durdurma Ekranında Oyun Değiştir */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '1rem', padding: '0.9rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 800, marginBottom: '0.6rem' }}>
                🎮 Oyunu Değiştir (Yeni Oyun Seç):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {[
                  { id: 'reaction-rush', label: '⚡ Refleks' },
                  { id: 'quiz-arena', label: '🧠 Quiz' },
                  { id: 'mini-football', label: '⚽ Futbol' },
                  { id: 'bluff-trivia', label: '🎭 Blöf' },
                  { id: 'mini-tetris', label: '🧱 Tetris' },
                  { id: 'lost-and-found', label: '🧸 L&F' },
                  { id: 'rc-rush', label: '🏎️ RC Rush' },
                  { id: 'transfer-showdown', label: '⚽ Showdown' }
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    style={{
                      background: (activeGameId || selectedGameId) === g.id ? '#2563eb' : '#0f172a',
                      border: `1.5px solid ${(activeGameId || selectedGameId) === g.id ? '#60a5fa' : '#334155'}`,
                      color: 'white',
                      padding: '0.55rem 0.2rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderRadius: '0.5rem',
                      margin: 0,
                      cursor: 'pointer'
                    }}
                    onClick={() => sdk.selectGame(g.id)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Ana Menüye Dön */}
            <button
              type="button"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontWeight: 800,
                fontSize: '1rem',
                padding: '0.85rem',
                borderRadius: '0.8rem',
                cursor: 'pointer',
                margin: 0
              }}
              onClick={() => sdk.returnToLobby()}
            >
              🏠 Ana Menüye / Lobiye Dön
            </button>
          </div>
        ) : (
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '1rem',
            padding: '1.5rem',
            color: '#e2e8f0',
            fontSize: '0.95rem',
            maxWidth: '320px',
            lineHeight: 1.5
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            Oda yöneticisi oyunu duraklattı. Devam etmesi veya oyunu değiştirmesi bekleniyor...
          </div>
        )}
      </div>
    );
  }

  // ─── 2.5. OYUN İÇİ STAGING (PRE-GAME HUB / ÖZELLEŞTİRME & AYARLAR) ───
  if (gameStatus === 'game_staging') {
    const currentGameId = activeGameId || selectedGameId || 'reaction-rush';
    const currentGameMeta = GAME_METAS[currentGameId] || GAME_METAS['reaction-rush'];

    return (
      <div class="container" style={{ maxHeight: '100vh', overflowY: 'auto', padding: '1rem', justifyContent: 'flex-start' }}>
        {/* Header */}
        <div style={{ width: '100%', maxWidth: '420px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '2rem' }}>{currentGameMeta.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#38bdf8' }}>{currentGameMeta.title}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Oyun İçi Hazırlık & Özelleştirme</div>
            </div>
          </div>
          {isHost && (
            <span style={{ background: 'rgba(250, 204, 21, 0.2)', border: '1px solid #facc15', color: '#facc15', borderRadius: '12px', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 800 }}>
              👑 HOST
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', width: '100%', maxWidth: '420px', background: '#1e293b', borderRadius: '0.8rem', padding: '4px', marginBottom: '1rem', gap: '4px' }}>
          <button
            type="button"
            style={{
              flex: 1,
              background: stagingTab === 'customize' ? '#38bdf8' : 'transparent',
              color: stagingTab === 'customize' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '0.5rem 0.2rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              borderRadius: '0.6rem',
              margin: 0
            }}
            onClick={() => setStagingTab('customize')}
          >
            🎨 Özelleştir
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              background: stagingTab === 'tutorial' ? '#38bdf8' : 'transparent',
              color: stagingTab === 'tutorial' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '0.5rem 0.2rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              borderRadius: '0.6rem',
              margin: 0
            }}
            onClick={() => setStagingTab('tutorial')}
          >
            📖 Nasıl Oynanır
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              background: stagingTab === 'settings' ? '#38bdf8' : 'transparent',
              color: stagingTab === 'settings' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '0.5rem 0.2rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              borderRadius: '0.6rem',
              margin: 0
            }}
            onClick={() => setStagingTab('settings')}
          >
            ⚙️ Ayarlar
          </button>
        </div>

        {/* Tab 1: Özelleştirme */}
        {stagingTab === 'customize' && (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Canlı Avatar Önizleme Hero Kartı */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
              border: `2.5px solid ${myColor}`,
              borderRadius: '1.2rem',
              padding: '1.2rem',
              textAlign: 'center',
              boxShadow: `0 0 25px ${myColor}44, inset 0 0 20px ${myColor}22`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.35s ease'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.08em' }}>
                Canlı Avatar Önizleme
              </div>
              <div style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${myColor}66 0%, #0f172a 85%)`,
                border: `3.5px solid ${myColor}`,
                boxShadow: `0 0 25px ${myColor}88, inset 0 0 15px ${myColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem',
                transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
              }}>
                {COSTUME_ITEMS.find((c) => c.id === myCostume)?.icon || '🏎️'}
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
                  {nickname}
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: `${myColor}25`,
                  border: `1px solid ${myColor}`,
                  borderRadius: '12px',
                  padding: '3px 10px',
                  marginTop: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: myColor,
                  transition: 'all 0.3s ease'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: myColor, boxShadow: `0 0 6px ${myColor}` }} />
                  {COLOR_NAMES[myColor] || 'Seçili Renk'} • {COSTUME_ITEMS.find((c) => c.id === myCostume)?.name || 'Standart'}
                </div>
              </div>
            </div>

            {/* Renk Paleti */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '1rem', padding: '0.9rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e2e8f0' }}>🎨 Renk Paketi Seç:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: myColor }}>{COLOR_NAMES[myColor] || ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{
                      height: '42px',
                      borderRadius: '0.6rem',
                      background: c,
                      border: myColor === c ? '3px solid white' : '1px solid rgba(255,255,255,0.2)',
                      boxShadow: myColor === c ? `0 0 15px ${c}` : 'none',
                      cursor: 'pointer',
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 900
                    }}
                    onClick={() => handleSelectColor(c)}
                  >
                    {myColor === c ? '✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Kostüm Seçimi */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '1rem', padding: '0.9rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '0.6rem' }}>
                👕 Kostüm / Stil Paketi
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {COSTUME_ITEMS.map((cost) => (
                  <button
                    key={cost.id}
                    type="button"
                    style={{
                      background: myCostume === cost.id ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                      border: `1.5px solid ${myCostume === cost.id ? '#38bdf8' : '#334155'}`,
                      borderRadius: '0.6rem',
                      padding: '0.6rem 0.4rem',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      margin: 0
                    }}
                    onClick={() => handleSelectCostume(cost.id)}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{cost.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cost.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Nasıl Oynanır */}
        {stagingTab === 'tutorial' && (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '0.7rem', textAlign: 'left' }}>
            {currentGameMeta.tutorials.map((t, idx) => (
              <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.8rem', padding: '0.8rem', display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
                <span style={{ background: '#38bdf8', color: '#0f172a', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem', flexShrink: 0 }}>
                  {idx + 1}
                </span>
                <div>
                  <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{t.title}</div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.3 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Ayarlar */}
        {stagingTab === 'settings' && (
          <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'left' }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '1rem', padding: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#38bdf8' }}>
                  ⚙️ {currentGameMeta.title} Ayarları
                </div>
                {!isHost && (
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#0f172a', padding: '2px 6px', borderRadius: '4px' }}>
                    Sadece İzleme
                  </span>
                )}
              </div>

              {currentGameId === 'quiz-arena' ? (
                <>
                  {/* Kategori Seçimi */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 700 }}>
                        📚 Soru Kategorileri:
                      </div>
                      {isHost && (
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button
                            type="button"
                            style={{
                              background: '#0284c7',
                              border: 'none',
                              color: 'white',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              margin: 0
                            }}
                            onClick={() => {
                              const allCatIds = QUIZ_CATEGORIES.map((c) => c.id);
                              handleUpdateStageSettings({ selectedCategories: allCatIds });
                            }}
                          >
                            Tümü
                          </button>
                          <button
                            type="button"
                            style={{
                              background: '#334155',
                              border: 'none',
                              color: '#94a3b8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              margin: 0
                            }}
                            onClick={() => {
                              handleUpdateStageSettings({ selectedCategories: ['genel'] });
                            }}
                          >
                            Sıfırla
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                      {QUIZ_CATEGORIES.map((cat) => {
                        const currentCats: string[] = stageSettings.selectedCategories && stageSettings.selectedCategories.length > 0
                          ? stageSettings.selectedCategories
                          : ['bilim', 'tarih', 'cografya', 'sinema', 'oyun', 'spor', 'genel'];
                        const isSelected = currentCats.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            disabled={!isHost}
                            style={{
                              background: isSelected ? 'rgba(14, 165, 233, 0.22)' : '#0f172a',
                              border: `1.5px solid ${isSelected ? '#38bdf8' : '#334155'}`,
                              color: isSelected ? '#ffffff' : '#94a3b8',
                              padding: '0.5rem 0.45rem',
                              fontSize: '0.78rem',
                              fontWeight: isSelected ? 800 : 500,
                              borderRadius: '0.6rem',
                              margin: 0,
                              cursor: isHost ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: isSelected ? '0 0 10px rgba(56, 189, 248, 0.15)' : 'none',
                              opacity: !isHost && !isSelected ? 0.45 : 1
                            }}
                            onClick={() => {
                              if (!isHost) return;
                              let next: string[];
                              if (isSelected) {
                                if (currentCats.length <= 1) return;
                                next = currentCats.filter((id) => id !== cat.id);
                              } else {
                                next = [...currentCats, cat.id];
                              }
                              handleUpdateStageSettings({ selectedCategories: next });
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span>{cat.icon}</span>
                              <span>{cat.name}</span>
                            </span>
                            <span style={{ fontSize: '0.85rem', color: isSelected ? '#38bdf8' : '#475569', marginLeft: '4px' }}>
                              {isSelected ? '✓' : '○'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Soru Sayısı Ayarı */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 700 }}>
                      🔢 Soru Sayısı:
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[5, 10, 15].map((cnt) => {
                        const curCount = stageSettings.questionCount || stageSettings.totalRounds || 5;
                        const isCur = curCount === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            disabled={!isHost}
                            style={{
                              flex: 1,
                              background: isCur ? '#38bdf8' : '#0f172a',
                              color: isCur ? '#0f172a' : 'white',
                              border: `1.5px solid ${isCur ? '#38bdf8' : '#334155'}`,
                              borderRadius: '0.5rem',
                              padding: '0.45rem 0.2rem',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              margin: 0,
                              cursor: isHost ? 'pointer' : 'default',
                              opacity: !isHost && !isCur ? 0.45 : 1
                            }}
                            onClick={() => isHost && handleUpdateStageSettings({ questionCount: cnt, totalRounds: cnt })}
                          >
                            {cnt} Soru
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Soru Başına Süre Ayarı */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 700 }}>
                      ⏱️ Soru Başına Süre:
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[10, 15, 20].map((sec) => {
                        const curLimit = stageSettings.timeLimit || 15;
                        const isCur = curLimit === sec;
                        return (
                          <button
                            key={sec}
                            type="button"
                            disabled={!isHost}
                            style={{
                              flex: 1,
                              background: isCur ? '#38bdf8' : '#0f172a',
                              color: isCur ? '#0f172a' : 'white',
                              border: `1.5px solid ${isCur ? '#38bdf8' : '#334155'}`,
                              borderRadius: '0.5rem',
                              padding: '0.45rem 0.2rem',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              margin: 0,
                              cursor: isHost ? 'pointer' : 'default',
                              opacity: !isHost && !isCur ? 0.45 : 1
                            }}
                            onClick={() => isHost && handleUpdateStageSettings({ timeLimit: sec })}
                          >
                            {sec}sn
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Tur / Soru / Süre Ayarı */}
                  <div style={{ marginBottom: '0.8rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.3rem', fontWeight: 600 }}>
                      Tur / Round Sayısı:
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[3, 5, 7].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={!isHost}
                          style={{
                            flex: 1,
                            background: stageSettings.totalRounds === num ? '#38bdf8' : '#0f172a',
                            color: stageSettings.totalRounds === num ? '#0f172a' : 'white',
                            border: '1px solid #334155',
                            borderRadius: '0.5rem',
                            padding: '0.4rem',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            margin: 0,
                            cursor: isHost ? 'pointer' : 'default'
                          }}
                          onClick={() => isHost && handleUpdateStageSettings({ totalRounds: num })}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zorluk / Hız Ayarı */}
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.3rem', fontWeight: 600 }}>
                      Zorluk / Hız Sınıfı:
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {['normal', 'fast', 'extreme'].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          disabled={!isHost}
                          style={{
                            flex: 1,
                            background: stageSettings.speed === speed ? '#38bdf8' : '#0f172a',
                            color: stageSettings.speed === speed ? '#0f172a' : 'white',
                            border: '1px solid #334155',
                            borderRadius: '0.5rem',
                            padding: '0.4rem',
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            margin: 0,
                            cursor: isHost ? 'pointer' : 'default'
                          }}
                          onClick={() => isHost && handleUpdateStageSettings({ speed })}
                        >
                          {speed === 'normal' ? 'Normal' : speed === 'fast' ? 'Hızlı' : 'Çılgın'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Alt Butonlar */}
        <div style={{ width: '100%', maxWidth: '420px', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <button
            type="button"
            class={isReady ? 'cancel-btn' : 'ready-btn'}
            style={{ height: '60px', fontSize: '1.3rem' }}
            onClick={handleToggleReady}
          >
            {isReady ? 'İPTAL' : '✓ HAZIRIM!'}
          </button>

          {isHost ? (
            <>
              <button
                type="button"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none',
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  padding: '1rem',
                  borderRadius: '0.8rem',
                  cursor: 'pointer',
                  margin: 0,
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.4)'
                }}
                onClick={handleLaunchMatch}
              >
                ▶️ OYUNU BAŞLAT 🎮
              </button>
              <button
                type="button"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '0.6rem',
                  borderRadius: '0.6rem',
                  cursor: 'pointer',
                  margin: 0
                }}
                onClick={handleReturnToLobby}
              >
                🏠 Ana Menüye / Lobiye Dön
              </button>
            </>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', marginTop: '0.4rem' }}>
              👑 Oda yöneticisi maçı başlatınca oyun başlayacak...
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── MINI FOOTBALL GAMEPAD EKRANI ───
  if (
    gameStatus === 'football_playing' ||
    (activeGameId === 'mini-football' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    return renderWithHostOverlay(
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

    return renderWithHostOverlay(
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
    return renderWithHostOverlay(
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
    return renderWithHostOverlay(
      <LostAndFoundGamepad
        sdk={sdk}
        myNickname={nickname}
        myPlayerId={sdk.sessionId}
      />
    );
  }

  // ─── RC RUSH GAMEPAD EKRANI ───
  if (
    gameStatus === 'rc_rush_playing' ||
    (activeGameId === 'rc-rush' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    return renderWithHostOverlay(
      <RcRushGamepad
        sdk={sdk}
        myNickname={nickname}
        myPlayerId={sdk.sessionId}
      />
    );
  }

  // ─── TRANSFER SHOWDOWN CONTROLLER ───
  if (
    gameStatus === 'showdown_playing' ||
    (activeGameId === 'transfer-showdown' && gameStatus !== 'game_over' && gameStatus !== 'lobby')
  ) {
    return renderWithHostOverlay(
      <TransferShowdownController
        sdk={sdk}
        playerId={sdk.sessionId || ''}
      />
    );
  }


  // ─── 3. REACTION RUSH GERİ SAYIM ───
  if (gameStatus === 'countdown') {
    return renderWithHostOverlay(
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
      return renderWithHostOverlay(
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

    return renderWithHostOverlay(
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
        return renderWithHostOverlay(
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

      return renderWithHostOverlay(
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

    return renderWithHostOverlay(
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

    return renderWithHostOverlay(
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

    return renderWithHostOverlay(
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
    return renderWithHostOverlay(
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
