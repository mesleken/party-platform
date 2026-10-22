import { ScreenSDK } from '@platform/sdk-screen';
import QRCode from 'qrcode';
import { FootballRenderer3D } from './FootballRenderer3D';
import { TetrisRenderer } from './TetrisRenderer';
import { LostAndFoundRenderer3D } from './LostAndFoundRenderer3D';
import { RcRushRenderer3D } from './RcRushRenderer3D';
import { FootballManager2DMatchEngine } from './FootballManager2DMatchEngine';
import { TRACK_WAYPOINTS, getNormalizedMiniMapCoords } from '@games/rc-rush';

interface GameStagingInfo {
  icon: string;
  title: string;
  tagline: string;
  tutorials: { num: number; title: string; desc: string }[];
  defaultSettingsSummary: string;
}

const GAME_STAGING_DATA: Record<string, GameStagingInfo> = {
  'reaction-rush': {
    icon: '⚡',
    title: 'REACTION RUSH',
    tagline: 'Saf Refleks & Hızlı Parmaklar • 3 Roundluk Adrenalin',
    tutorials: [
      { num: 1, title: 'Kırmızı Işığa Dikkat Et', desc: 'Ekran kırmızı olduğunda kesinlikle basma! Erken basan faul alır (-40 puan).' },
      { num: 2, title: 'Yeşil Yanınca Bas', desc: 'Yeşil yandığı mikrosaniyede telefonundaki dev butona en hızlı basan en çok puanı kapar!' },
      { num: 3, title: '3 Round Zirvede Kal', desc: 'Her round puanlar katlanır, son ana kadar yarış devam eder!' }
    ],
    defaultSettingsSummary: '🎯 3 Round | ⚡ Standart Hız | ⚠️ Faul Cezası: -40 Puan'
  },
  'quiz-arena': {
    icon: '🧠',
    title: 'QUIZ ARENA',
    tagline: 'Bilgi Savaşı & Hızlı Cevap • Serini Koru!',
    tutorials: [
      { num: 1, title: 'Soruyu Dev Ekranda Oku', desc: 'Her soru için 15 saniye süre verilir. Soruyu dikkatle oku.' },
      { num: 2, title: 'Telefonda Şıkkını Seç', desc: 'Telefonundaki 4 renkli şık arasından doğru cevaba tıkla.' },
      { num: 3, title: 'Streak (Seri) Bonusu Kap', desc: 'Arka arkaya doğru bildikçe ek kombo çarpanı kazanırsın!' }
    ],
    defaultSettingsSummary: '⏱️ Soru Başına 15sn | 📚 5 Soru | 🔥 Streak Çarpanı Aktif'
  },
  'mini-football': {
    icon: '⚽',
    title: 'MINI FOOTBALL',
    tagline: 'Miniclip Tarzı 3D Chibi Arcade Futbol • Joystick, Pas, Şut & Kayma',
    tutorials: [
      { num: 1, title: 'Sol Başparmak: Joystick', desc: 'Sanal joystick ile oyuncunu yönlendir ve sahada pozisyon al.' },
      { num: 2, title: 'Pas, Şut ve Kayma', desc: 'Top sendeyken PAS ve ŞUT butonları, rakipten alırken KAYARAK MÜDAHALE yap.' },
      { num: 3, title: 'Hızlı Oyuncu Değişimi', desc: 'DEĞİŞTİR butonu ile topa en yakın serbest oyuncuya anında geç!' }
    ],
    defaultSettingsSummary: '⏱️ 90sn Maç | 🏟️ Mini Football Stadyumu | ⚽ Telstar 3D Top'
  },
  'bluff-trivia': {
    icon: '🎭',
    title: 'BLUFF TRIVIA',
    tagline: 'Blöf Yap, Rakiplerini Kandır, Doğruyu Bul!',
    tutorials: [
      { num: 1, title: 'İnandırıcı Bir Yalan Yaz', desc: 'Garip gerçeğe kimsenin inanmayacağı zekice bir sahte cevap uydur.' },
      { num: 2, title: 'Gerçek Cevabı Tahmin Et', desc: 'Tüm oyuncuların cevapları ve gerçek cevap listelenir. Doğruyu bul!' },
      { num: 3, title: 'Rakipleri Kandırınca +Puan', desc: 'Senin yalanına inanan her rakip için sen ekstra puan kazanırsın!' }
    ],
    defaultSettingsSummary: '🎭 3 Round | ⏳ 25sn Blöf Süresi | 💡 Arkadaş Modu Destekli'
  },
  'mini-tetris': {
    icon: '🧱',
    title: 'MINI TETRIS',
    tagline: 'Battle Royale Tetris • Satır Temizle, Rakibe Çöp Gönder!',
    tutorials: [
      { num: 1, title: 'D-Pad ile Blokları Yönet', desc: 'Sol/Sağ ile hareket ettir, Döndür ile çevir, Hızlı Düşür ile kilitle.' },
      { num: 2, title: 'Çoklu Satır Temizle', desc: '2 veya daha fazla satır temizlediğinde diğer oyuncuların tahtasına çöp blok gider!' },
      { num: 3, title: 'Son Ayakta Kalan Kazanır', desc: 'Tavanı aşan elenir. En uzun süre hayatta kalan tahtı alır!' }
    ],
    defaultSettingsSummary: '⚔️ Battle Royale Modu | 🧱 Hızlı Çöp Gönderimi | ⚡ Artan Hız'
  },
  'lost-and-found': {
    icon: '🧸',
    title: 'LOST & FOUND',
    tagline: 'It Takes Two Tarzı 2 Kişilik Ortak Macera • Mıknatıs, Kanca & Kasa',
    tutorials: [
      { num: 1, title: 'Milo (Mıknatıs) & Nia (Kanca)', desc: 'Oyuncu 1 metal nesneleri iter/çeker, Oyuncu 2 makaralı kanca ile yüksek yerlere tutunur.' },
      { num: 2, title: 'Baskı Plakaları & Lazerler', desc: 'Birlikte hareket edin. Biriniz düğmeye basarken diğeri açılan kapıdan geçmeli.' },
      { num: 3, title: 'Kasa Açma Eşleşmesi', desc: 'Son aşamada iki oyuncu da telefonlarındaki frekans ve fazı senkronize ederek kasayı açar!' }
    ],
    defaultSettingsSummary: '🤝 2 Kişilik Co-Op | ⏱️ Seviye Süresi: 60sn | 🗝️ Bulmaca Odası 1'
  },
  'rc-rush': {
    icon: '🏎️',
    title: 'RC RUSH',
    tagline: 'Re-Volt Ruhu • Dev Masaüstü & Oyuncak Odası 3D Arcade Yarış',
    tutorials: [
      { num: 1, title: 'Gaz & Analog Direksiyon', desc: 'Hassas arcade kontrolleriyle keskin virajları dön, rampalardan zıpla.' },
      { num: 2, title: 'Alevli Nitro Turbo', desc: 'Düzlüklerde ve rakipleri sollarken NİTRO butonuna basarak maksimum hıza ulaş.' },
      { num: 3, title: 'Gizemli Güç Kutuları', desc: 'Pistteki dönen kutulardan Roket, Yağ Birikintisi veya Kalkan kazanıp rakiplerini avla!' }
    ],
    defaultSettingsSummary: '🏁 3 Tur Yarış | ⚡ Süper Hız Sınıfı | 🚀 Güç Kutuları Açık'
  },
  'transfer-showdown': {
    icon: '⚽',
    title: 'TRANSFER SHOWDOWN',
    tagline: 'Açık Artırma Menajerlik & 3D Canlı Maç Düellosu • 100 Kredi, Taktik ve 90 Dakika',
    tutorials: [
      { num: 1, title: 'Açık Artırmayı Yönet', desc: '100 krediyle 11 kişilik kadro kur. Bütçe korumasına ve mevki kotalarına dikkat et.' },
      { num: 2, title: 'Diziliş ve Oyun Stili', desc: '4-3-3, 4-4-2 gibi dizilişlerle oyuncu mevkilerini eşle, oyun tarzınla rakibe üstünlük sağla.' },
      { num: 3, title: '3D Maçı İzle & Müdahale Et', desc: 'Dev ekranda kritik pozisyonları izle, devrede taktiğini değiştir, son 15 dakika tüm hatlarınla saldır!' }
    ],
    defaultSettingsSummary: '💰 100 Kredi Bütçe | ⏱️ Hızlı Maç | 🏆 11 Futbolcu'
  }
};

const COSTUME_LABELS: Record<string, string> = {
  standard: '🏎️ Standart',
  retro_racer: '🕹️ Retro 90s',
  cyber_neon: '⚡ Cyber Neon',
  stealth_shadow: '🥷 Gizli Gölge',
  golden_legend: '🏆 Altın Efsane',
  toxic_surge: '☣️ Zehirli Fırtına'
};

const COSTUME_ICONS: Record<string, string> = {
  standard: '🏎️',
  retro_racer: '🕹️',
  cyber_neon: '⚡',
  stealth_shadow: '🥷',
  golden_legend: '🏆',
  toxic_surge: '☣️'
};

const COLOR_NAMES: Record<string, string> = {
  '#ef4444': 'Kırmızı',
  '#3b82f6': 'Mavi',
  '#10b981': 'Yeşil',
  '#f59e0b': 'Sarı',
  '#8b5cf6': 'Mor',
  '#ec4899': 'Pembe',
  '#06b6d4': 'Turkuaz',
  '#84cc16': 'Fıstık'
};

function getCostumeIcon(costume?: string): string {
  if (!costume) return '⚡';
  return COSTUME_ICONS[costume] || '⚡';
}

async function bootstrap() {
  const statusView = document.getElementById('status-view')!;
  const lobbyView = document.getElementById('lobby-view')!;
  const stagingView = document.getElementById('staging-view')!;
  const gameView = document.getElementById('game-view')!;
  const quizView = document.getElementById('quiz-view')!;
  const footballView = document.getElementById('football-view')!;
  const lostAndFoundView = document.getElementById('lost-and-found-view')!;
  const rcRushView = document.getElementById('rc-rush-view')!;
  const showdownView = document.getElementById('showdown-view')!;
  const resultView = document.getElementById('result-view')!;
  const gameoverView = document.getElementById('gameover-view')!;

  const displayRoomCode = document.getElementById('display-room-code')!;
  const gameRoomCode = document.getElementById('game-room-code')!;
  const qrCanvas = document.getElementById('qr-code') as HTMLCanvasElement;
  const playersList = document.getElementById('players-list')!;
  const playerCount = document.getElementById('player-count')!;
  const startGameBtn = document.getElementById('start-game-btn')!;
  const returnLobbyBtn = document.getElementById('return-lobby-btn')!;

  // Staging Elements
  const stagingGameIcon = document.getElementById('staging-game-icon')!;
  const stagingGameTitle = document.getElementById('staging-game-title')!;
  const stagingGameTagline = document.getElementById('staging-game-tagline')!;
  const stagingTutorialCards = document.getElementById('staging-tutorial-cards')!;
  const stagingSettingsBadge = document.getElementById('staging-settings-badge')!;
  const stagingPlayersGrid = document.getElementById('staging-players-grid')!;
  const stagingLaunchBtn = document.getElementById('staging-launch-btn')!;
  const stagingLobbyBtn = document.getElementById('staging-lobby-btn')!;

  // Pause Elements
  const pauseOverlay = document.getElementById('pause-overlay')!;
  const pauseReasonText = document.getElementById('pause-reason-text')!;
  const pauseResumeBtn = document.getElementById('pause-resume-btn')!;
  const pauseSwitchBtn = document.getElementById('pause-switch-btn')!;
  const pauseLobbyBtn = document.getElementById('pause-lobby-btn')!;

  // Game Selector Cards & Carousel
  const gamesCarousel = document.getElementById('games-carousel')!;
  const carouselBtnPrev = document.getElementById('carousel-btn-prev');
  const carouselBtnNext = document.getElementById('carousel-btn-next');
  const cardReactionRush = document.getElementById('card-reaction-rush')!;
  const cardQuizArena = document.getElementById('card-quiz-arena')!;
  const cardMiniFootball = document.getElementById('card-mini-football')!;
  const cardBluffTrivia = document.getElementById('card-bluff-trivia')!;
  const cardMiniTetris = document.getElementById('card-mini-tetris')!;
  const cardLostAndFound = document.getElementById('card-lost-and-found')!;
  const cardRcRush = document.getElementById('card-rc-rush')!;
  const cardTransferShowdown = document.getElementById('card-transfer-showdown')!;

  // RC Rush Elements
  const rcRushCanvasContainer = document.getElementById('rc-rush-canvas-container')!;
  const rcRushLapBadge = document.getElementById('rc-rush-lap-badge')!;
  const rcRushTimer = document.getElementById('rc-rush-timer')!;
  const rcRushBestLap = document.getElementById('rc-rush-best-lap')!;
  const rcRushEventBanner = document.getElementById('rc-rush-event-banner')!;
  const rcRushEventText = document.getElementById('rc-rush-event-text')!;
  const rcRushPosition = document.getElementById('rc-rush-position')!;
  const rcRushTotalRacers = document.getElementById('rc-rush-total-racers')!;
  const rcRushLeaderboardList = document.getElementById('rc-rush-leaderboard-list')!;
  const rcRushMinimap = document.getElementById('rc-rush-minimap') as HTMLCanvasElement;
  const rcRushSpeed = document.getElementById('rc-rush-speed')!;
  const rcRushBoostNum = document.getElementById('rc-rush-boost-num')!;
  const rcRushBoostBar = document.getElementById('rc-rush-boost-bar')!;
  const rcRushItemIcon = document.getElementById('rc-rush-item-icon')!;
  const rcRushWeaponSlot = document.getElementById('rc-rush-weapon-slot');
  const rcRushRpmDots = document.querySelectorAll<HTMLElement>('.rc-rpm-dot');
  const rcRushCountdownBanner = document.getElementById('rc-rush-countdown-banner')!;
  const rcRushCountdownNum = document.getElementById('rc-rush-countdown-num')!;
  const rcRushWrongwayBanner = document.getElementById('rc-rush-wrongway-banner')!;
  let rcRushRenderer: RcRushRenderer3D | null = null;
  let rcRushBannerTimeout: any = null;
  let rcRushRouletteInterval: any = null;
  let rcRushIsRouletteActive = false;

  function triggerRcWeaponRoulette(awardedItem: string) {
    if (rcRushRouletteInterval) clearInterval(rcRushRouletteInterval);
    rcRushIsRouletteActive = true;
    const items = ['🚀', '⚡', '🛢️', '🛡️'];
    const itemIcons: Record<string, string> = {
      rocket: '🚀',
      turbo: '⚡',
      oil: '🛢️',
      shield: '🛡️',
    };
    let spins = 0;
    const maxSpins = 14;
    if (rcRushWeaponSlot) {
      rcRushWeaponSlot.style.borderColor = '#38bdf8';
      rcRushWeaponSlot.style.boxShadow = '0 0 30px #38bdf8';
      rcRushWeaponSlot.style.transform = 'scale(1.1)';
    }

    rcRushRouletteInterval = setInterval(() => {
      spins++;
      const randIcon = items[spins % items.length];
      if (rcRushItemIcon) rcRushItemIcon.innerText = randIcon;

      if (spins >= maxSpins) {
        clearInterval(rcRushRouletteInterval);
        rcRushRouletteInterval = null;
        rcRushIsRouletteActive = false;
        const finalIcon = itemIcons[awardedItem] || '📦';
        if (rcRushItemIcon) rcRushItemIcon.innerText = finalIcon;
        if (rcRushWeaponSlot) {
          rcRushWeaponSlot.style.borderColor = '#facc15';
          rcRushWeaponSlot.style.boxShadow = '0 0 25px rgba(250,204,21,0.5)';
          rcRushWeaponSlot.style.transform = 'scale(1.0)';
        }
      }
    }, 70);
  }

  // Lost & Found Elements
  const lostAndFoundCanvasContainer = document.getElementById('lost-and-found-canvas-container')!;
  const lafObjectiveText = document.getElementById('laf-objective-text')!;
  const lafTimer = document.getElementById('laf-timer')!;
  const lafMinigameOverlay = document.getElementById('laf-minigame-overlay')!;
  const lafSyncBar = document.getElementById('laf-sync-bar')!;
  const lafSyncPercent = document.getElementById('laf-sync-percent')!;
  const lafMiloVal = document.getElementById('laf-milo-val')!;
  const lafNiaVal = document.getElementById('laf-nia-val')!;
  const lafPlayerANickname = document.getElementById('laf-player-a-nickname');
  const lafPlayerBNickname = document.getElementById('laf-player-b-nickname');
  const lafPlayerAAbility = document.getElementById('laf-player-a-ability');
  const lafPlayerBAbility = document.getElementById('laf-player-b-ability');
  const lafPlayerACooldown = document.getElementById('laf-player-a-cooldown');
  const lafPlayerBCooldown = document.getElementById('laf-player-b-cooldown');
  const lafPlayerAStatus = document.getElementById('laf-player-a-status');
  const lafPlayerBStatus = document.getElementById('laf-player-b-status');
  const lafLevelBadge = document.getElementById('laf-level-badge');
  const lafStar1 = document.getElementById('laf-star-1');
  const lafStar2 = document.getElementById('laf-star-2');
  const lafStar3 = document.getElementById('laf-star-3');
  const lafCollectiblesCollected = document.getElementById('laf-collectibles-collected');
  const lafCollectiblesTotal = document.getElementById('laf-collectibles-total');
  const lafPingsContainer = document.getElementById('laf-pings-container');
  const lafLevelComplete = document.getElementById('laf-level-complete');
  const lafCompleteTime = document.getElementById('laf-complete-time');
  const lafCompleteScore = document.getElementById('laf-complete-score');
  const lafCompleteCollectibles = document.getElementById('laf-complete-collectibles');
  const lafGoalNotification = document.getElementById('laf-goal-notification');
  const lafGoalText = document.getElementById('laf-goal-text');
  const lafInteractPrompt = document.getElementById('laf-interact-prompt');
  void lafInteractPrompt;
  const lafBtnMap = document.getElementById('laf-btn-map');
  const lafBtnPause = document.getElementById('laf-btn-pause');
  const lafPauseModal = document.getElementById('laf-pause-modal');
  const lafPauseResumeBtn = document.getElementById('laf-pause-resume-btn');
  const lafPauseRestartBtn = document.getElementById('laf-pause-restart-btn');
  const lafPauseMapBtn = document.getElementById('laf-pause-map-btn');
  const lafPauseControlsBtn = document.getElementById('laf-pause-controls-btn');
  const lafPauseLobbyBtn = document.getElementById('laf-pause-lobby-btn');
  const lafMapModal = document.getElementById('laf-map-modal');
  const lafMapCloseBtn = document.getElementById('laf-map-close-btn');
  const lafMapCardTag = document.getElementById('laf-map-card-tag');
  const lafMapCardTitle = document.getElementById('laf-map-card-title');
  const lafMapCardDesc = document.getElementById('laf-map-card-desc');
  const lafMapPlaySelectedBtn = document.getElementById('laf-map-play-selected-btn');
  const lafControlsModal = document.getElementById('laf-controls-modal');
  const lafControlsCloseBtn = document.getElementById('laf-controls-close-btn');
  const lafControlsGotItBtn = document.getElementById('laf-controls-got-it-btn');
  const lafCompleteNextBtn = document.getElementById('laf-complete-next-btn');
  const lafCompleteReplayBtn = document.getElementById('laf-complete-replay-btn');
  const lafCompleteMapBtn = document.getElementById('laf-complete-map-btn');

  let selectedMapLevel = 1;
  let lostAndFoundRenderer: LostAndFoundRenderer3D | null = null;
  let lafPrevVaultOpen = false;
  let lafCurrentLevelIdx = 1;

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

  // Transfer Showdown Elements & Renderer
  const showdownCanvasContainer = document.getElementById('showdown-canvas-container')!;
  const showdownAuctionOverlay = document.getElementById('showdown-auction-overlay')!;
  const showdownTacticsOverlay = document.getElementById('showdown-tactics-overlay')!;
  const showdownMatchOverlay = document.getElementById('showdown-match-overlay')!;
  const showdownAnalysisOverlay = document.getElementById('showdown-analysis-overlay')!;

  const showdownLotCounter = document.getElementById('showdown-lot-counter')!;
  const showdownAuctionTimer = document.getElementById('showdown-auction-timer')!;
  const showdownAuctionBid = document.getElementById('showdown-auction-bid')!;
  const showdownAuctionBidder = document.getElementById('showdown-auction-bidder')!;

  const showdownBenchAvatar0 = document.getElementById('showdown-bench-avatar-0')!;
  const showdownBenchName0 = document.getElementById('showdown-bench-name-0')!;
  const showdownBenchBudget0 = document.getElementById('showdown-bench-budget-0')!;
  const showdownBenchRoster0 = document.getElementById('showdown-bench-roster-0')!;
  const showdownBenchStatus0 = document.getElementById('showdown-bench-status-0')!;

  const showdownBenchAvatar1 = document.getElementById('showdown-bench-avatar-1')!;
  const showdownBenchName1 = document.getElementById('showdown-bench-name-1')!;
  const showdownBenchBudget1 = document.getElementById('showdown-bench-budget-1')!;
  const showdownBenchRoster1 = document.getElementById('showdown-bench-roster-1')!;
  const showdownBenchStatus1 = document.getElementById('showdown-bench-status-1')!;

  const showdownPackTier = document.getElementById('showdown-pack-tier');
  const showdownPackName = document.getElementById('showdown-pack-name')!;
  const showdownPackOpening = document.getElementById('showdown-pack-opening')!;
  const showdownDraftBanner = document.getElementById('showdown-draft-banner')!;
  const showdownTurnStarterBadge = document.getElementById('showdown-turn-starter-badge');
  const showdownBenchQuotas0 = document.getElementById('showdown-bench-quotas-0');
  const showdownBenchQuotas1 = document.getElementById('showdown-bench-quotas-1');
  const showdownFmPosText0 = document.getElementById('showdown-fm-pos-text-0');
  const showdownFmPosText1 = document.getElementById('showdown-fm-pos-text-1');
  const showdownFmPosBar0 = document.getElementById('showdown-fm-pos-bar-0');
  const showdownFmPosBar1 = document.getElementById('showdown-fm-pos-bar-1');
  const showdownFmXg0 = document.getElementById('showdown-fm-xg-0');
  const showdownFmXg1 = document.getElementById('showdown-fm-xg-1');

  const showdownTacticsTimer = document.getElementById('showdown-tactics-timer')!;
  const showdownTacticsName0 = document.getElementById('showdown-tactics-name-0')!;
  const showdownTacticsForm0 = document.getElementById('showdown-tactics-form-0')!;
  const showdownTacticsSynergy0 = document.getElementById('showdown-tactics-synergy-0')!;
  const showdownTacticsName1 = document.getElementById('showdown-tactics-name-1')!;
  const showdownTacticsForm1 = document.getElementById('showdown-tactics-form-1')!;
  const showdownTacticsSynergy1 = document.getElementById('showdown-tactics-synergy-1')!;

  const showdownScoreTeam0 = document.getElementById('showdown-score-team-0')!;
  const showdownScoreNum0 = document.getElementById('showdown-score-num-0')!;
  const showdownScoreTeam1 = document.getElementById('showdown-score-team-1')!;
  const showdownScoreNum1 = document.getElementById('showdown-score-num-1')!;
  const showdownMatchMinute = document.getElementById('showdown-match-minute')!;
  const showdownCommentaryTitle = document.getElementById('showdown-commentary-title')!;
  const showdownCommentarySub = document.getElementById('showdown-commentary-sub')!;
  const showdownEventBadge = document.getElementById('showdown-event-badge')!;
  const showdownPhaseBadge = document.getElementById('showdown-phase-badge');
  const showdownMentality0 = document.getElementById('showdown-mentality-0');
  const showdownMentality1 = document.getElementById('showdown-mentality-1');
  const showdownShoutBanner = document.getElementById('showdown-shout-banner');
  const showdownTimelineProgress = document.getElementById('showdown-timeline-progress');
  const showdownTimelineIcons = document.getElementById('showdown-timeline-icons');

  const showdownFinalWinnerTitle = document.getElementById('showdown-final-winner-title')!;
  const showdownFinalScoreText = document.getElementById('showdown-final-score-text')!;
  const showdownAnalysisStatsTable = document.getElementById('showdown-analysis-stats-table')!;
  const showdownMvpName = document.getElementById('showdown-mvp-name')!;
  const showdownMvpRating = document.getElementById('showdown-mvp-rating')!;
  const showdownMvpDesc = document.getElementById('showdown-mvp-desc')!;

  let showdownRenderer: FootballManager2DMatchEngine | null = null;

  // Result & Game Over Elements
  const resultTitle = document.getElementById('result-title')!;
  const resultScoreList = document.getElementById('result-score-list')!;
  const finalScoreList = document.getElementById('final-score-list')!;
  const winnerName = document.getElementById('winner-name')!;

  try {
    const serverUrl =
      (import.meta as any).env?.VITE_SERVER_URL ||
      (window.location.port === '5173'
        ? `http://${window.location.hostname}:2567`
        : `${window.location.protocol}//${window.location.host}`);

    const sdk = new ScreenSDK(serverUrl);
    const roomCode = await sdk.createSession();

    statusView.style.display = 'none';
    lobbyView.style.display = 'flex';
    displayRoomCode.innerText = roomCode;
    gameRoomCode.innerText = `ODA: ${roomCode}`;

    // QR Kod Oluştur
    const controllerBase =
      (import.meta as any).env?.VITE_CONTROLLER_URL ||
      (window.location.port === '5173'
        ? `${window.location.protocol}//${window.location.hostname}:5174/join`
        : `${window.location.protocol}//${window.location.host}/play`);

    const joinUrl = `${controllerBase}?code=${roomCode}`;
    await QRCode.toCanvas(qrCanvas, joinUrl, {
      width: 120,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    // Carousel Yatay Kaydırma Kontrolleri (Ok Butonları, Fare Tekerleği ve Sürükleme)
    if (carouselBtnPrev) {
      carouselBtnPrev.onclick = () => {
        gamesCarousel.scrollBy({ left: -260, behavior: 'smooth' });
      };
    }
    if (carouselBtnNext) {
      carouselBtnNext.onclick = () => {
        gamesCarousel.scrollBy({ left: 260, behavior: 'smooth' });
      };
    }

    gamesCarousel.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        gamesCarousel.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    let isCarouselDown = false;
    let carouselStartX = 0;
    let carouselScrollLeft = 0;
    let isCarouselDragging = false;

    gamesCarousel.addEventListener('mousedown', (e) => {
      isCarouselDown = true;
      isCarouselDragging = false;
      carouselStartX = e.pageX - gamesCarousel.offsetLeft;
      carouselScrollLeft = gamesCarousel.scrollLeft;
    });

    gamesCarousel.addEventListener('mouseleave', () => {
      isCarouselDown = false;
    });

    gamesCarousel.addEventListener('mouseup', () => {
      isCarouselDown = false;
      setTimeout(() => {
        isCarouselDragging = false;
      }, 50);
    });

    gamesCarousel.addEventListener('mousemove', (e) => {
      if (!isCarouselDown) return;
      e.preventDefault();
      const x = e.pageX - gamesCarousel.offsetLeft;
      const walk = (x - carouselStartX) * 1.5;
      if (Math.abs(walk) > 5) {
        isCarouselDragging = true;
      }
      gamesCarousel.scrollLeft = carouselScrollLeft - walk;
    });

    // Oyun Seçimi (Lobi)
    const handleGameCardClick = (gameId: string) => {
      if (isCarouselDragging) return;
      sdk.selectGame(gameId);
    };

    cardReactionRush.onclick = () => handleGameCardClick('reaction-rush');
    cardQuizArena.onclick = () => handleGameCardClick('quiz-arena');
    cardMiniFootball.onclick = () => handleGameCardClick('mini-football');
    cardBluffTrivia.onclick = () => handleGameCardClick('bluff-trivia');
    cardMiniTetris.onclick = () => handleGameCardClick('mini-tetris');
    cardLostAndFound.onclick = () => handleGameCardClick('lost-and-found');
    cardRcRush.onclick = () => handleGameCardClick('rc-rush');
    cardTransferShowdown.onclick = () => handleGameCardClick('transfer-showdown');

    // Buton Eylemleri
    startGameBtn.onclick = () => {
      sdk.startGame();
    };

    returnLobbyBtn.onclick = () => {
      sdk.returnToLobby();
    };

    stagingLaunchBtn.onclick = () => {
      sdk.launchMatch();
    };

    stagingLobbyBtn.onclick = () => {
      sdk.returnToLobby();
    };

    pauseResumeBtn.onclick = () => {
      sdk.resumeGame();
    };

    pauseSwitchBtn.onclick = () => {
      sdk.returnToLobby();
    };

    pauseLobbyBtn.onclick = () => {
      sdk.returnToLobby();
    };

    // ─── Lost & Found Co-Op Modals & Controls ───
    const lafLevelData: Record<number, { tag: string; title: string; desc: string }> = {
      1: {
        tag: 'Bölüm 1',
        title: 'Atölye Girişi & Güç Çekirdeği',
        desc: 'Mıknatıs ile metal sandığı taşıyın, kanca ile yüksek halkalardan geçin.',
      },
      2: {
        tag: 'Bölüm 2',
        title: 'Buhar Uçurumu & Çift Basınç',
        desc: 'Jeneratöre güç çekirdeğini yerleştirin, asansörle yüksek köprüye çıkın.',
      },
      3: {
        tag: 'Bölüm 3',
        title: 'Büyük Kasa & Frekans Kilidi',
        desc: 'Kasa terminaline ulaşın, telefonlarınızdan frekans ve fazı eşleştirin.',
      },
    };

    if (lafBtnMap && lafMapModal) {
      lafBtnMap.onclick = () => {
        lafMapModal.style.display = 'flex';
      };
    }
    if (lafMapCloseBtn && lafMapModal) {
      lafMapCloseBtn.onclick = () => {
        lafMapModal.style.display = 'none';
      };
    }

    // Map Node Clicks
    document.querySelectorAll('.laf-map-trail-node').forEach((node) => {
      node.addEventListener('click', () => {
        const lvl = parseInt(node.getAttribute('data-level') || '1', 10);
        if (lvl > 3) return; // Locked levels
        selectedMapLevel = lvl;

        document.querySelectorAll('.laf-map-trail-node').forEach((n) => {
          n.classList.remove('laf-node-active');
        });
        node.classList.add('laf-node-active');

        const info = lafLevelData[lvl];
        if (info) {
          if (lafMapCardTag) lafMapCardTag.innerText = info.tag;
          if (lafMapCardTitle) lafMapCardTitle.innerText = info.title;
          if (lafMapCardDesc) lafMapCardDesc.innerText = info.desc;
        }
      });
    });

    if (lafMapPlaySelectedBtn && lafMapModal) {
      lafMapPlaySelectedBtn.onclick = () => {
        sdk.send('LAF_SELECT_LEVEL', { levelIndex: selectedMapLevel });
        lafMapModal.style.display = 'none';
      };
    }

    // Pause Modal
    if (lafBtnPause && lafPauseModal) {
      lafBtnPause.onclick = () => {
        lafPauseModal.style.display = 'flex';
      };
    }
    if (lafPauseResumeBtn && lafPauseModal) {
      lafPauseResumeBtn.onclick = () => {
        lafPauseModal.style.display = 'none';
      };
    }
    if (lafPauseRestartBtn && lafPauseModal) {
      lafPauseRestartBtn.onclick = () => {
        lafPauseModal.style.display = 'none';
        sdk.send('RESTART_GAME');
      };
    }
    if (lafPauseMapBtn && lafPauseModal && lafMapModal) {
      lafPauseMapBtn.onclick = () => {
        lafPauseModal.style.display = 'none';
        lafMapModal.style.display = 'flex';
      };
    }
    if (lafPauseControlsBtn && lafPauseModal && lafControlsModal) {
      lafPauseControlsBtn.onclick = () => {
        lafPauseModal.style.display = 'none';
        lafControlsModal.style.display = 'flex';
      };
    }
    if (lafPauseLobbyBtn && lafPauseModal) {
      lafPauseLobbyBtn.onclick = () => {
        lafPauseModal.style.display = 'none';
        sdk.returnToLobby();
      };
    }

    // Controls Guide Modal
    if (lafControlsCloseBtn && lafControlsModal) {
      lafControlsCloseBtn.onclick = () => {
        lafControlsModal.style.display = 'none';
      };
    }
    if (lafControlsGotItBtn && lafControlsModal) {
      lafControlsGotItBtn.onclick = () => {
        lafControlsModal.style.display = 'none';
      };
    }

    // Level Complete Modal Actions
    if (lafCompleteNextBtn && lafLevelComplete) {
      lafCompleteNextBtn.onclick = () => {
        const nextLvl = (lafCurrentLevelIdx % 3) + 1;
        sdk.send('LAF_SELECT_LEVEL', { levelIndex: nextLvl });
        lafLevelComplete.style.display = 'none';
      };
    }
    if (lafCompleteReplayBtn && lafLevelComplete) {
      lafCompleteReplayBtn.onclick = () => {
        sdk.send('RESTART_GAME');
        lafLevelComplete.style.display = 'none';
      };
    }
    if (lafCompleteMapBtn && lafLevelComplete && lafMapModal) {
      lafCompleteMapBtn.onclick = () => {
        lafLevelComplete.style.display = 'none';
        lafMapModal.style.display = 'flex';
      };
    }

    // Sunucu Durumunu Dinle
    sdk.onStateChange = (state) => {
      const status = state.status;
      const playersArray: any[] = [];
      state.players.forEach((p) => playersArray.push(p));

      // Global Duraklatma (Pause) Overlay
      pauseOverlay.style.display = state.isPaused ? 'flex' : 'none';
      if (state.isPaused) {
        pauseReasonText.innerText = state.pauseReason || 'Oda yöneticisi oyunu duraklattı.';
      }

      stagingView.style.display = status === 'game_staging' ? 'flex' : 'none';

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
        if (rcRushRenderer) {
          rcRushRenderer.dispose();
          rcRushRenderer = null;
        }
        if (showdownRenderer) {
          showdownRenderer.destroy();
          showdownRenderer = null;
        }

        lobbyView.style.display = 'flex';
        stagingView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        lostAndFoundView.style.display = 'none';
        rcRushView.style.display = 'none';
        showdownView.style.display = 'none';
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
        cardRcRush.classList.toggle('selected', selected === 'rc-rush');
        cardTransferShowdown.classList.toggle('selected', selected === 'transfer-showdown');

        // Seçilen kartı yumuşakça odak noktasına kaydır
        const activeCard = document.getElementById(`card-${selected}`);
        if (activeCard && gamesCarousel) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        playersList.innerHTML = '';
        playersArray.forEach((p) => {
          const card = document.createElement('div');
          card.className = `player-card ${p.isReady ? 'ready' : ''}`;
          const hostBadge = p.isHost ? '👑 ' : '';
          const readyBadge = p.isReady
            ? '<span style="color:#22c55e; font-weight:800; font-size:0.85rem;">✓ HAZIR</span>'
            : '<span style="color:#94a3b8; font-weight:600; font-size:0.85rem;">⏳ BEKLİYOR</span>';

          const pColor = p.color || '#3b82f6';
          const avatarIcon = getCostumeIcon(p.costume);
          const colorName = COLOR_NAMES[pColor] || 'Özel';

          card.innerHTML = `
            <div class="player-card-content">
              <div class="player-card-avatar" style="background: radial-gradient(circle at 35% 35%, ${pColor}44 0%, #0f172a 90%); border: 2.5px solid ${pColor}; box-shadow: 0 0 12px ${pColor}66;">
                ${avatarIcon}
              </div>
              <div class="player-name-col">
                <div style="color:#f8fafc; font-weight:800; font-size:1.1rem;">${hostBadge}${p.nickname}</div>
                <div class="player-card-color-tag" style="color:${pColor};">
                  <span style="width:6px; height:6px; border-radius:50%; background:${pColor}; display:inline-block;"></span>
                  ${colorName}
                </div>
              </div>
            </div>
            <div>${readyBadge}</div>
          `;
          playersList.appendChild(card);
        });

        playerCount.innerText = playersArray.length.toString();
        return;
      }

      // ─── 1.5. OYUN İÇİ STAGING / ÖZELLEŞTİRME & TUTORIAL DURUMU ───
      if (status === 'game_staging') {
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
        if (rcRushRenderer) {
          rcRushRenderer.dispose();
          rcRushRenderer = null;
        }

        lobbyView.style.display = 'none';
        stagingView.style.display = 'flex';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        lostAndFoundView.style.display = 'none';
        rcRushView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';

        const gameId = state.activeGameId || state.selectedGameId || 'reaction-rush';
        const gameInfo = GAME_STAGING_DATA[gameId] || GAME_STAGING_DATA['reaction-rush'];

        stagingGameIcon.innerText = gameInfo.icon;
        stagingGameTitle.innerText = gameInfo.title;
        stagingGameTagline.innerText = gameInfo.tagline;

        // Tutorial Kartlarını Doldur
        stagingTutorialCards.innerHTML = '';
        gameInfo.tutorials.forEach((tut) => {
          const card = document.createElement('div');
          card.className = 'staging-card';
          card.innerHTML = `
            <div class="staging-card-num">${tut.num}</div>
            <div>
              <div class="staging-card-title">${tut.title}</div>
              <div class="staging-card-desc">${tut.desc}</div>
            </div>
          `;
          stagingTutorialCards.appendChild(card);
        });

        // Oyun Ayarları Özeti
        let settingsSummary = gameInfo.defaultSettingsSummary;
        try {
          if (state.stageSettings) {
            const parsed = JSON.parse(state.stageSettings);
            if (gameId === 'quiz-arena') {
              const qCount = parsed.questionCount || parsed.totalRounds || 5;
              const tLimit = parsed.timeLimit || 15;
              const cats: string[] = parsed.selectedCategories || [];
              const catIcons: Record<string, string> = {
                bilim: '🔬 Bilim',
                tarih: '📜 Tarih',
                cografya: '🌍 Coğrafya',
                sinema: '🎬 Sinema',
                oyun: '🎮 Oyun',
                spor: '⚽ Spor',
                genel: '💡 Genel'
              };
              const catNames = !cats || cats.length === 0 || cats.length === 7
                ? '🌐 Tüm Kategoriler (7)'
                : cats.map((c) => catIcons[c] || c).join(', ');
              settingsSummary = `📚 ${catNames} | 🔢 ${qCount} Soru | ⏱️ ${tLimit}s`;
            } else {
              const pairs = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(' | ');
              if (pairs) settingsSummary = pairs;
            }
          }
        } catch (e) {}
        stagingSettingsBadge.innerHTML = `
          <span>⚙️ <strong>Oyun Ayarları:</strong> ${settingsSummary}</span>
          <span style="color:#38bdf8; font-weight:700;">Yönetici telefondan güncelleyebilir</span>
        `;

        // Oyuncu Kartları ve Özelleştirmeleri
        stagingPlayersGrid.innerHTML = '';
        playersArray.forEach((p) => {
          const card = document.createElement('div');
          card.className = `staging-player-card ${p.isReady ? 'ready' : ''}`;
          const hostBadge = p.isHost ? '👑 ' : '';
          const readyBadge = p.isReady
            ? '<span style="color:#22c55e; font-weight:800; font-size:0.85rem;">✓ HAZIR</span>'
            : '<span style="color:#f59e0b; font-weight:700; font-size:0.85rem;">⏳ BEKLİYOR</span>';

          const costumeLabel = COSTUME_LABELS[p.costume] || '🏎️ Standart';
          const playerColor = p.color || '#3b82f6';
          const avatarIcon = getCostumeIcon(p.costume);
          const colorName = COLOR_NAMES[playerColor] || 'Özel';

          card.innerHTML = `
            <div class="staging-avatar-circle" style="background: radial-gradient(circle at 35% 35%, ${playerColor}55 0%, #1e293b 85%); border: 3px solid ${playerColor}; box-shadow: 0 0 16px ${playerColor}77;">
              ${avatarIcon}
            </div>
            <div class="staging-player-info">
              <div class="staging-player-header">
                <div class="staging-player-name">${hostBadge}${p.nickname}</div>
                <div>${readyBadge}</div>
              </div>
              <div class="staging-player-tags">
                <div class="staging-color-tag" style="background: ${playerColor}22; border: 1.5px solid ${playerColor}; color: ${playerColor};">
                  <span style="width:7px; height:7px; border-radius:50%; background: ${playerColor}; display:inline-block;"></span>
                  ${colorName}
                </div>
                <div class="staging-costume-tag">${costumeLabel}</div>
              </div>
            </div>
          `;
          stagingPlayersGrid.appendChild(card);
        });

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

      // ─── 8. RC RUSH (3D TOY ARCADE RACING) ───
      if (
        status === 'rc_rush_playing' ||
        (state.activeGameId === 'rc-rush' && status !== 'game_over' && status !== 'lobby')
      ) {
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

        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        lostAndFoundView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';
        rcRushView.style.display = 'flex';

        if (!rcRushRenderer) {
          rcRushRenderer = new RcRushRenderer3D(rcRushCanvasContainer);
        }

        return;
      }

      // ─── 9. TRANSFER SHOWDOWN (AÇIK ARTIRMA & 3D MAÇ) ───
      if (
        status === 'showdown_playing' ||
        (state.activeGameId === 'transfer-showdown' && status !== 'game_over' && status !== 'lobby')
      ) {
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
        if (rcRushRenderer) {
          rcRushRenderer.dispose();
          rcRushRenderer = null;
        }

        lobbyView.style.display = 'none';
        gameView.style.display = 'none';
        quizView.style.display = 'none';
        footballView.style.display = 'none';
        bluffView.style.display = 'none';
        tetrisView.style.display = 'none';
        lostAndFoundView.style.display = 'none';
        rcRushView.style.display = 'none';
        resultView.style.display = 'none';
        gameoverView.style.display = 'none';
        showdownView.style.display = 'flex';

        if (!showdownRenderer) {
          showdownRenderer = new FootballManager2DMatchEngine(showdownCanvasContainer);
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

        lafCurrentLevelIdx = lafState.currentLevelIndex || 1;

        // ─── Update HUD ───

        // Level Badge
        if (lafLevelBadge && lafState.levelName) {
          lafLevelBadge.innerText = `🏷️ ${lafState.levelName}`;
        }

        // Objective
        if (lafObjectiveText && lafState.objectiveText) {
          lafObjectiveText.innerText = lafState.objectiveText;
        }

        // Live Stars Rating
        const stars = lafState.stars || 1;
        if (lafStar1) lafStar1.style.color = stars >= 1 ? '#facc15' : '#475569';
        if (lafStar2) lafStar2.style.color = stars >= 2 ? '#facc15' : '#475569';
        if (lafStar3) lafStar3.style.color = stars >= 3 ? '#facc15' : '#475569';

        // Collectibles Counter
        if (lafCollectiblesCollected) {
          lafCollectiblesCollected.innerText = (lafState.collectedCount ?? 0).toString();
        }
        if (lafCollectiblesTotal) {
          lafCollectiblesTotal.innerText = (lafState.totalCollectibles ?? 5).toString();
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
            lafPlayerAAbility.innerText = miloP.abilityActive ? 'AKTİF ⚡' : 'HAZIR';
          }
          if (lafPlayerACooldown) {
            lafPlayerACooldown.style.width = miloP.abilityActive ? '0%' : '100%';
          }
          if (lafPlayerAStatus) lafPlayerAStatus.innerText = '🟢 BAĞLI';
        } else {
          if (lafPlayerAStatus) lafPlayerAStatus.innerText = '⏳ BEKLENİYOR';
        }

        if (niaP) {
          if (lafPlayerBNickname) lafPlayerBNickname.innerText = niaP.nickname;
          if (lafPlayerBAbility) {
            lafPlayerBAbility.innerText = niaP.abilityActive ? 'AKTİF 🪝' : 'HAZIR';
          }
          if (lafPlayerBCooldown) {
            lafPlayerBCooldown.style.width = niaP.abilityActive ? '0%' : '100%';
          }
          if (lafPlayerBStatus) lafPlayerBStatus.innerText = '🟢 BAĞLI';
        } else {
          if (lafPlayerBStatus) lafPlayerBStatus.innerText = '⏳ BEKLENİYOR';
        }

        // ─── Floating Communication Pings ───
        if (lafPingsContainer && lafState.activePings && lafState.activePings.length > 0) {
          const now = Date.now();
          lafPingsContainer.innerHTML = lafState.activePings
            .filter((p: any) => now - p.timestamp < 3200)
            .map((p: any) => {
              const isMilo = p.role === 'milo';
              const leftPos = isMilo ? '18%' : '70%';
              const color = isMilo ? '#f59e0b' : '#06b6d4';
              return `<div class="laf-ping-bubble laf-toy-tag" style="position:absolute; top:8.5rem; left:${leftPos}; padding:0.45rem 1rem; border-color:${color}; background:rgba(15,23,42,0.92); display:flex; align-items:center; gap:0.4rem; z-index:30;">
                <span style="font-size:1.1rem;">${p.text.split(' ')[0] || '📢'}</span>
                <span style="font-weight:900; color:${color}; font-size:0.85rem;">${p.role.toUpperCase()}:</span>
                <span style="font-weight:800; color:white; font-size:0.85rem;">${p.text}</span>
              </div>`;
            })
            .join('');
        } else if (lafPingsContainer && (!lafState.activePings || lafState.activePings.length === 0)) {
          lafPingsContainer.innerHTML = '';
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

        // ─── Level Complete Celebration Overlay ───
        if (lafLevelComplete) {
          if (lafState.phase === 'completed') {
            lafLevelComplete.style.display = 'flex';
            if (lafCompleteTime && lafState.completionTimeMs) {
              const sec = Math.floor(lafState.completionTimeMs / 1000);
              const cm = Math.floor(sec / 60).toString().padStart(2, '0');
              const cs = (sec % 60).toString().padStart(2, '0');
              lafCompleteTime.innerText = `${cm}:${cs}`;
            }
            if (lafCompleteCollectibles) {
              lafCompleteCollectibles.innerText = `${lafState.collectedCount ?? 5}/${lafState.totalCollectibles ?? 5}`;
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

    // RC Rush Canlı Snapshot Dinleyicisi
    sdk.onRcRushState = (rcState: any) => {
      if (rcRushView.style.display === 'flex' || rcRushRenderer) {
        if (!rcRushRenderer) {
          rcRushRenderer = new RcRushRenderer3D(rcRushCanvasContainer);
        }
        rcRushRenderer.updateSnapshot(rcState);

        // 1. Lider veya ilk arabayı bul
        const cars: any[] = rcState.cars || [];
        const leader = cars.find((c) => c.position === 1) || cars[0];

        // 2. Tur ve Süre (Sol Üst)
        if (rcRushLapBadge && leader) {
          rcRushLapBadge.innerText = `LAP ${leader.lap} / ${rcState.totalLaps || 3}`;
        }
        if (rcRushTimer && rcState.elapsedMs !== undefined) {
          const totalMs = rcState.elapsedMs;
          const mins = Math.floor(totalMs / 60000).toString().padStart(2, '0');
          const secs = Math.floor((totalMs % 60000) / 1000).toString().padStart(2, '0');
          const millis = (totalMs % 1000).toString().padStart(3, '0');
          rcRushTimer.innerText = `${mins}:${secs}.${millis}`;
        }
        if (rcRushBestLap && leader) {
          if (leader.bestLapMs > 0) {
            const bMs = leader.bestLapMs;
            const bM = Math.floor(bMs / 60000).toString().padStart(2, '0');
            const bS = Math.floor((bMs % 60000) / 1000).toString().padStart(2, '0');
            const bMil = (bMs % 1000).toString().padStart(3, '0');
            rcRushBestLap.innerText = `EN İYİ: ${bM}:${bS}.${bMil}`;
          } else {
            rcRushBestLap.innerText = 'EN İYİ: --:--.---';
          }
        }

        // 3. Sıralama Stack (Sağ Üst)
        if (rcRushPosition && leader) {
          rcRushPosition.innerText = leader.position.toString();
        }
        if (rcRushTotalRacers) {
          rcRushTotalRacers.innerText = `/ ${cars.length}`;
        }
        if (rcRushLeaderboardList) {
          const sorted = [...cars].sort((a, b) => a.position - b.position);
          rcRushLeaderboardList.innerHTML = sorted.map((c) => {
            const isFirst = c.position === 1;
            let gapText = 'LİDER';
            if (!isFirst) {
              if (c.distanceToAheadM !== undefined && c.distanceToAheadM > 0) {
                gapText = `-${Math.round(c.distanceToAheadM)}m`;
              } else if (c.gapToLeaderSec !== undefined && c.gapToLeaderSec > 0) {
                gapText = `+${c.gapToLeaderSec.toFixed(1)}s`;
              } else {
                gapText = '+0.0s';
              }
            }
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:0.25rem 0; border-bottom:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex; align-items:center; gap:0.4rem;">
                  <span style="width:8px; height:8px; border-radius:50%; background:${c.color}; display:inline-block; box-shadow:0 0 6px ${c.color};"></span>
                  <span style="color:#f8fafc; font-size:0.85rem;">${c.position}. ${c.nickname}</span>
                </div>
                <span style="color:${isFirst ? '#facc15' : '#94a3b8'}; font-family:monospace; font-size:0.75rem; font-weight:800;">${gapText}</span>
              </div>
            `;
          }).join('');
        }

        // 4. Re-Volt LED RPM Bar & Telemetri (Sağ Alt)
        if (leader) {
          if (rcRushSpeed) {
            rcRushSpeed.innerText = Math.round(leader.speed).toString().padStart(3, '0');
          }
          if (rcRushBoostNum) {
            rcRushBoostNum.innerText = `${Math.round(leader.boostMeter)}%`;
          }
          if (rcRushBoostBar) {
            // GPU-accelerated transform: scaleX
            const boostRatio = Math.max(0, Math.min(100, leader.boostMeter)) / 100;
            rcRushBoostBar.style.transform = `scaleX(${boostRatio})`;
            rcRushBoostBar.style.filter = leader.isBoosting
              ? 'drop-shadow(0 0 10px #f97316)'
              : 'none';
          }

          // Re-Volt 10 LED RPM Noktası (Yeşil -> Sarı -> Kırmızı)
          if (rcRushRpmDots && rcRushRpmDots.length > 0) {
            const rpmNorm = Math.max(0, Math.min(1, leader.rpmNormalized ?? (leader.speed / 160)));
            const activeCount = Math.round(rpmNorm * rcRushRpmDots.length);
            rcRushRpmDots.forEach((dot, idx) => {
              if (idx < activeCount) {
                if (idx < 5) {
                  dot.style.background = '#22c55e';
                  dot.style.boxShadow = '0 0 8px #22c55e';
                } else if (idx < 8) {
                  dot.style.background = '#facc15';
                  dot.style.boxShadow = '0 0 8px #facc15';
                } else {
                  dot.style.background = '#ef4444';
                  dot.style.boxShadow = '0 0 10px #ef4444';
                }
              } else {
                dot.style.background = '#1e293b';
                dot.style.boxShadow = 'none';
              }
            });
          }

          if (!rcRushIsRouletteActive && rcRushItemIcon) {
            const itemIcons: Record<string, string> = {
              rocket: '🚀',
              turbo: '⚡',
              oil: '🛢️',
              shield: '🛡️',
            };
            rcRushItemIcon.innerText = leader.item ? (itemIcons[leader.item] || '📦') : '📦';
          }
        }

        // 5. Geri Sayım Overlay (Orta)
        if (rcRushCountdownBanner) {
          if (rcState.phase === 'countdown') {
            rcRushCountdownBanner.style.display = 'block';
            if (rcRushCountdownNum) {
              rcRushCountdownNum.innerText = rcState.countdown > 0 ? rcState.countdown.toString() : 'GO!';
            }
          } else {
            rcRushCountdownBanner.style.display = 'none';
          }
        }

        // 6. Ters Yön Uyarısı
        if (rcRushWrongwayBanner && leader) {
          rcRushWrongwayBanner.style.display = leader.isWrongWay ? 'block' : 'none';
        }

        // 7. Live Mini-Map Çizimi (Sol Alt Canvas - Yön Gösteren Oklar)
        if (rcRushMinimap) {
          const ctx = rcRushMinimap.getContext('2d');
          if (ctx) {
            const w = rcRushMinimap.width;
            const h = rcRushMinimap.height;
            ctx.clearRect(0, 0, w, h);

            // Pist Yolu (Dış Hat)
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 7;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            TRACK_WAYPOINTS.forEach((wp, i) => {
              const norm = getNormalizedMiniMapCoords(wp.x, wp.z);
              const mx = norm.x * (w - 24) + 12;
              const my = norm.y * (h - 24) + 12;
              if (i === 0) ctx.moveTo(mx, my);
              else ctx.lineTo(mx, my);
            });
            ctx.closePath();
            ctx.stroke();

            // Pist Çizgisi (İç Çizgi - Neon Cyan)
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Finish Çizgisi İşareti
            const finishNorm = getNormalizedMiniMapCoords(TRACK_WAYPOINTS[0].x, TRACK_WAYPOINTS[0].z);
            const fx = finishNorm.x * (w - 24) + 12;
            const fy = finishNorm.y * (h - 24) + 12;
            ctx.fillStyle = '#facc15';
            ctx.fillRect(fx - 2, fy - 5, 4, 10);

            // Araçlar: Yön Gösteren Üçgen Pointers
            cars.forEach((car) => {
              const carNorm = getNormalizedMiniMapCoords(car.x, car.z);
              const cx = carNorm.x * (w - 24) + 12;
              const cy = carNorm.y * (h - 24) + 12;

              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(car.rotation);

              const isLeader = car.position === 1;
              const size = isLeader ? 7 : 5;

              ctx.fillStyle = car.color || '#38bdf8';
              ctx.beginPath();
              ctx.moveTo(size + 2, 0); // Burun
              ctx.lineTo(-size, -size * 0.8);
              ctx.lineTo(-size, size * 0.8);
              ctx.closePath();
              ctx.fill();

              if (isLeader) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              }
              ctx.restore();
            });
          }
        }
      }
    };

    // RC Rush Olay (Event) Dinleyicisi
    sdk.onRcRushEvent = (raceEvent: any) => {
      if (rcRushRenderer) {
        rcRushRenderer.handleRaceEvent(raceEvent);
      }

      // Dinamik Üst Banner ve Roulette Tetikleme
      if (rcRushEventBanner && rcRushEventText) {
        let msg = '';
        let color = '#38bdf8';

        switch (raceEvent.type) {
          case 'ITEM_PICKED':
            msg = `🎁 ${raceEvent.playerName || ''} GÜÇ KUTUSU ALDI!`;
            color = '#facc15';
            triggerRcWeaponRoulette(raceEvent.item);
            break;
          case 'CRASH':
            msg = `💥 ${raceEvent.playerName || ''} KAZA YAPTI!`;
            color = '#ef4444';
            break;
          case 'OVERTAKE':
            msg = `⚡ ${raceEvent.playerName || 'Biri'} Öne Geçti! (#${raceEvent.newPosition})`;
            color = '#38bdf8';
            break;
          case 'FINAL_LAP':
            msg = `🔥 SON TUR! (FINAL LAP)`;
            color = '#f97316';
            break;
          case 'ROCKET_HIT':
            msg = `💥 ROKET İSABETİ: ${raceEvent.targetName || ''}!`;
            color = '#ef4444';
            break;
          case 'OIL_SLIP':
            msg = `🛢️ ${raceEvent.playerName || ''} YAĞA BASTI!`;
            color = '#eab308';
            break;
          case 'BOOST':
            msg = `🚀 ${raceEvent.playerName || ''} NİTRO AÇTI!`;
            color = '#22c55e';
            break;
          case 'FINISH':
            msg = `🏁 YARIŞ BİTTİ! KAZANAN: ${raceEvent.playerName || ''}`;
            color = '#facc15';
            break;
          default:
            break;
        }

        if (msg) {
          rcRushEventText.innerText = msg;
          rcRushEventText.style.color = color;
          rcRushEventBanner.style.borderColor = color;
          rcRushEventBanner.style.boxShadow = `0 0 35px ${color}80`;
          rcRushEventBanner.style.display = 'block';

          if (rcRushBannerTimeout) clearTimeout(rcRushBannerTimeout);
          rcRushBannerTimeout = setTimeout(() => {
            if (rcRushEventBanner) rcRushEventBanner.style.display = 'none';
          }, 2400);
        }
      }
    };

    // Transfer Showdown Durum Dinleyicisi (Açık Artırma, Taktik, Maç & Analiz)
    sdk.onShowdownState = (snap: any) => {
      if (showdownRenderer) {
        showdownRenderer.updateSnapshot(snap);
      }

      if (!showdownView || showdownView.style.display !== 'flex') return;

      const phase = snap.phase;

      // 1. AÇIK ARTIRMA (AUCTION)
      if (phase === 'AUCTION') {
        showdownAuctionOverlay.style.display = 'flex';
        showdownTacticsOverlay.style.display = 'none';
        showdownMatchOverlay.style.display = 'none';
        showdownAnalysisOverlay.style.display = 'none';

        const lot = snap.currentLot;
        showdownLotCounter.innerText = `PAKET #${lot?.roundNumber || (snap.auctionCompletedLots + 1)}`;
        const timeLeft = Math.ceil(lot?.timeLeft || 0);
        showdownAuctionTimer.innerText = `${timeLeft}s`;
        showdownAuctionTimer.style.color = timeLeft <= 3 ? '#ef4444' : '#facc15';

        if (lot) {
          if (lot.pack) {
            showdownPackName.innerText = lot.pack.packName;
            if (showdownPackTier) showdownPackTier.style.display = 'none';
            showdownPackOpening.innerText = '1 Kredi';

            // Drafting Banner
            if (lot.isPickingPlayer) {
              showdownDraftBanner.style.display = 'block';
              showdownDraftBanner.innerText = `🎉 KAZANAN (${lot.highestBidderName || 'Menajer'}) BİR FUTBOLCU SEÇİYOR... [${Math.ceil(lot.pickingTimeLeft)}s]`;
            } else {
              showdownDraftBanner.style.display = 'none';
            }

            // 4 Futbolcu Kartı (Fotoğraflarla - Reytingsiz ve Kulüpsüz)
            lot.pack.cards.forEach((c: any, idx: number) => {
              const cardEl = document.getElementById(`showdown-pack-card-${idx}`);
              const posEl = document.getElementById(`showdown-card-pos-${idx}`);
              const nameEl = document.getElementById(`showdown-card-name-${idx}`);
              const metaEl = document.getElementById(`showdown-card-meta-${idx}`);
              const imgEl = document.getElementById(`showdown-card-img-${idx}`) as HTMLImageElement;

              if (posEl) posEl.innerText = c.specificRole || c.position;
              if (nameEl) nameEl.innerText = c.name;
              if (metaEl) metaEl.innerText = `${c.countryFlag} ${c.nationality || ''}`;

              if (imgEl) {
                if (c.photoUrl) {
                  imgEl.src = c.photoUrl;
                  imgEl.style.display = 'block';
                  imgEl.onerror = () => { imgEl.style.display = 'none'; };
                } else {
                  imgEl.style.display = 'none';
                }
              }

              if (cardEl) {
                if (lot.selectedCardId === c.id) {
                  cardEl.style.borderColor = '#10b981';
                  cardEl.style.boxShadow = '0 0 30px rgba(16, 185, 129, 0.7)';
                  cardEl.style.transform = 'scale(1.05)';
                  cardEl.style.opacity = '1';
                } else if (lot.selectedCardId && lot.selectedCardId !== c.id) {
                  cardEl.style.borderColor = '#334155';
                  cardEl.style.boxShadow = 'none';
                  cardEl.style.transform = 'scale(0.95)';
                  cardEl.style.opacity = '0.35';
                } else {
                  cardEl.style.borderColor = '#38bdf8';
                  cardEl.style.boxShadow = 'none';
                  cardEl.style.transform = 'scale(1)';
                  cardEl.style.opacity = '1';
                }
              }
            });
          }

          showdownAuctionBid.innerText = `${lot.currentBid} Kredi`;
          showdownAuctionBidder.innerText = lot.highestBidderName
            ? `(${lot.highestBidderName})`
            : '(Açılış Teklifi: 1 Kredi)';
        }

        // Menajer Kulübeleri
        const managers = Object.values(snap.managers || {}) as any[];
        const m0 = managers.find((m) => m.teamIndex === 0) || managers[0];
        const m1 = managers.find((m) => m.teamIndex === 1) || managers[1];

        if (showdownTurnStarterBadge && lot) {
          const starterName = lot.turnStarterId === m0?.sessionId ? (m0?.nickname || 'Takım A') : (m1?.nickname || 'Takım B');
          showdownTurnStarterBadge.innerText = `🎯 Sıra: ${starterName} (Açılış Teklifi: 1 Kredi)`;
        }

        if (m0) {
          showdownBenchAvatar0.innerText = m0.avatar || '👔';
          showdownBenchName0.innerText = m0.nickname || 'Menajer 1';
          showdownBenchBudget0.innerText = `${m0.budget} Kredi`;
          showdownBenchRoster0.innerText = `${m0.rosterCount || 0} / 11`;

          if (showdownBenchQuotas0 && m0.positionCounts) {
            showdownBenchQuotas0.innerHTML = `
              <span style="color:${m0.positionCounts.GK === 1 ? '#10b981' : '#f59e0b'}">🧤 ${m0.positionCounts.GK}/1</span>
              <span style="color:${m0.positionCounts.DEF >= 3 ? '#10b981' : '#f59e0b'}">🛡️ ${m0.positionCounts.DEF}/5</span>
              <span style="color:${m0.positionCounts.MID >= 3 ? '#10b981' : '#f59e0b'}">🎯 ${m0.positionCounts.MID}/5</span>
              <span style="color:${m0.positionCounts.FWD >= 1 ? '#10b981' : '#f59e0b'}">⚡ ${m0.positionCounts.FWD}/3</span>
            `;
          }

          if (lot?.highestBidderId === m0.sessionId) {
            showdownBenchStatus0.innerText = '👑 En Yüksek Teklif';
            showdownBenchStatus0.style.color = '#10b981';
          } else if (m0.hasPassedCurrentLot) {
            showdownBenchStatus0.innerText = 'Pas Geçti 🛑';
            showdownBenchStatus0.style.color = '#ef4444';
          } else {
            showdownBenchStatus0.innerText = 'Teklif Bekleniyor...';
            showdownBenchStatus0.style.color = '#94a3b8';
          }
        }

        if (m1) {
          showdownBenchAvatar1.innerText = m1.avatar || '🤖';
          showdownBenchName1.innerText = m1.nickname || 'Menajer 2';
          showdownBenchBudget1.innerText = `${m1.budget} Kredi`;
          showdownBenchRoster1.innerText = `${m1.rosterCount || 0} / 11`;

          if (showdownBenchQuotas1 && m1.positionCounts) {
            showdownBenchQuotas1.innerHTML = `
              <span style="color:${m1.positionCounts.GK === 1 ? '#10b981' : '#f59e0b'}">🧤 ${m1.positionCounts.GK}/1</span>
              <span style="color:${m1.positionCounts.DEF >= 3 ? '#10b981' : '#f59e0b'}">🛡️ ${m1.positionCounts.DEF}/5</span>
              <span style="color:${m1.positionCounts.MID >= 3 ? '#10b981' : '#f59e0b'}">🎯 ${m1.positionCounts.MID}/5</span>
              <span style="color:${m1.positionCounts.FWD >= 1 ? '#10b981' : '#f59e0b'}">⚡ ${m1.positionCounts.FWD}/3</span>
            `;
          }

          if (lot?.highestBidderId === m1.sessionId) {
            showdownBenchStatus1.innerText = '👑 En Yüksek Teklif';
            showdownBenchStatus1.style.color = '#10b981';
          } else if (m1.hasPassedCurrentLot) {
            showdownBenchStatus1.innerText = 'Pas Geçti 🛑';
            showdownBenchStatus1.style.color = '#ef4444';
          } else {
            showdownBenchStatus1.innerText = 'Teklif Bekleniyor...';
            showdownBenchStatus1.style.color = '#94a3b8';
          }
        }
      }

      // 2. KADRO & TAKTİK DÜZENİ (TACTICS)
      else if (phase === 'TACTICS') {
        showdownAuctionOverlay.style.display = 'none';
        showdownTacticsOverlay.style.display = 'flex';
        showdownMatchOverlay.style.display = 'none';
        showdownAnalysisOverlay.style.display = 'none';

        const managers = Object.values(snap.managers || {}) as any[];
        const m0 = managers.find((m) => m.teamIndex === 0) || managers[0];
        const m1 = managers.find((m) => m.teamIndex === 1) || managers[1];

        const t0 = m0 ? snap.managerTactics[m0.sessionId] : null;
        const t1 = m1 ? snap.managerTactics[m1.sessionId] : null;

        const allReady = Boolean(t0?.isReady && t1?.isReady);
        if (allReady) {
          showdownTacticsTimer.innerHTML = `<span style="color:#10b981; font-weight:900; font-size:1.4rem;">🔥 HER İKİ MENAJER DE HAZIR! MAÇ BAŞLIYOR...</span>`;
        } else {
          showdownTacticsTimer.innerHTML = `<span style="font-size:1.5rem; color:#f59e0b; font-weight:900;">${snap.phaseTimeLeft}s</span> <span style="font-size:1rem; color:#94a3b8; font-weight:700; margin-left:0.5rem;">(Her iki menajerin telefonundan "Kadro & Taktiği Onayla" demesi bekleniyor)</span>`;
        }

        if (m0 && t0) {
          showdownTacticsName0.innerText = `${m0.nickname} (${t0.isReady ? '✅ HAZIR' : '⏳ AYARLIYOR'})`;
          showdownTacticsForm0.innerText = `${t0.formation} • ${t0.playstyle.toUpperCase()}`;
          const syn0 = snap.teamSynergies[0];
          const starStr = (num: number) => num === 3 ? '★★★' : (num === 2 ? '★★☆' : '★☆☆');
          showdownTacticsSynergy0.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:1.05rem;"><span>Hücum:</span><span style="font-weight:900; color:#facc15; letter-spacing:2px;">${starStr(syn0.attackStars || 2)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:1.05rem;"><span>Orta Saha:</span><span style="font-weight:900; color:#facc15; letter-spacing:2px;">${starStr(syn0.midfieldStars || 2)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:1.05rem;"><span>Savunma:</span><span style="font-weight:900; color:#facc15; letter-spacing:2px;">${starStr(syn0.defenseStars || 2)}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:0.95rem;"><span>Mevki Uyumu:</span><span style="font-weight:900; color:#10b981;">%${syn0.chemistry}</span></div>
          `;
        }

        if (m1 && t1) {
          showdownTacticsName1.innerText = `(${t1.isReady ? '✅ HAZIR' : '⏳ AYARLIYOR'}) ${m1.nickname}`;
          showdownTacticsForm1.innerText = `${t1.playstyle.toUpperCase()} • ${t1.formation}`;
          const syn1 = snap.teamSynergies[1];
          const starStr = (num: number) => num === 3 ? '★★★' : (num === 2 ? '★★☆' : '★☆☆');
          showdownTacticsSynergy1.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:1.05rem;"><span style="font-weight:900; color:#facc15; letter-spacing:2px;">${starStr(syn1.attackStars || 2)}</span><span>:Hücum</span></div>
            <div style="display:flex; justify-content:space-between; font-size:1.05rem;"><span style="font-weight:900; color:#facc15; letter-spacing:2px;">${starStr(syn1.midfieldStars || 2)}</span><span>:Orta Saha</span></div>
            <div style="display:flex; justify-content:space-between; font-size:1.05rem;"><span style="font-weight:900; color:#facc15; letter-spacing:2px;">${starStr(syn1.defenseStars || 2)}</span><span>:Savunma</span></div>
            <div style="display:flex; justify-content:space-between; font-size:0.95rem;"><span style="font-weight:900; color:#10b981;">%${syn1.chemistry}</span><span>:Mevki Uyumu</span></div>
          `;
        }
      }

      // 3. CANLI MAÇ & DEVRE ARASI (MATCH)
      else if (phase === 'MATCH_FIRST_HALF' || phase === 'MATCH_SECOND_HALF' || phase === 'HALFTIME') {
        showdownAuctionOverlay.style.display = 'none';
        showdownTacticsOverlay.style.display = 'none';
        showdownMatchOverlay.style.display = 'flex';
        showdownAnalysisOverlay.style.display = 'none';

        const managers = Object.values(snap.managers || {}) as any[];
        const m0 = managers.find((m) => m.teamIndex === 0) || managers[0];
        const m1 = managers.find((m) => m.teamIndex === 1) || managers[1];

        if (m0) showdownScoreTeam0.innerText = m0.nickname.toUpperCase();
        if (m1) showdownScoreTeam1.innerText = m1.nickname.toUpperCase();

        showdownScoreNum0.innerText = (snap.matchScore ? snap.matchScore[0] : 0).toString();
        showdownScoreNum1.innerText = (snap.matchScore ? snap.matchScore[1] : 0).toString();

        // 1. Dijital Maç Saati (MM:SS)
        if (snap.pitchState && snap.pitchState.matchSecond !== undefined) {
          const totalSec = snap.pitchState.matchSecond;
          const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
          const secs = Math.floor(totalSec % 60).toString().padStart(2, '0');
          showdownMatchMinute.innerText = phase === 'HALFTIME' ? 'İY (45:00)' : `${mins}:${secs}`;
        } else {
          showdownMatchMinute.innerText = phase === 'HALFTIME' ? 'İY (45\')' : `${snap.currentMinute}'`;
        }

        // 2. Canlı Oyun Fazı Rozeti
        if (showdownPhaseBadge && snap.pitchState) {
          const phaseNames: Record<string, { label: string; color: string }> = {
            KICK_OFF: { label: 'SANTRADA TOP ÇEVRİLİYOR', color: '#64748b' },
            BUILD_UP: { label: 'GERİDEN OYUN KURMA', color: '#0284c7' },
            MIDFIELD_BATTLE: { label: 'ORTA SAHA MÜCADELESİ', color: '#2563eb' },
            WING_ATTACK: { label: '⚡ KANAT BİNDİRMESİ', color: '#f59e0b' },
            THROUGH_BALL: { label: '⚡ SAVUNMA ARKASINA KOŞU', color: '#f97316' },
            BOX_DANGER: { label: '🔥 CEZA SAHASINDA TEHLİKE!', color: '#ef4444' },
            SHOT_ON_GOAL: { label: '💥 KALEYE ŞUT!', color: '#dc2626' },
            SET_PIECE_CORNER: { label: '🚩 KÖŞE VURUŞU (KORNER)', color: '#eab308' },
            GOAL_KICK: { label: '🥅 KALE VURUŞU (AUT)', color: '#475569' },
            FREE_KICK: { label: '⚠️ SERBEST VURUŞ (FAUL)', color: '#f59e0b' },
            FREE_KICK_OFFSIDE: { label: '🚩 OFSAYT (ENDİREKT)', color: '#ef4444' },
            THROW_IN: { label: '👟 TAÇ ATIŞI', color: '#06b6d4' },
            PENALTY_KICK: { label: '🎯 PENALTI VURUŞU', color: '#dc2626' },
            GOAL_CELEBRATION: { label: '⚽ GOOOLL!!', color: '#10b981' }
          };
          const pInfo = phaseNames[snap.pitchState.phase] || { label: 'CANLI MAÇ', color: '#2563eb' };
          showdownPhaseBadge.innerText = pInfo.label;
          showdownPhaseBadge.style.background = pInfo.color;
        }

        // 3. Menajer Mentalite Rozetleri
        if (snap.managerMentality) {
          const ment0 = m0 ? snap.managerMentality[m0.sessionId] : 'balanced';
          const ment1 = m1 ? snap.managerMentality[m1.sessionId] : 'balanced';
          const mentLabels: Record<string, string> = {
            defensive: '🛡️ SAVUNMA',
            balanced: '⚖️ DENGELİ',
            attacking: '⚔️ HÜCUM',
            all_out_attack: '🚨 TÜM HATLARIYLA'
          };
          if (showdownMentality0) showdownMentality0.innerText = mentLabels[ment0] || 'DENGELİ';
          if (showdownMentality1) showdownMentality1.innerText = mentLabels[ment1] || 'DENGELİ';
        }

        // 4. Kenar Talimatı (Shout) Bildirimi
        if (showdownShoutBanner) {
          const activeShoutObj = snap.activeShouts
            ? Object.values(snap.activeShouts).find((s: any) => s && s.text)
            : null;
          if (activeShoutObj) {
            showdownShoutBanner.style.display = 'block';
            showdownShoutBanner.innerText = (activeShoutObj as any).text;
          } else {
            showdownShoutBanner.style.display = 'none';
          }
        }

        // 5. FM Timeline İlerlemesi (0' to 90')
        if (showdownTimelineProgress && snap.pitchState) {
          const progressPct = Math.min(100, (snap.pitchState.matchSecond / 5400) * 100);
          showdownTimelineProgress.style.width = `${progressPct}%`;
        }

        if (showdownTimelineIcons && snap.timelineMarkers) {
          showdownTimelineIcons.innerHTML = snap.timelineMarkers.map((m: any) => {
            const leftPct = Math.min(98, (m.minute / 90) * 100);
            const icon = m.type === 'GOAL' ? '⚽' : m.type === 'SAVE' ? '🧤' : '💥';
            return `<span style="position:absolute; left:${leftPct}%; top:-8px; font-size:12px; filter:drop-shadow(0 0 4px #000);">${icon}</span>`;
          }).join('');
        }

        // 6. FM Live Match Stats (Momentum Bar)
        const stats = snap.matchStats;
        const pos0 = stats ? stats.possession[0] : 50;
        const pos1 = stats ? stats.possession[1] : 50;
        const xg0 = stats ? stats.xg[0] : '0.00';
        const xg1 = stats ? stats.xg[1] : '0.00';

        if (showdownFmPosText0) showdownFmPosText0.innerText = `%${pos0}`;
        if (showdownFmPosText1) showdownFmPosText1.innerText = `%${pos1}`;
        if (showdownFmPosBar0) showdownFmPosBar0.style.width = `${pos0}%`;
        if (showdownFmPosBar1) showdownFmPosBar1.style.width = `${pos1}%`;
        if (showdownFmXg0) showdownFmXg0.innerText = `xG: ${xg0}`;
        if (showdownFmXg1) showdownFmXg1.innerText = `xG: ${xg1}`;

        // 7. FM Canlı Spiker Akışı (Live Ticker)
        if (snap.liveTicker && snap.liveTicker.length > 0) {
          const latest = snap.liveTicker[0];
          showdownCommentaryTitle.innerText = latest.text;
          showdownCommentarySub.innerText = snap.liveTicker[1]?.text || '';

          if (latest.type === 'GOAL') {
            showdownEventBadge.innerText = '⚽ GOOOL!';
            showdownEventBadge.style.background = '#10b981';
          } else if (latest.type === 'OFFSIDE') {
            showdownEventBadge.innerText = '🚩 OFSAYT!';
            showdownEventBadge.style.background = '#ef4444';
          } else if (latest.type === 'FOUL') {
            showdownEventBadge.innerText = '⚠️ FAUL!';
            showdownEventBadge.style.background = '#f59e0b';
          } else if (latest.type === 'RESTART') {
            if (latest.text.includes('TAÇ') || latest.text.includes('taç')) {
              showdownEventBadge.innerText = '👟 TAÇ!';
              showdownEventBadge.style.background = '#06b6d4';
            } else if (latest.text.includes('KORNER') || latest.text.includes('korner')) {
              showdownEventBadge.innerText = '🚩 KORNER!';
              showdownEventBadge.style.background = '#eab308';
            } else if (latest.text.includes('KALE VURUŞU') || latest.text.includes('AUT') || latest.text.includes('aut')) {
              showdownEventBadge.innerText = '🥅 AUT!';
              showdownEventBadge.style.background = '#64748b';
            } else {
              showdownEventBadge.innerText = '🔄 DURAN TOP';
              showdownEventBadge.style.background = '#64748b';
            }
          } else if (latest.type === 'DANGER') {
            showdownEventBadge.innerText = '⚡ TEHLİKE';
            showdownEventBadge.style.background = '#f97316';
          } else if (latest.type === 'SAVE') {
            showdownEventBadge.innerText = '🧤 KURTARIŞ!';
            showdownEventBadge.style.background = '#2563eb';
          } else if (latest.type === 'SHOUT') {
            showdownEventBadge.innerText = '📣 TALİMAT';
            showdownEventBadge.style.background = '#eab308';
          } else {
            showdownEventBadge.innerText = '🎙️ CANLI MAÇ';
            showdownEventBadge.style.background = '#334155';
          }
        } else if (snap.currentHighlight) {
          const hl = snap.currentHighlight;
          showdownCommentaryTitle.innerText = hl.commentary;
          showdownCommentarySub.innerText = hl.subText || '';
        } else if (phase === 'HALFTIME') {
          showdownCommentaryTitle.innerText = 'Devre Arası Düdüğü Çaldı!';
          showdownCommentarySub.innerText = 'Menajerler soyunma odasında 2. yarı için taktiklerini yeniliyor.';
          showdownEventBadge.innerText = '☕ DEVRE ARASI';
          showdownEventBadge.style.background = '#f59e0b';
        }
      }

      // 4. MAÇ ANALİZİ (ANALYSIS)
      else if (phase === 'ANALYSIS' && snap.matchStats) {
        showdownAuctionOverlay.style.display = 'none';
        showdownTacticsOverlay.style.display = 'none';
        showdownMatchOverlay.style.display = 'none';
        showdownAnalysisOverlay.style.display = 'flex';

        const stats = snap.matchStats;
        showdownFinalWinnerTitle.innerText = snap.winnerNickname
          ? `ŞAMPİYON: ${snap.winnerNickname} 🏆`
          : 'DOSTLUK KAZANDI (BERABERLİK) 🤝';
        showdownFinalScoreText.innerText = `${stats.score[0]} - ${stats.score[1]}`;

        showdownMvpName.innerText = stats.mvp.name;
        showdownMvpRating.innerText = stats.mvp.rating.toString();
        showdownMvpDesc.innerText = stats.mvp.reason;

        showdownAnalysisStatsTable.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-size:1.1rem; margin-bottom:0.4rem;">
            <span style="font-weight:900; color:#38bdf8;">%${stats.possession[0]}</span>
            <span style="font-weight:800; color:#94a3b8;">TOPLA OYNAMA</span>
            <span style="font-weight:900; color:#f59e0b;">%${stats.possession[1]}</span>
          </div>
          <div style="height:10px; background:#1e293b; border-radius:5px; overflow:hidden; display:flex; margin-bottom:1.2rem;">
            <div style="width:${stats.possession[0]}%; background:#38bdf8;"></div>
            <div style="width:${stats.possession[1]}%; background:#f59e0b;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:1.1rem; margin-bottom:0.8rem;">
            <span style="font-weight:900; color:#38bdf8;">${stats.xg[0]}</span>
            <span style="font-weight:800; color:#94a3b8;">BEKLENEN GOL (xG)</span>
            <span style="font-weight:900; color:#f59e0b;">${stats.xg[1]}</span>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:1.1rem; margin-bottom:0.8rem;">
            <span style="font-weight:900; color:#38bdf8;">${stats.shots[0]} (${stats.shotsOnTarget[0]})</span>
            <span style="font-weight:800; color:#94a3b8;">ŞUT (İSABETLİ)</span>
            <span style="font-weight:900; color:#f59e0b;">${stats.shots[1]} (${stats.shotsOnTarget[1]})</span>
          </div>

          <div style="display:flex; justify-content:space-between; font-size:1.1rem;">
            <span style="font-weight:900; color:#38bdf8;">${stats.saves[0]}</span>
            <span style="font-weight:800; color:#94a3b8;">KURTARIŞ</span>
            <span style="font-weight:900; color:#f59e0b;">${stats.saves[1]}</span>
          </div>
        `;
      }
    };
  } catch (err: any) {
    statusView.innerText = 'HATA: ' + (err.message || err.toString());
    statusView.style.color = '#ef4444';
    console.error('[ScreenSDK] Başlatma Hatası:', err);
  }
}

bootstrap();
