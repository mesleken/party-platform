import type {
  CardPosition,
  PitchBallState,
  PitchPlayerState,
  PlayerCard,
  ShowdownSnapshot
} from '@games/transfer-showdown';

interface PlayerVisual extends PitchPlayerState {
  heading: number; // Radian direction for pointer triangle
  hasBall: boolean;
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
  private ballVx = 0;
  private ballVy = 0;
  private ballFlightEndX = 50;
  private ballFlightEndY = 32;
  private ballCarrierId: string | null = null;
  private ballHeight = 0;
  private ballTrail: { x: number; y: number; alpha: number }[] = [];
  private passType?: string;
  private passOrigin = { x: 50, y: 32 };

  // Server Highlight & Celebration
  private activeHighlightId = '';
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

    // Kadroları hemen varsayılan 22 oyuncu ile başlat
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

  private initDefaultSquads() {
    this.homePlayers = this.createVisualSquad(0);
    this.awayPlayers = this.createVisualSquad(1);
    if (this.homePlayers[6]) this.homePlayers[6].hasBall = true;
  }

  private createVisualSquad(teamIdx: 0 | 1): PlayerVisual[] {
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
      const coord = coords[i] || [50, 32];
      const fullName = defaultNames[i];
      const shortName = fullName.split(' ').pop() || fullName;

      squad.push({
        id: `default-${teamIdx}-${i}`,
        slotIndex: i,
        role: defaultPositions[i],
        name: fullName,
        shortName,
        number: i === 0 ? 1 : i + 1,
        position: defaultPositions[i],
        teamIndex: teamIdx,
        baseX: coord[0],
        baseY: coord[1],
        x: coord[0],
        y: coord[1],
        targetX: coord[0],
        targetY: coord[1],
        stamina: 100,
        rating: 6.8 + Math.random() * 0.4,
        goals: 0,
        assists: 0,
        action: 'IDLE',
        ovr: 85,
        heading: teamIdx === 0 ? 0 : Math.PI,
        hasBall: false
      });
    }

    return squad;
  }

  public updateSnapshot(snap: ShowdownSnapshot) {
    this.currentSnapshot = snap;

    // 1. Sunucu FM PitchState mevcutsa doğrudan senkronize et
    if (snap.pitchState && snap.pitchState.players && snap.pitchState.players.length >= 22) {
      this.syncServerPitchState(snap.pitchState.players, snap.pitchState.ball);
    } else {
      // Geriye dönük uyumluluk: manager cards ile senkronize et
      this.syncSquadCards(snap);
    }

    // 2. Aktif Gol / Highlight kontrolü
    const h = snap.currentHighlight;
    if (h && h.id !== this.activeHighlightId) {
      this.activeHighlightId = h.id;
      if (h.type === 'GOAL') {
        this.goalCelebrationTimer = 4.0;
        this.goalScorerName = h.scorerName || 'Gol!';
        this.spawnGoalConfetti();
      }
    }
  }

  private syncServerPitchState(serverPlayers: PitchPlayerState[], serverBall: PitchBallState) {
    // 22 Oyuncunun hedeflerini, kondisyonunu, reytingini ve aksiyonunu senkronize et
    serverPlayers.forEach((sp) => {
      const list = sp.teamIndex === 0 ? this.homePlayers : this.awayPlayers;
      const local = list.find((p) => p.slotIndex === sp.slotIndex) || list[sp.slotIndex];
      if (local) {
        local.id = sp.id;
        local.name = sp.name;
        local.shortName = sp.shortName;
        local.role = sp.role;
        local.position = sp.position;
        local.number = sp.number;
        // Sunucunun canlı fiziksel koordinatlarını hedef al (ışınlanma engeli)
        local.targetX = sp.x;
        local.targetY = sp.y;
        local.stamina = sp.stamina;
        local.rating = sp.rating;
        local.goals = sp.goals;
        local.assists = sp.assists;
        local.action = sp.action;
        local.photoUrl = sp.photoUrl;
        local.hasBall = sp.id === serverBall.carrierId;

        // Heading açısını hesapla
        const dx = sp.targetX - local.x;
        const dy = sp.targetY - local.y;
        if (Math.hypot(dx, dy) > 0.3) {
          local.heading = Math.atan2(dy, dx);
        }
      }
    });

    // Top Durumu: Sunucunun anlık ball.x, ball.y ve hız vektörlerini (vx, vy) takip et
    if (serverBall.isMoving && this.passType !== serverBall.passType) {
      this.passOrigin = { x: this.ballX, y: this.ballY };
    }
    this.ballTargetX = serverBall.x;
    this.ballTargetY = serverBall.y;
    this.ballFlightEndX = serverBall.targetX ?? serverBall.x;
    this.ballFlightEndY = serverBall.targetY ?? serverBall.y;
    this.ballVx = serverBall.vx ?? 0;
    this.ballVy = serverBall.vy ?? 0;
    this.ballCarrierId = serverBall.carrierId ?? null;
    this.ballHeight = serverBall.height;
    this.passType = serverBall.passType;
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

    // 1. 22 Oyuncunun interpolasyonla akıcı hareketi (Step Clamping ile asla ışınlanmaz)
    const updatePlayer = (p: PlayerVisual) => {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 55) {
        // Devre arası veya ilk başlangıç
        p.x = p.targetX;
        p.y = p.targetY;
      } else if (dist > 0.01) {
        const step = Math.min(dist * 0.30, 0.72);
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    };
    this.homePlayers.forEach(updatePlayer);
    this.awayPlayers.forEach(updatePlayer);

    // 2. Top hedefini 60fps'de ekstrapole et (snapshotlar arasında topun havada/yerde duraksamasını engeller)
    if (this.ballCarrierId) {
      const carrier =
        this.homePlayers.find((p) => p.id === this.ballCarrierId) ||
        this.awayPlayers.find((p) => p.id === this.ballCarrierId);
      if (carrier) {
        this.ballTargetX = carrier.x + Math.cos(carrier.heading || 0) * 0.45;
        this.ballTargetY = carrier.y + Math.sin(carrier.heading || 0) * 0.45;
      }
    } else if (Math.hypot(this.ballVx, this.ballVy) > 0.2) {
      const remDist = Math.hypot(this.ballFlightEndX - this.ballTargetX, this.ballFlightEndY - this.ballTargetY);
      const stepV = Math.hypot(this.ballVx, this.ballVy) * deltaSec;
      if (remDist > 0.2) {
        const move = Math.min(remDist, stepV);
        this.ballTargetX += ((this.ballFlightEndX - this.ballTargetX) / remDist) * move;
        this.ballTargetY += ((this.ballFlightEndY - this.ballTargetY) / remDist) * move;
      }
    }

    // 3. Top interpolasyonu & akıcı hareket (Mıknatıs / ışınlanma hissini engelleyen yumuşak takip)
    const bdx = this.ballTargetX - this.ballX;
    const bdy = this.ballTargetY - this.ballY;
    const bdist = Math.hypot(bdx, bdy);
    if (bdist > 80) {
      this.ballX = this.ballTargetX;
      this.ballY = this.ballTargetY;
    } else if (bdist > 0.01) {
      const maxSpeed = this.ballCarrierId ? 1.25 : 2.6;
      const bstep = Math.min(bdist * 0.38, maxSpeed);
      this.ballX += (bdx / bdist) * bstep;
      this.ballY += (bdy / bdist) * bstep;
    }

    // Top izi (Motion Blur Trail)
    this.ballTrail.unshift({ x: this.ballX, y: this.ballY, alpha: 0.8 });
    if (this.ballTrail.length > 8) this.ballTrail.pop();
    this.ballTrail.forEach((t) => (t.alpha *= 0.85));

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

    // Saha ölçeklemesi ve merkezleme (Genişletilmiş Panorama Saha Görünümü & Skorboard Güvenli Alanı)
    const pitchMarginX = Math.max(20, w * 0.032);
    const pitchMarginY = Math.max(54, h * 0.070);
    const pitchW = w - pitchMarginX * 2;
    const pitchH = h - pitchMarginY * 2;

    const toScreenX = (px: number) => pitchMarginX + (px / 100) * pitchW;
    const toScreenY = (py: number) => pitchMarginY + (py / 64) * pitchH;

    // 1. Çim & Saha Zemin Çizimi (FM Striped Turf)
    this.drawPitchTurf(ctx, pitchMarginX, pitchMarginY, pitchW, pitchH);

    // 2. Saha Beyaz Çizgileri & Kaleler
    this.drawPitchMarkings(ctx, pitchMarginX, pitchMarginY, pitchW, pitchH);

    // 3. Taktiksel Çizgiler (Pas Yörüngesi, Koşu Okları, Pres Halkaları)
    this.drawTacticalOverlays(ctx, toScreenX, toScreenY);

    // 4. 22 Oyuncu Jetonu (FM24 Pro Tokens, Yön Üçgeni, Kondisyon, Reyting)
    this.drawPlayers(ctx, toScreenX, toScreenY);

    // 5. Ultra Belirgin & Parlak Futbol Topu (Glow, Hız İzi, Gölge)
    this.drawHighVisibilityBall(ctx, toScreenX, toScreenY);

    // 6. Gol Kutlaması & Konfeti Efektleri
    this.drawGoalCelebration(ctx, w, h, toScreenX, toScreenY);

    // 6.1. Duran Top & Hakem Kararları Yayın Bildirimi (Faul, Taç, Korner, Aut, Ofsayt, Penaltı)
    this.drawSetPieceOverlay(ctx, w, h);

    // 7. FM Dugout Yedek Kulübesi Oyuncu Puan & Kondisyon Tabloları (Sol ve Sağ Yan Paneller)
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
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
   * Taktiksel Çizgiler: Canlı Ofsayt Çizgisi, Ara Pası Yörüngesi ve Hücum Koşusu Oku
   */
  private drawTacticalOverlays(
    ctx: CanvasRenderingContext2D,
    toX: (px: number) => number,
    toY: (py: number) => number
  ) {
    ctx.save();

    // 0. Canlı Sanal Ofsayt Çizgisi (Virtual Broadcast Offside Line - FM VAR)
    const offsideLineX = this.currentSnapshot?.pitchState?.offsideLineX;
    const phase = this.currentSnapshot?.pitchState?.phase;
    const showOffside = offsideLineX !== undefined && (phase === 'THROUGH_BALL' || phase === 'WING_ATTACK' || phase === 'BOX_DANGER' || phase === 'FREE_KICK_OFFSIDE');

    if (showOffside && offsideLineX !== undefined) {
      const offX = toX(offsideLineX);
      const topY = toY(0);
      const botY = toY(64);

      ctx.beginPath();
      ctx.moveTo(offX, topY);
      ctx.lineTo(offX, botY);
      ctx.strokeStyle = phase === 'FREE_KICK_OFFSIDE' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = phase === 'FREE_KICK_OFFSIDE' ? 3 : 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Çizginin üst ucunda FM Taktiksel Ofsayt Etiketi
      const tagText = phase === 'FREE_KICK_OFFSIDE' ? '🚩 OFSAYT!' : '📐 OFSAYT ÇİZGİSİ';
      ctx.font = '900 10px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(tagText).width;
      ctx.fillStyle = phase === 'FREE_KICK_OFFSIDE' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(offX - tw / 2 - 6, topY - 18, tw + 12, 16, 4);
      ctx.fill();
      ctx.strokeStyle = phase === 'FREE_KICK_OFFSIDE' ? '#f87171' : '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, offX, topY - 10);
    }

    // 1. Kilit Pas Yörüngesi (Through Ball or Cross Arc)
    if (this.passType === 'THROUGH' || this.passType === 'CROSS') {
      const sx = toX(this.passOrigin.x);
      const sy = toY(this.passOrigin.y);
      const ex = toX(this.ballTargetX);
      const ey = toY(this.ballTargetY);
      const midX = (sx + ex) / 2;
      const midY = (sy + ey) / 2 - 25;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(midX, midY, ex, ey);
      ctx.strokeStyle = this.passType === 'THROUGH' ? 'rgba(56, 189, 248, 0.7)' : 'rgba(250, 204, 21, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Koşu Yapan Forvetlerin Önünde Beliren Taktiksel Koşu Oku
    const allPlayers = [...this.homePlayers, ...this.awayPlayers];
    allPlayers.forEach((p) => {
      if (p.action === 'SPRINT_RUN') {
        const px = toX(p.x);
        const py = toY(p.y);
        const targetX = toX(p.targetX);
        const targetY = toY(p.targetY);

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(targetX, targetY);
        ctx.strokeStyle = p.teamIndex === 0 ? 'rgba(96, 165, 250, 0.65)' : 'rgba(248, 113, 113, 0.65)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (p.action === 'PRESS' || p.action === 'TACKLE') {
        // Pres / Müdahale Nabız Halkası
        const px = toX(p.x);
        const py = toY(p.y);
        ctx.beginPath();
        ctx.arc(px, py, 26 + Math.sin(this.globalTick * 10) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  /**
   * 22 Oyuncu Jetonu (FM24 Pro Tokens, Yön Üçgeni, Kondisyon Çubuğu, Canlı Reyting)
   */
  private drawPlayers(
    ctx: CanvasRenderingContext2D,
    toX: (px: number) => number,
    toY: (py: number) => number
  ) {
    const allPlayers = [...this.homePlayers, ...this.awayPlayers];
    // Küçültülmüş, taktiksel netliğe sahip oyuncu jetonları (FM24 2D Pro Tokens)
    const tokenRadius = Math.max(8.5, Math.min(13.5, this.canvas.width * 0.009));

    allPlayers.forEach((p) => {
      const px = toX(p.x);
      const py = toY(p.y);
      const isHome = p.teamIndex === 0;

      ctx.save();

      // Topa sahip oyuncuda parlayan altın halka
      if (p.hasBall) {
        const pulse = 1.0 + Math.sin(this.globalTick * 8) * 0.25;
        ctx.beginPath();
        ctx.arc(px, py, tokenRadius * 1.55 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Jeton Gövdesi (FM 2D Token)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 7;
      ctx.shadowOffsetY = 2;

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

      ctx.lineWidth = Math.max(1.5, tokenRadius * 0.15);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Yön Gösteren Burun Üçgeni (Orientation Pointer)
      const tipX = px + Math.cos(p.heading) * (tokenRadius + 3);
      const tipY = py + Math.sin(p.heading) * (tokenRadius + 3);
      const leftX = px + Math.cos(p.heading + 2.5) * (tokenRadius * 0.95);
      const leftY = py + Math.sin(p.heading + 2.5) * (tokenRadius * 0.95);
      const rightX = px + Math.cos(p.heading - 2.5) * (tokenRadius * 0.95);
      const rightY = py + Math.sin(p.heading - 2.5) * (tokenRadius * 0.95);

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(leftX, leftY);
      ctx.lineTo(rightX, rightY);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Forma Numarası (Squad Number)
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${Math.max(7, Math.round(tokenRadius * 0.85))}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.number.toString(), px, py);

      // ─── FM DETAYLARI: KONDİSYON (STAMINA) VE İSİM ETİKETİ ───
      const tagY = py + tokenRadius + 3;

      // 1. Kondisyon Çubuğu (Stamina Bar)
      const barW = tokenRadius * 1.6;
      const barH = 2.5;
      const staminaRatio = Math.max(0, Math.min(100, p.stamina || 100)) / 100;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(px - barW / 2, tagY, barW, barH);
      ctx.fillStyle = staminaRatio > 0.75 ? '#10b981' : staminaRatio > 0.55 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(px - barW / 2, tagY, barW * staminaRatio, barH);

      // 2. Oyuncu İsim ve Reyting Etiketi (FM Name & Rating Tag)
      const goalIcon = p.goals > 0 ? '⚽ ' : '';
      const tagText = `${goalIcon}${p.shortName}`;
      ctx.font = `800 ${Math.max(8, Math.round(tokenRadius * 0.65))}px Inter, system-ui, sans-serif`;
      const textWidth = ctx.measureText(tagText).width;
      const labelH = Math.max(9, tokenRadius * 0.85);
      const labelY = tagY + barH + 1.5;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      ctx.roundRect(px - textWidth / 2 - 4, labelY, textWidth + 8, labelH, 3);
      ctx.fill();
      ctx.strokeStyle = isHome ? '#38bdf8' : '#f87171';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, px, labelY + labelH / 2 + 0.5);

      ctx.restore();
    });
  }

  /**
   * Ultra Belirgin & Parlak Futbol Topu (FM Pro Match Ball)
   */
  private drawHighVisibilityBall(
    ctx: CanvasRenderingContext2D,
    toX: (px: number) => number,
    toY: (py: number) => number
  ) {
    const sx = toX(this.ballX);
    const sy = toY(this.ballY);
    const radius = Math.max(6.5, Math.min(10.5, this.canvas.width * 0.007));

    // 1. Dinamik Hız İzi (Speed Streaks)
    this.ballTrail.forEach((t) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(250, 204, 21, ${t.alpha * 0.35})`;
      ctx.arc(toX(t.x), toY(t.y), radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. 3D Zemin Gölgesi
    const shadowScale = Math.max(0.3, 1 - this.ballHeight * 0.25);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.ellipse(sx, sy + this.ballHeight * 8, radius * shadowScale * 1.1, radius * 0.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Dış Taktiksel Neon Pusula Halkası
    const haloRadius = radius + 3 + Math.sin(this.globalTick * 10) * 1.5;
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

    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    // 5. Beşgen Paneller
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

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

  private drawSetPieceOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const phase = this.currentSnapshot?.pitchState?.phase;
    if (!phase) return;

    let title = '';
    let sub = '';
    let strokeColor = '#3b82f6';
    let glowColor = 'rgba(59, 130, 246, 0.5)';
    let titleColor = '#60a5fa';

    switch (phase) {
      case 'FREE_KICK_OFFSIDE':
        title = '🚩 OFSAYT!';
        sub = 'Yan hakemin bayrağı havada • Endirekt Serbest Vuruş';
        strokeColor = '#ef4444';
        glowColor = 'rgba(239, 68, 68, 0.5)';
        titleColor = '#f87171';
        break;
      case 'FREE_KICK':
        title = '⚠️ FAUL!';
        sub = 'Hakem düdüğünü çaldı • Serbest Vuruş';
        strokeColor = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.5)';
        titleColor = '#fbbf24';
        break;
      case 'THROW_IN':
        title = '👟 TAÇ!';
        sub = 'Top taca çıktı • Taç Atışı';
        strokeColor = '#06b6d4';
        glowColor = 'rgba(6, 182, 212, 0.5)';
        titleColor = '#38bdf8';
        break;
      case 'GOAL_KICK':
        title = '🥅 AUT!';
        sub = 'Top auta çıktı • Kale Vuruşu';
        strokeColor = '#64748b';
        glowColor = 'rgba(100, 116, 139, 0.5)';
        titleColor = '#cbd5e1';
        break;
      case 'SET_PIECE_CORNER':
        title = '🚩 KORNER!';
        sub = 'Savunmaya çarpan top kornere çıktı • Köşe Vuruşu';
        strokeColor = '#eab308';
        glowColor = 'rgba(234, 179, 8, 0.5)';
        titleColor = '#facc15';
        break;
      case 'PENALTY_KICK':
        title = '🎯 PENALTI!';
        sub = 'Ceza sahası içinde ihlal • Beyaz Nokta!';
        strokeColor = '#dc2626';
        glowColor = 'rgba(220, 38, 38, 0.6)';
        titleColor = '#f87171';
        break;
      default:
        return;
    }

    ctx.save();
    const bannerW = Math.min(560, w * 0.65);
    const bannerH = 78;
    const bx = (w - bannerW) / 2;
    const by = h * 0.36;

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 28;
    ctx.fillStyle = 'rgba(11, 17, 32, 0.94)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 14);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = titleColor;
    ctx.font = '900 28px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, by + 34);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 15px Inter, system-ui, sans-serif';
    ctx.fillText(sub, w / 2, by + 61);

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
    if (panelW > 115) {
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

      // Forma No
      ctx.fillStyle = '#94a3b8';
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.number}`, x + 6, ry + rowH * 0.65);

      // İsim
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.fillText(p.shortName.slice(0, 9), x + 20, ry + rowH * 0.65);

      // Kondisyon Mini Çubuğu (Stamina)
      const stRatio = Math.max(0, Math.min(100, p.stamina || 100)) / 100;
      ctx.fillStyle = stRatio > 0.75 ? '#10b981' : stRatio > 0.55 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(x + w - 46, ry + rowH * 0.45, 16 * stRatio, 4);

      // Reyting Kutusu
      const ratingVal = (p.rating || 6.8).toFixed(1);
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
