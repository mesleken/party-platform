import type {
  CardPosition,
  MatchHighlight,
  PlayerCard,
  ShowdownSnapshot
} from '@games/transfer-showdown';

interface PlayerVisual {
  id: string;
  name: string;
  shortName: string;
  number: number;
  position: CardPosition;
  teamIndex: number;
  photoUrl?: string;
  ovr: number;
  rating: number; // FM live rating e.g. 6.8, 7.5
  goals: number;
  // Sabit taktiksel referans noktası (0..100, 0..64)
  baseX: number;
  baseY: number;
  // Canlı hareket koordinatları
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hasBall: boolean;
  isDiving?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  life: number;
}

export class FootballManager2DMatchEngine {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId?: number;

  public currentSnapshot: ShowdownSnapshot | null = null;
  private homePlayers: PlayerVisual[] = [];
  private awayPlayers: PlayerVisual[] = [];

  // Ball state (in pitch coordinates 0..100, 0..64)
  private ballX = 50;
  private ballY = 32;
  private ballTargetX = 50;
  private ballTargetY = 32;
  private ballHeight = 0; // for 3D aerial shadow simulation
  private ballTrail: { x: number; y: number; alpha: number }[] = [];

  // Autonomous Continuous Football Match Simulation (Sürekli Canlı Maç Simülasyonu)
  private possessionTeam: 0 | 1 = 0;
  private ballCarrierId = '';
  private possessionHoldTimer = 0;
  private nextPassInterval = 1.4;
  private isPassing = false;
  private passStart = { x: 50, y: 32 };
  private passEnd = { x: 50, y: 32 };
  private passProgress = 0;
  private passReceiverId = '';

  // Server Highlight playback
  private activeHighlightId = '';
  private activeHighlight: MatchHighlight | null = null;
  private highlightElapsed = 0;
  private highlightStage = 0; // 0=buildup, 1=through pass, 2=finish
  private goalCelebrationTimer = 0;
  private goalScorerName = '';
  private goalParticles: Particle[] = [];

  // Animation pulse & tick
  private globalTick = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.background = '#09130e';

    container.innerHTML = '';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get Canvas 2D context');
    this.ctx = ctx;

    // Kadroları hemen varsayılan 22 oyuncu ile başlat (sahada asla boşluk olmaz)
    this.initDefaultSquads();

    this.onResize();
    window.addEventListener('resize', this.onResize);

    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  private onResize = () => {
    if (!this.container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.container.clientWidth * dpr;
    this.canvas.height = this.container.clientHeight * dpr;
  };

  /**
   * Her iki takım için tam 11'er (toplam 22) oyuncuyu garantili olarak başlatır.
   */
  private initDefaultSquads() {
    this.homePlayers = this.createVisualSquad([], 0);
    this.awayPlayers = this.createVisualSquad([], 1);
    this.ballCarrierId = this.homePlayers[6]?.id || '';
    if (this.homePlayers[6]) this.homePlayers[6].hasBall = true;
  }

  public updateSnapshot(snap: ShowdownSnapshot) {
    this.currentSnapshot = snap;

    // Gerçek menajer kartları geldikçe oyuncu isimlerini ve yüzlerini senkronize et
    this.syncSquadCards(snap);

    // Aktif pozisyon (Highlight) güncellemesi
    const h = snap.currentHighlight;
    if (h && h.id !== this.activeHighlightId) {
      this.activeHighlightId = h.id;
      this.activeHighlight = h;
      this.highlightElapsed = 0;
      this.highlightStage = 0;
      this.startHighlightSequence(h);
    }
  }

  private syncSquadCards(snap: ShowdownSnapshot) {
    const managers = Object.values(snap.managers || {});
    const m0 = managers.find((m) => m.teamIndex === 0) || managers[0];
    const m1 = managers.find((m) => m.teamIndex === 1) || managers[1];

    if (m0 && m0.cards && m0.cards.length > 0) {
      this.updateSquadWithCards(this.homePlayers, m0.cards);
    }
    if (m1 && m1.cards && m1.cards.length > 0) {
      this.updateSquadWithCards(this.awayPlayers, m1.cards);
    }
  }

  private updateSquadWithCards(players: PlayerVisual[], cards: PlayerCard[]) {
    cards.slice(0, 11).forEach((c, idx) => {
      const p = players[idx];
      if (p) {
        p.id = c.id;
        p.name = c.name;
        p.shortName = c.shortName || c.name.split(' ').pop() || c.name;
        p.position = c.position;
        p.photoUrl = c.photoUrl;
        p.ovr = c.ovr;
      }
    });
  }

  private createVisualSquad(cards: PlayerCard[], teamIdx: number): PlayerVisual[] {
    // 4-3-3 Taktiksel Saha Koordinatları (0..100, 0..64)
    const baseCoordsHome: [number, number][] = [
      [8, 32],   // 1. GK
      [24, 12],  // 2. LB
      [18, 24],  // 3. CB1
      [18, 40],  // 4. CB2
      [24, 52],  // 5. RB
      [42, 18],  // 6. LCM
      [36, 32],  // 7. CM
      [42, 46],  // 8. RCM
      [66, 14],  // 9. LW
      [72, 32],  // 10. ST
      [66, 50]   // 11. RW
    ];

    const baseCoordsAway: [number, number][] = [
      [92, 32],  // 1. GK
      [76, 12],  // 2. RB
      [82, 24],  // 3. CB1
      [82, 40],  // 4. CB2
      [76, 52],  // 5. LB
      [58, 18],  // 6. RCM
      [64, 32],  // 7. CM
      [58, 46],  // 8. LCM
      [34, 14],  // 9. RW
      [28, 32],  // 10. ST
      [34, 50]   // 11. LW
    ];

    const defaultNamesHome = [
      'Lev Yashin', 'Paolo Maldini', 'Franz Beckenbauer', 'Virgil van Dijk', 'Roberto Carlos',
      'Zinedine Zidane', 'Kevin De Bruyne', 'Andrés Iniesta', 'Lionel Messi', 'Erling Haaland', 'Cristiano Ronaldo'
    ];
    const defaultNamesAway = [
      'Gianluigi Buffon', 'Sergio Ramos', 'Franco Baresi', 'Rúben Dias', 'Cafu',
      'Xavi Hernández', 'Luka Modrić', 'Andrea Pirlo', 'Vinícius Júnior', 'Kylian Mbappé', 'Robert Lewandowski'
    ];

    const defaultPositions: CardPosition[] = ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'];
    const coords = teamIdx === 0 ? baseCoordsHome : baseCoordsAway;
    const defaultNames = teamIdx === 0 ? defaultNamesHome : defaultNamesAway;

    const squad: PlayerVisual[] = [];
    for (let i = 0; i < 11; i++) {
      const c = cards[i];
      const coord = coords[i] || [50, 32];
      const fullName = c ? c.name : defaultNames[i];
      const shortName = c?.shortName || fullName.split(' ').pop() || fullName;

      squad.push({
        id: c ? c.id : `default-${teamIdx}-${i}`,
        name: fullName,
        shortName,
        number: i === 0 ? 1 : i + 1,
        position: c ? c.position : defaultPositions[i],
        teamIndex: teamIdx,
        photoUrl: c?.photoUrl,
        ovr: c ? c.ovr : 85,
        rating: 6.6 + Math.random() * 0.7,
        goals: 0,
        baseX: coord[0],
        baseY: coord[1],
        x: coord[0],
        y: coord[1],
        targetX: coord[0],
        targetY: coord[1],
        hasBall: false
      });
    }

    return squad;
  }

  // ============================================================
  // SERVER HIGHLIGHT EVENT CONTROL (Kritik Pozisyon Oynatımı)
  // ============================================================
  private startHighlightSequence(h: MatchHighlight) {
    const isHome = h.attackingTeam === 0;
    this.possessionTeam = h.attackingTeam;
    this.isPassing = false;

    const attSquad = isHome ? this.homePlayers : this.awayPlayers;
    const defSquad = isHome ? this.awayPlayers : this.homePlayers;

    [...this.homePlayers, ...this.awayPlayers].forEach((p) => (p.hasBall = false));

    // Aşama 1: Oyun kurucu orta saha topu alır ve hücumu başlatır
    const midCards = attSquad.filter((p) => p.position === 'MID');
    const playmaker = (h.assistName ? attSquad.find((p) => p.name.includes(h.assistName || '')) : null) || midCards[0] || attSquad[6];
    if (playmaker) {
      playmaker.hasBall = true;
      this.ballCarrierId = playmaker.id;
      this.ballTargetX = playmaker.x;
      this.ballTargetY = playmaker.y;
    }

    // Takımların hücum yönünde dinamik kayması
    const attackDir = isHome ? 1 : -1;
    attSquad.forEach((p, idx) => {
      if (idx !== 0) {
        p.targetX = Math.max(12, Math.min(88, p.baseX + attackDir * (10 + Math.random() * 5)));
        p.targetY = Math.max(8, Math.min(56, p.baseY + (Math.random() * 6 - 3)));
      }
    });
    defSquad.forEach((p, idx) => {
      if (idx !== 0) {
        p.targetX = Math.max(12, Math.min(88, p.baseX + attackDir * (7 + Math.random() * 4)));
        p.targetY = Math.max(8, Math.min(56, p.baseY + (Math.random() * 4 - 2)));
      }
    });
  }

  private updateHighlightStages(h: MatchHighlight, elapsed: number) {
    const isHome = h.attackingTeam === 0;
    const attSquad = isHome ? this.homePlayers : this.awayPlayers;
    const defSquad = isHome ? this.awayPlayers : this.homePlayers;

    const targetName = h.scorerName || '';
    const attacker = attSquad.find((p) => targetName && p.name.includes(targetName)) || attSquad[9] || attSquad[10];
    const gk = defSquad[0];
    const goalX = isHome ? 97 : 3;
    const goalY = 32 + (Math.sin(this.globalTick * 3) * 6);

    // Aşama 2 (3.0sn - 5.5sn): Ceza sahasına öldürücü ara pası / forvetin deparı
    if (elapsed >= 3.0 && this.highlightStage === 0) {
      this.highlightStage = 1;
      [...this.homePlayers, ...this.awayPlayers].forEach((p) => (p.hasBall = false));

      if (attacker) {
        attacker.hasBall = true;
        this.ballCarrierId = attacker.id;
        attacker.targetX = isHome ? 80 + Math.random() * 6 : 20 - Math.random() * 6;
        attacker.targetY = 24 + Math.random() * 16;
        this.ballTargetX = attacker.targetX;
        this.ballTargetY = attacker.targetY;
        this.ballHeight = 1.2;
      }
    }

    // Aşama 3 (5.5sn - 9.0sn): Şut, Kurtarış veya Ağları Havalandıran Gol!
    if (elapsed >= 5.5 && this.highlightStage === 1) {
      this.highlightStage = 2;

      if (h.type === 'GOAL' || h.type === 'PENALTY_GOAL') {
        this.goalCelebrationTimer = 3.5;
        this.goalScorerName = h.scorerName || attacker?.name || 'Futbolcu';
        if (attacker) {
          attacker.goals++;
          attacker.rating = Math.min(10, attacker.rating + 0.9);
        }

        // Ağlara giden sert şut
        this.ballTargetX = goalX;
        this.ballTargetY = goalY;
        this.ballHeight = 2.4;
        this.spawnGoalConfetti();
      } else if (h.type === 'SAVE' || h.type === 'PENALTY_SAVE') {
        // Kaleci kurtarışı
        this.ballTargetX = isHome ? 93 : 7;
        this.ballTargetY = goalY;
        this.ballHeight = 1.5;
        if (gk) {
          gk.rating = Math.min(10, gk.rating + 0.6);
          gk.isDiving = true;
          setTimeout(() => { if (gk) gk.isDiving = false; }, 2000);
        }
      } else if (h.type === 'WOODWORK') {
        // Direkten dönen şut
        this.ballTargetX = goalX;
        this.ballTargetY = 32;
        this.ballHeight = 2.8;
      } else {
        // Defans müdahalesi / Dışarı
        this.ballTargetX = isHome ? 88 : 12;
        this.ballTargetY = 12 + Math.random() * 40;
        this.ballHeight = 0.8;
      }
    }

    // Highlight bittiğinde sürekli canlı maç akışına geri dön
    if (elapsed >= 8.8) {
      this.activeHighlight = null;
      this.highlightStage = 0;
      this.possessionHoldTimer = 0;
      // Topu defansa aktararak sürekli maç paslaşmasını devam ettir
      const nextTeamSquad = isHome ? this.awayPlayers : this.homePlayers;
      const nextCarrier = nextTeamSquad[1] || nextTeamSquad[0];
      if (nextCarrier) {
        this.possessionTeam = (1 - h.attackingTeam) as 0 | 1;
        this.ballCarrierId = nextCarrier.id;
        nextCarrier.hasBall = true;
        this.ballTargetX = nextCarrier.x;
        this.ballTargetY = nextCarrier.y;
      }
    }
  }

  // ============================================================
  // AUTONOMOUS CONTINUOUS MATCH SIMULATION (Sürekli Canlı Maç)
  // ============================================================
  private updateContinuousMatchPlay(deltaSec: number) {
    if (this.activeHighlight) return; // Sunucu pozisyonu aktifse o önceliklidir

    const isHome = this.possessionTeam === 0;
    const attSquad = isHome ? this.homePlayers : this.awayPlayers;
    const defSquad = isHome ? this.awayPlayers : this.homePlayers;
    const attackDir = isHome ? 1 : -1;

    // 1. Takımların taktiksel nefes alması (Breathing / Shift)
    attSquad.forEach((p, idx) => {
      if (idx !== 0) {
        p.targetX = Math.max(10, Math.min(90, p.baseX + attackDir * 5 + Math.sin(this.globalTick * 1.5 + idx) * 1.8));
        p.targetY = Math.max(8, Math.min(56, p.baseY + Math.cos(this.globalTick * 1.2 + idx) * 1.4));
      }
    });
    defSquad.forEach((p, idx) => {
      if (idx !== 0) {
        p.targetX = Math.max(10, Math.min(90, p.baseX - attackDir * 4 + Math.sin(this.globalTick * 1.5 + idx) * 1.5));
        p.targetY = Math.max(8, Math.min(56, p.baseY + Math.cos(this.globalTick * 1.2 + idx) * 1.2));
      }
    });

    // 2. Topu Taşıma & Paslaşma Döngüsü
    let carrier = attSquad.find((p) => p.id === this.ballCarrierId);
    if (!carrier) {
      carrier = attSquad[6] || attSquad[0];
      this.ballCarrierId = carrier.id;
      carrier.hasBall = true;
    }

    if (!this.isPassing) {
      // Top taşıyıcının ayağında sürülür
      this.ballTargetX = carrier.x;
      this.ballTargetY = carrier.y;
      this.possessionHoldTimer += deltaSec;

      // Belirli aralıklarla takım arkadaşına pas çıkar
      if (this.possessionHoldTimer >= this.nextPassInterval) {
        this.possessionHoldTimer = 0;
        this.nextPassInterval = 1.2 + Math.random() * 1.2;

        // Pas verilecek uygun takım arkadaşını seç (kendi hariç)
        const candidates = attSquad.filter((p) => p.id !== carrier?.id);
        const receiver = candidates[Math.floor(Math.random() * candidates.length)] || attSquad[0];

        this.isPassing = true;
        this.passStart = { x: this.ballX, y: this.ballY };
        this.passEnd = { x: receiver.x, y: receiver.y };
        this.passProgress = 0;
        this.passReceiverId = receiver.id;
        carrier.hasBall = false;

        // %12 İhtimalle Savunma Araya Girer (Interception / Top Çalma)
        if (Math.random() < 0.12) {
          const interceptor = defSquad[1 + Math.floor(Math.random() * (defSquad.length - 1))];
          if (interceptor) {
            this.passReceiverId = interceptor.id;
            this.possessionTeam = (1 - this.possessionTeam) as 0 | 1;
            interceptor.rating = Math.min(10, interceptor.rating + 0.3);
          }
        }
      }
    } else {
      // Pas havada / yerde seyrediyor
      this.passProgress += deltaSec * 1.6; // Pas süresi ~0.6s
      const pClamped = Math.min(1, this.passProgress);
      this.ballTargetX = this.passStart.x + (this.passEnd.x - this.passStart.x) * pClamped;
      this.ballTargetY = this.passStart.y + (this.passEnd.y - this.passStart.y) * pClamped;
      this.ballHeight = Math.sin(pClamped * Math.PI) * 0.9;

      if (this.passProgress >= 1) {
        this.isPassing = false;
        this.ballCarrierId = this.passReceiverId;
        const newCarrier = [...this.homePlayers, ...this.awayPlayers].find((p) => p.id === this.passReceiverId);
        if (newCarrier) {
          newCarrier.hasBall = true;
          this.ballTargetX = newCarrier.x;
          this.ballTargetY = newCarrier.y;
        }
      }
    }
  }

  private spawnGoalConfetti() {
    this.goalParticles = [];
    const colors = ['#facc15', '#38bdf8', '#ef4444', '#10b981', '#ffffff', '#ec4899'];
    for (let i = 0; i < 90; i++) {
      this.goalParticles.push({
        x: this.ballTargetX,
        y: this.ballTargetY,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: 3 + Math.random() * 5,
        alpha: 1.0,
        life: 1.0
      });
    }
  }

  private loop() {
    this.globalTick += 0.016;
    this.updatePhysics();
    this.draw();
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  private updatePhysics() {
    const deltaSec = 0.016;

    // Sürekli canlı maç simülasyonu
    this.updateContinuousMatchPlay(deltaSec);

    // Sunucu pozisyonu aktifse 9 saniyelik aşamaları işlet
    if (this.activeHighlight) {
      this.highlightElapsed += deltaSec;
      this.updateHighlightStages(this.activeHighlight, this.highlightElapsed);
    }

    // Top interpolasyonu & akıcı hareket
    this.ballX += (this.ballTargetX - this.ballX) * 0.09;
    this.ballY += (this.ballTargetY - this.ballY) * 0.09;
    this.ballHeight *= 0.95;

    // Top izi (Motion Blur Trail)
    this.ballTrail.unshift({ x: this.ballX, y: this.ballY, alpha: 0.8 });
    if (this.ballTrail.length > 8) this.ballTrail.pop();
    this.ballTrail.forEach((t) => (t.alpha *= 0.85));

    // 22 Oyuncunun interpolasyonla akıcı hareketi
    const updatePlayer = (p: PlayerVisual) => {
      p.x += (p.targetX - p.x) * 0.06;
      p.y += (p.targetY - p.y) * 0.06;
    };
    this.homePlayers.forEach(updatePlayer);
    this.awayPlayers.forEach(updatePlayer);

    // Konfeti parçacıkları
    if (this.goalCelebrationTimer > 0) {
      this.goalCelebrationTimer -= deltaSec;
      this.goalParticles.forEach((pt) => {
        pt.x += pt.vx * 0.04;
        pt.y += pt.vy * 0.04;
        pt.alpha -= 0.012;
      });
      this.goalParticles = this.goalParticles.filter((pt) => pt.alpha > 0);
    }
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Saha ölçeklemesi ve merkezleme
    const pitchMarginX = w * 0.08;
    const pitchMarginY = h * 0.12;
    const pitchW = w - pitchMarginX * 2;
    const pitchH = h - pitchMarginY * 2;

    const toScreenX = (px: number) => pitchMarginX + (px / 100) * pitchW;
    const toScreenY = (py: number) => pitchMarginY + (py / 64) * pitchH;

    // 1. Çim & Saha Zemin Çizimi (FM Striped Turf)
    this.drawPitchTurf(ctx, pitchMarginX, pitchMarginY, pitchW, pitchH);

    // 2. Saha Beyaz Çizgileri & Kaleler
    this.drawPitchMarkings(ctx, pitchMarginX, pitchMarginY, pitchW, pitchH);

    // 3. 22 Oyuncu Jetonu (Her iki takımın tüm futbolcuları eksiksiz sahada)
    this.drawPlayers(ctx, toScreenX, toScreenY);

    // 4. Ultra Belirgin & Parlak Futbol Topu (Glow, Hız İzi, Gölge)
    this.drawHighVisibilityBall(ctx, toScreenX, toScreenY);

    // 5. Gol Kutlaması & Konfeti Efektleri
    this.drawGoalCelebration(ctx, w, h, toScreenX, toScreenY);

    // 6. FM Yedek Kulübesi Oyuncu Puan Tabloları (Sol ve Sağ Yan Paneller)
    this.drawFMDugoutPanels(ctx, w, pitchMarginX, pitchMarginY, pitchH);
  }

  private drawPitchTurf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(x - 12, y - 12, w + 24, h + 24);
    ctx.restore();

    // Çim şeritleri (Alternating vertical grass mower stripes)
    const stripeCount = 14;
    const stripeW = w / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1b5e20' : '#23732a';
      ctx.fillRect(x + i * stripeW, y, stripeW, h);
    }
  }

  private drawPitchMarkings(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(2, w * 0.0035);

    // Dış Çerçeve
    ctx.strokeRect(x, y, w, h);

    // Orta Çizgi
    const midX = x + w / 2;
    ctx.beginPath();
    ctx.moveTo(midX, y);
    ctx.lineTo(midX, y + h);
    ctx.stroke();

    // Orta Yuvarlak & Nokta
    const centerRadius = h * 0.22;
    ctx.beginPath();
    ctx.arc(midX, y + h / 2, centerRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(midX, y + h / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Ceza Sahaları
    const penBoxW = w * 0.16;
    const penBoxH = h * 0.58;
    const penBoxY = y + (h - penBoxH) / 2;

    // Sol Ceza Sahası & 6-Pas
    ctx.strokeRect(x, penBoxY, penBoxW, penBoxH);
    const sixYardW = w * 0.055;
    const sixYardH = h * 0.32;
    const sixYardY = y + (h - sixYardH) / 2;
    ctx.strokeRect(x, sixYardY, sixYardW, sixYardH);

    // Sol Penaltı Noktası & Yayı
    const leftPenSpotX = x + w * 0.11;
    ctx.beginPath();
    ctx.arc(leftPenSpotX, y + h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(leftPenSpotX, y + h / 2, h * 0.15, -Math.PI * 0.32, Math.PI * 0.32);
    ctx.stroke();

    // Sağ Ceza Sahası & 6-Pas
    ctx.strokeRect(x + w - penBoxW, penBoxY, penBoxW, penBoxH);
    ctx.strokeRect(x + w - sixYardW, sixYardY, sixYardW, sixYardH);

    // Sağ Penaltı Noktası & Yayı
    const rightPenSpotX = x + w - w * 0.11;
    ctx.beginPath();
    ctx.arc(rightPenSpotX, y + h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightPenSpotX, y + h / 2, h * 0.15, Math.PI * 0.68, Math.PI * 1.32);
    ctx.stroke();

    // Korner Yayları
    const cornerR = h * 0.04;
    ctx.beginPath(); ctx.arc(x, y, cornerR, 0, Math.PI * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + h, cornerR, -Math.PI * 0.5, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w, y, cornerR, Math.PI * 0.5, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w, y + h, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke();

    // 3D Derinlikli Kale Ağları
    const goalH = h * 0.22;
    const goalDepth = w * 0.025;
    const goalY = y + (h - goalH) / 2;

    // Sol Kale
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(x - goalDepth, goalY, goalDepth, goalH);
    ctx.strokeStyle = '#f8fafc';
    ctx.strokeRect(x - goalDepth, goalY, goalDepth, goalH);

    // Sağ Kale
    ctx.fillRect(x + w, goalY, goalDepth, goalH);
    ctx.strokeRect(x + w, goalY, goalDepth, goalH);

    ctx.restore();
  }

  /**
   * Ultra Belirgin & Parlak Futbol Topu (FM Pro Match Ball)
   * Yüksek kontrast, neon altın çerçeve ve nabız gibi atan taktiksel hale
   */
  private drawHighVisibilityBall(
    ctx: CanvasRenderingContext2D,
    toX: (px: number) => number,
    toY: (py: number) => number
  ) {
    const sx = toX(this.ballX);
    const sy = toY(this.ballY);
    // Belirginlik için top yarıçapı büyütüldü
    const radius = Math.max(11, Math.min(16, this.canvas.width * 0.01));

    // 1. Dinamik Hız İzi (Speed Streaks)
    this.ballTrail.forEach((t) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(250, 204, 21, ${t.alpha * 0.35})`;
      ctx.arc(toX(t.x), toY(t.y), radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. 3D Zemin Gölgesi (Yükseklikle küçülür ve solar)
    const shadowScale = Math.max(0.3, 1 - this.ballHeight * 0.25);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.ellipse(sx, sy + this.ballHeight * 8, radius * shadowScale * 1.1, radius * 0.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Dış Taktiksel Neon Halkası (Topun yerini anında belli eder)
    const haloRadius = radius + 4 + Math.sin(this.globalTick * 10) * 2;
    ctx.beginPath();
    ctx.arc(sx, sy - this.ballHeight * 8, haloRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Parlak Futbol Topu Küresi
    ctx.save();
    ctx.translate(sx, sy - this.ballHeight * 8);

    // Parlak küre gölgesi & aurası
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.7, '#f8fafc');
    ballGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Çift dış çerçeve (Siyah + Neon Altın)
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // 5. Klasik Beşgen Paneller (Siyah + Geometrik Doku)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Dış 4 küçük panel noktaları
    const miniOffsets = [
      [-radius * 0.55, -radius * 0.5],
      [radius * 0.55, -radius * 0.5],
      [-radius * 0.55, radius * 0.5],
      [radius * 0.55, radius * 0.5]
    ];
    miniOffsets.forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(ox, oy, radius * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    });

    ctx.restore();
  }

  /**
   * 22 Oyuncu Jetonu (Her iki takımın 11'er futbolcusu eksiksiz sahada çizilir)
   */
  private drawPlayers(
    ctx: CanvasRenderingContext2D,
    toX: (px: number) => number,
    toY: (py: number) => number
  ) {
    const allPlayers = [...this.homePlayers, ...this.awayPlayers];
    const tokenRadius = Math.max(13, Math.min(21, this.canvas.width * 0.015));

    allPlayers.forEach((p) => {
      const px = toX(p.x);
      const py = toY(p.y);
      const isHome = p.teamIndex === 0;

      ctx.save();

      // Topa sahip oyuncuda parlayan altın halka
      if (p.hasBall) {
        const pulse = 1.0 + Math.sin(this.globalTick * 8) * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, tokenRadius * 1.5 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Taktiksel yön oku
        const dir = isHome ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(px + dir * (tokenRadius + 6), py);
        ctx.lineTo(px + dir * (tokenRadius + 14), py);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Kaleci dalışı efekti
      if (p.isDiving) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 18;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 9;
        ctx.shadowOffsetY = 3;
      }

      // Jeton Gövdesi (FM 2D Token)
      ctx.beginPath();
      ctx.arc(px, py, tokenRadius, 0, Math.PI * 2);

      const grad = ctx.createRadialGradient(px - tokenRadius * 0.3, py - tokenRadius * 0.3, 2, px, py, tokenRadius);
      if (p.position === 'GK') {
        grad.addColorStop(0, '#4ade80');
        grad.addColorStop(1, '#15803d');
      } else if (isHome) {
        grad.addColorStop(0, '#60a5fa');
        grad.addColorStop(1, '#1d4ed8');
      } else {
        grad.addColorStop(0, '#f87171');
        grad.addColorStop(1, '#b91c1c');
      }

      ctx.fillStyle = grad;
      ctx.fill();

      ctx.lineWidth = Math.max(2, tokenRadius * 0.16);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Forma Numarası (Squad Number)
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.round(tokenRadius * 0.9)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.number.toString(), px, py);

      // Oyuncu İsim Etiketi (FM Name Tag Underneath)
      const tagText = p.goals > 0 ? `⚽ ${p.shortName}` : p.shortName;
      ctx.font = `800 ${Math.max(9, Math.round(tokenRadius * 0.68))}px Inter, system-ui, sans-serif`;
      const textWidth = ctx.measureText(tagText).width;
      const tagH = tokenRadius * 0.85;
      const tagY = py + tokenRadius + 4;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(px - textWidth / 2 - 5, tagY, textWidth + 10, tagH, 4);
      ctx.fill();
      ctx.strokeStyle = isHome ? '#38bdf8' : '#f87171';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, px, tagY + tagH / 2 + 1);

      ctx.restore();
    });
  }

  private drawGoalCelebration(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    toX: (px: number) => number,
    toY: (py: number) => number
  ) {
    if (this.goalCelebrationTimer <= 0) return;

    this.goalParticles.forEach((pt) => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.beginPath();
      ctx.arc(toX(pt.x), toY(pt.y), pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.save();
    const bannerW = Math.min(680, w * 0.7);
    const bannerH = 90;
    const bx = (w - bannerW) / 2;
    const by = h * 0.42;

    ctx.shadowColor = 'rgba(234, 179, 8, 0.6)';
    ctx.shadowBlur = 35;
    ctx.fillStyle = 'rgba(7, 13, 24, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 16);
    ctx.fill();

    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = '900 38px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚽ GOOOOOLL!!', w / 2, by + 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px Inter, system-ui, sans-serif';
    ctx.fillText(this.goalScorerName ? `${this.goalScorerName} fileleri havalandırdı!` : 'Harika bir gol!', w / 2, by + 70);

    ctx.restore();
  }

  private drawFMDugoutPanels(
    ctx: CanvasRenderingContext2D,
    w: number,
    pitchX: number,
    pitchY: number,
    pitchH: number
  ) {
    const panelW = pitchX - 16;
    if (panelW > 110) {
      this.drawSingleDugout(ctx, 10, pitchY, panelW, pitchH, this.homePlayers, true);
      this.drawSingleDugout(ctx, w - panelW - 10, pitchY, panelW, pitchH, this.awayPlayers, false);
    }
  }

  private drawSingleDugout(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    players: PlayerVisual[],
    isHome: boolean
  ) {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isHome ? '#1d4ed8' : '#b91c1c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHome ? '#38bdf8' : '#f87171';
    ctx.font = '900 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isHome ? 'EV SAHİBİ (FM 11)' : 'DEPLASMAN (FM 11)', x + w / 2, y + 16);

    const rowH = (h - 26) / 11;
    players.slice(0, 11).forEach((p, i) => {
      const ry = y + 24 + i * rowH;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.number}`, x + 6, ry + rowH * 0.65);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.fillText(p.shortName.slice(0, 10), x + 20, ry + rowH * 0.65);

      const ratingVal = p.rating.toFixed(1);
      const isHigh = p.rating >= 7.5;
      ctx.fillStyle = isHigh ? '#10b981' : p.rating >= 6.8 ? '#f59e0b' : '#64748b';
      ctx.fillRect(x + w - 24, ry + 2, 20, rowH - 4);

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ratingVal, x + w - 14, ry + rowH * 0.65);
    });

    ctx.restore();
  }

  public destroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}
